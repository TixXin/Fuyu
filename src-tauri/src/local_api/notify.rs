use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use super::routes::ApiError;

pub(super) const METHOD: &str = "notify";
pub(super) const MAX_SOURCES: usize = 16;
pub(super) const MAX_PER_WINDOW: usize = 10;
pub(super) const WINDOW: Duration = Duration::from_secs(60);
const MAX_TITLE_CHARS: usize = 120;
const MAX_BODY_CHARS: usize = 500;
const MAX_NAME_CHARS: usize = 40;
const DEFAULT_DURATION_MS: u64 = 5000;
const MIN_DURATION_MS: u64 = 1000;
const MAX_DURATION_MS: u64 = 30_000;
const KEYS: &[&str] = &["source", "title", "body", "name", "durationMs"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Notice {
    pub source: String,
    pub name: Option<String>,
    pub title: String,
    pub body: String,
    pub duration_ms: u64,
}

struct Sender {
    name: String,
    sent: Vec<Instant>,
}

#[derive(Default)]
pub(super) struct Senders {
    sources: HashMap<String, Sender>,
}

static SENDERS: Mutex<Option<Senders>> = Mutex::new(None);

fn bad(message: impl Into<String>) -> ApiError {
    ApiError::new(400, message)
}

fn is_valid_source(source: &str) -> bool {
    (1..=32).contains(&source.len())
        && source.bytes().all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn text(params: &Value, key: &str, max_chars: usize) -> Result<Option<String>, ApiError> {
    match params.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => {
            let text = text.trim();
            if text.chars().count() > max_chars {
                Err(bad(format!("\"{key}\" can be at most {max_chars} characters.")))
            } else {
                Ok((!text.is_empty()).then(|| text.to_string()))
            }
        }
        Some(_) => Err(bad(format!("\"{key}\" must be a string."))),
    }
}

pub(super) fn parse(params: &Value) -> Result<Notice, ApiError> {
    let Some(fields) = params.as_object() else {
        return Err(bad("The body must be a JSON object."));
    };
    if let Some(unknown) = fields.keys().find(|key| !KEYS.contains(&key.as_str())) {
        return Err(bad(format!("Unknown field \"{unknown}\". A message takes source, title, body, name and durationMs.")));
    }
    let source = params.get("source").and_then(Value::as_str).unwrap_or_default();
    if !is_valid_source(source) {
        return Err(bad("\"source\" must be 1-32 lowercase letters, digits or '-'."));
    }
    let Some(title) = text(params, "title", MAX_TITLE_CHARS)? else {
        return Err(bad("\"title\" must not be empty."));
    };
    let duration_ms = match params.get("durationMs") {
        None | Some(Value::Null) => DEFAULT_DURATION_MS,
        Some(value) => match value.as_u64() {
            Some(ms) if (MIN_DURATION_MS..=MAX_DURATION_MS).contains(&ms) => ms,
            _ => return Err(bad(format!("\"durationMs\" must be a whole number from {MIN_DURATION_MS} to {MAX_DURATION_MS}."))),
        },
    };
    Ok(Notice {
        source: source.to_string(),
        name: text(params, "name", MAX_NAME_CHARS)?,
        title,
        body: text(params, "body", MAX_BODY_CHARS)?.unwrap_or_default(),
        duration_ms,
    })
}

impl Senders {
    pub(super) fn admit(&mut self, source: &str, name: Option<&str>, now: Instant) -> Result<String, ApiError> {
        let recent = |sent: &Instant| now.saturating_duration_since(*sent) < WINDOW;
        if !self.sources.contains_key(source) && self.sources.len() >= MAX_SOURCES {
            let idle = self
                .sources
                .iter()
                .filter(|(_, sender)| !sender.sent.iter().any(recent))
                .min_by_key(|(_, sender)| sender.sent.last().copied())
                .map(|(id, _)| id.clone());
            match idle {
                Some(id) => {
                    self.sources.remove(&id);
                }
                None => return Err(ApiError::new(429, format!("At most {MAX_SOURCES} sources can send messages at once."))),
            }
        }
        let sender = self.sources.entry(source.to_string()).or_insert_with(|| Sender { name: source.to_string(), sent: Vec::new() });
        sender.sent.retain(recent);
        if sender.sent.len() >= MAX_PER_WINDOW {
            return Err(ApiError::new(429, format!("At most {MAX_PER_WINDOW} messages a minute from one source.")));
        }
        sender.sent.push(now);
        if let Some(name) = name {
            sender.name = name.to_string();
        }
        Ok(sender.name.clone())
    }
}

pub(super) fn island_params(owner: &str, notice: &Notice, name: &str) -> Value {
    json!({
        "source": format!("{owner}/{}", notice.source),
        "name": name,
        "title": notice.title,
        "body": notice.body,
        "durationMs": notice.duration_ms,
    })
}

pub(super) fn prepare(owner: &str, params: &Value) -> Result<Value, ApiError> {
    let notice = parse(params)?;
    let mut senders = SENDERS.lock().unwrap_or_else(PoisonError::into_inner);
    let name = senders.get_or_insert_with(Senders::default).admit(&notice.source, notice.name.as_deref(), Instant::now())?;
    Ok(island_params(owner, &notice, &name))
}

pub(super) fn clear() {
    *SENDERS.lock().unwrap_or_else(PoisonError::into_inner) = None;
}
