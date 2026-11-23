use std::{
    sync::{Mutex, MutexGuard, OnceLock, PoisonError},
    time::{Duration, Instant, SystemTime},
};

use serde_json::Value;

use super::{background::PLUGIN_ID, source, ClaudeUsage};

const GAP: Duration = Duration::from_secs(15 * 60);
const MAX_GAP: Duration = Duration::from_secs(2 * 60 * 60);

#[derive(Default)]
struct Fallback {
    usage: Option<ClaudeUsage>,
    next_try: Option<Instant>,
    failures: u32,
    in_flight: bool,
}

fn state() -> MutexGuard<'static, Fallback> {
    static STATE: OnceLock<Mutex<Fallback>> = OnceLock::new();
    STATE.get_or_init(Mutex::default).lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn wait_after(failures: u32, retry_after: Option<Duration>) -> Duration {
    let backoff = GAP.saturating_mul(1 << failures.min(3)).min(MAX_GAP);
    retry_after.map_or(backoff, |after| after.max(GAP).min(MAX_GAP))
}

fn may_try(state: &Fallback, now: Instant) -> bool {
    !state.in_flight && state.next_try.is_none_or(|next| next <= now)
}

pub(crate) async fn usage(stale: bool) -> Option<ClaudeUsage> {
    if let Some(current) = super::current() {
        return Some(current);
    }
    let now = Instant::now();
    let go = {
        let mut state = state();
        let go = stale && may_try(&state, now);
        if go {
            state.in_flight = true;
        }
        go
    };
    if go {
        let configured = crate::plugin_kernel::builtins::config(PLUGIN_ID)
            .get("proxy")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|proxy| !proxy.is_empty())
            .map(str::to_string);
        let proxy = source::resolve_proxy(configured.as_deref());
        let now_ms = source::unix_ms(SystemTime::now());
        let result = source::fetch_api(proxy.as_deref(), now_ms).await;
        let mut state = state();
        state.in_flight = false;
        match result {
            Ok(limits) => {
                state.failures = 0;
                state.next_try = Some(now + GAP);
                state.usage = Some(ClaudeUsage { five_hour: limits.five_hour, seven_day: limits.seven_day, updated_at: Some(now_ms), error: None });
            }
            Err(error) => {
                state.next_try = Some(now + wait_after(state.failures, error.retry_after));
                state.failures = state.failures.saturating_add(1);
            }
        }
    }
    state().usage.clone()
}
