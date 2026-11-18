use std::{
    collections::VecDeque,
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

pub(crate) const WINDOW_REQUEST_LIMIT: usize = 600;
pub(crate) const WINDOW_DURATION: Duration = Duration::from_secs(30 * 60);
const MAX_COOLDOWN: Duration = Duration::from_secs(15 * 60);

struct LimiterState {
    timestamps: VecDeque<Instant>,
    cooldown_until: Option<Instant>,
    limit: usize,
}

pub(crate) struct RateLimiter {
    state: Mutex<LimiterState>,
}

impl RateLimiter {
    pub(crate) fn new() -> Self {
        Self::with_limit(WINDOW_REQUEST_LIMIT)
    }

    pub(crate) fn with_limit(limit: usize) -> Self {
        Self {
            state: Mutex::new(LimiterState {
                timestamps: VecDeque::new(),
                cooldown_until: None,
                limit: limit.max(1),
            }),
        }
    }

    pub(crate) fn acquire(&self, now: Instant) -> Result<(), Duration> {
        let mut guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        if let Some(until) = guard.cooldown_until {
            if until > now {
                return Err(until.saturating_duration_since(now));
            }
            guard.cooldown_until = None;
        }
        if let Some(cutoff) = now.checked_sub(WINDOW_DURATION) {
            while guard.timestamps.front().is_some_and(|oldest| *oldest <= cutoff) {
                guard.timestamps.pop_front();
            }
        }
        if guard.timestamps.len() >= guard.limit {
            let wait = guard
                .timestamps
                .front()
                .map(|oldest| (*oldest + WINDOW_DURATION).saturating_duration_since(now))
                .unwrap_or(Duration::from_secs(60));
            return Err(wait.max(Duration::from_secs(1)));
        }
        guard.timestamps.push_back(now);
        Ok(())
    }

    pub(crate) fn compute_backoff(retry_after: Option<Duration>, attempt: u32) -> Duration {
        retry_after
            .unwrap_or_else(|| {
                let factor = 1_u64.checked_shl(attempt.min(6)).unwrap_or(64);
                Duration::from_millis(250 * factor)
            })
            .clamp(Duration::from_millis(100), MAX_COOLDOWN)
    }

    pub(crate) fn set_cooldown(&self, now: Instant, duration: Duration) {
        let clamped = duration.clamp(Duration::from_millis(100), MAX_COOLDOWN);
        let mut guard = self.state.lock().unwrap_or_else(PoisonError::into_inner);
        let candidate = now + clamped;
        guard.cooldown_until = Some(match guard.cooldown_until {
            Some(existing) if existing > candidate => existing,
            _ => candidate,
        });
    }
}

pub(crate) fn parse_retry_after(header: Option<&str>) -> Option<Duration> {
    let secs: u64 = header?.trim().parse().ok()?;
    Some(Duration::from_secs(secs))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct EtagToken {
    pub raw: String,
    pub bare: String,
    pub weak: bool,
}

impl EtagToken {
    pub(crate) fn parse(value: &str) -> Option<Self> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return None;
        }
        let (weak, rest) = if let Some(rest) = trimmed.strip_prefix("W/").or_else(|| trimmed.strip_prefix("w/")) {
            (true, rest.trim())
        } else {
            (false, trimmed)
        };
        let bare = rest
            .strip_prefix('"')
            .and_then(|inner| inner.strip_suffix('"'))
            .unwrap_or(rest)
            .trim();
        if bare.is_empty() {
            return None;
        }
        Some(Self { raw: trimmed.to_string(), bare: bare.to_string(), weak })
    }

    pub(crate) fn if_match_candidates(&self) -> Vec<String> {
        if self.weak {
            return Vec::new();
        }
        let quoted = format!("\"{}\"", self.bare);
        if self.raw.starts_with('"') && self.raw.ends_with('"') {
            vec![quoted, self.bare.clone()]
        } else {
            vec![self.bare.clone(), quoted]
        }
    }
}
