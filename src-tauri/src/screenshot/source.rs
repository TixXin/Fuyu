use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;

use super::front_window as front;

const MAX_CHARS: usize = 300;
const WAIT_FOR_READING: Duration = Duration::from_millis(600);
const WAIT_STEP: Duration = Duration::from_millis(20);

static SOURCE: Mutex<Option<Source>> = Mutex::new(None);
static ASKED: AtomicU64 = AtomicU64::new(0);
static ANSWERED: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Source {
    pub(crate) app: String,
    pub(crate) title: Option<String>,
    pub(crate) url: Option<String>,
}

fn clipped(text: &str) -> Option<String> {
    let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
    (!text.is_empty()).then(|| text.chars().take(MAX_CHARS).collect())
}

fn web_address(text: &str) -> Option<String> {
    let text = text.trim();
    if text.is_empty() || text.contains(char::is_whitespace) || text.chars().count() > MAX_CHARS * 4 {
        return None;
    }
    let lower = text.to_ascii_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") {
        return Some(text.to_string());
    }
    let host = text.split(['/', '?', '#']).next().unwrap_or_default();
    let domain_like = host.contains('.') && !host.starts_with('.') && !host.ends_with('.') && !lower.contains("://");
    domain_like.then(|| format!("https://{text}"))
}

pub(super) fn tidy(app: &str, title: &str, url: Option<&str>) -> Option<Source> {
    let app = clipped(app)?;
    let title = clipped(title).filter(|title| *title != app);
    Some(Source { app, title, url: url.and_then(web_address) })
}

pub(super) fn remember() {
    let ticket = ASKED.fetch_add(1, Ordering::SeqCst) + 1;
    *SOURCE.lock().unwrap_or_else(PoisonError::into_inner) = None;
    let Some(window) = front::front() else {
        ANSWERED.store(ticket, Ordering::SeqCst);
        return;
    };
    thread::spawn(move || {
        let source = front::describe(window).and_then(|(app, title, url)| tidy(&app, &title, url.as_deref()));
        if ASKED.load(Ordering::SeqCst) == ticket {
            *SOURCE.lock().unwrap_or_else(PoisonError::into_inner) = source;
            ANSWERED.store(ticket, Ordering::SeqCst);
        }
    });
}

pub(super) fn current() -> Option<Source> {
    let started = Instant::now();
    while ANSWERED.load(Ordering::SeqCst) != ASKED.load(Ordering::SeqCst) && started.elapsed() < WAIT_FOR_READING {
        thread::sleep(WAIT_STEP);
    }
    SOURCE.lock().unwrap_or_else(PoisonError::into_inner).clone()
}
