mod source;
#[cfg(test)]
mod tests;

use serde::Serialize;
use source::{FetchError, Limits};
use std::{
    sync::{mpsc, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::{Duration, Instant, SystemTime},
};

const MIN_INTERVAL_MINUTES: u64 = 5;
const MAX_INTERVAL_MINUTES: u64 = 120;
const MAX_BACKOFF: Duration = Duration::from_secs(60 * 60);
const MANUAL_MIN_GAP: Duration = Duration::from_secs(60);

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct UsageWindow {
    pub percent: f64,
    pub resets_at: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UsageErrorKind {
    NoCredentials,
    TokenExpired,
    LoginRequired,
    Forbidden,
    RateLimited,
    NoProxy,
    Network,
    Http,
    InvalidResponse,
}

impl UsageErrorKind {
    fn is_local(self) -> bool {
        matches!(self, Self::NoCredentials | Self::TokenExpired | Self::NoProxy)
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct UsageError {
    pub kind: UsageErrorKind,
    pub message: String,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct ClaudeUsage {
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
    pub updated_at: Option<u64>,
    pub error: Option<UsageError>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub(crate) struct UsageConfig {
    pub proxy: Option<String>,
    pub interval_minutes: u64,
}

#[derive(Default)]
struct State {
    usage: ClaudeUsage,
    config: UsageConfig,
    failures: u32,
    cooldown_until: Option<Instant>,
    last_request: Option<Instant>,
    in_flight: bool,
    poller: Option<(mpsc::Sender<()>, thread::JoinHandle<()>)>,
}

fn state() -> MutexGuard<'static, State> {
    static STATE: OnceLock<Mutex<State>> = OnceLock::new();
    STATE
        .get_or_init(Mutex::default)
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn start(config: UsageConfig) -> Result<(), String> {
    let mut state = state();
    if state.config != config {
        state.config = config;
        state.failures = 0;
        state.last_request = None;
    }
    if let Some((wake, thread)) = &state.poller {
        if !thread.is_finished() {
            let _ = wake.send(());
            return Ok(());
        }
    }
    let (sender, receiver) = mpsc::channel();
    let thread = thread::Builder::new()
        .name("claude-usage".into())
        .spawn(move || poll(&receiver))
        .map_err(|error| format!("Could not start the Claude usage poller: {error}"))?;
    state.poller = Some((sender, thread));
    Ok(())
}

pub(crate) fn stop() {
    let mut state = state();
    state.poller = None;
    state.usage = ClaudeUsage::default();
    state.failures = 0;
}

pub(crate) fn current() -> Option<ClaudeUsage> {
    let state = state();
    state
        .poller
        .as_ref()
        .is_some_and(|(_, thread)| !thread.is_finished())
        .then(|| state.usage.clone())
}

const MIN_POLL_WAIT: Duration = Duration::from_secs(1);

fn poll(wake: &mpsc::Receiver<()>) {
    loop {
        if wait_before_poll(&state(), Instant::now()).is_zero() {
            tauri::async_runtime::block_on(refresh(false));
        }
        let wait = wait_before_poll(&state(), Instant::now()).max(MIN_POLL_WAIT);
        if let Err(mpsc::RecvTimeoutError::Disconnected) = wake.recv_timeout(wait) {
            return;
        }
    }
}

struct InFlight;

impl Drop for InFlight {
    fn drop(&mut self) {
        state().in_flight = false;
    }
}

fn backoff(state: &State) -> Duration {
    let minutes = state
        .config
        .interval_minutes
        .clamp(MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES);
    let interval = Duration::from_secs(60 * minutes);
    interval
        .saturating_mul(1 << state.failures.min(4))
        .min(MAX_BACKOFF.max(interval))
}

fn wait_before_poll(state: &State, now: Instant) -> Duration {
    let Some(last) = state.last_request else {
        return Duration::ZERO;
    };
    let cooldown = state
        .cooldown_until
        .map(|until| until.saturating_duration_since(now))
        .unwrap_or_default();
    backoff(state)
        .saturating_sub(now.saturating_duration_since(last))
        .max(cooldown)
}

fn may_request(state: &State, now: Instant, manual: bool) -> bool {
    let cooling = state.cooldown_until.is_some_and(|until| until > now);
    let recent = manual
        && state
            .last_request
            .is_some_and(|at| now.saturating_duration_since(at) < MANUAL_MIN_GAP);
    !state.in_flight && !cooling && !recent
}

async fn refresh(manual: bool) {
    let now = Instant::now();
    let config = {
        let mut state = state();
        if !may_request(&state, now, manual) {
            return;
        }
        state.in_flight = true;
        state.last_request = Some(now);
        state.config.clone()
    };
    let in_flight = InFlight;
    let now_ms = source::unix_ms(SystemTime::now());
    let proxy = source::resolve_proxy(config.proxy.as_deref());
    let api = source::fetch_api(proxy.as_deref(), now_ms).await;
    {
        let mut state = state();
        if state.poller.is_some() {
            apply(&mut state, api, now_ms, now);
        }
    }
    drop(in_flight);
}

fn apply(state: &mut State, api: Result<Limits, FetchError>, now_ms: u64, now: Instant) {
    let error = match api {
        Ok(limits) => {
            state.failures = 0;
            state.cooldown_until = None;
            state.usage = ClaudeUsage {
                five_hour: limits.five_hour,
                seven_day: limits.seven_day,
                updated_at: Some(now_ms),
                error: None,
            };
            return;
        }
        Err(error) => error,
    };
    state.failures = if error.kind.is_local() {
        0
    } else {
        state.failures.saturating_add(1)
    };
    state.cooldown_until = error.retry_after.map(|delay| now + delay);
    state.usage.error = Some(UsageError {
        kind: error.kind,
        message: error.message,
    });
}

#[tauri::command]
pub async fn refresh_claude_usage() -> Result<(), String> {
    if current().is_some() {
        refresh(true).await;
    }
    Ok(())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::claude_usage::refresh_claude_usage,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
