use std::collections::HashMap;
use std::sync::{Mutex, PoisonError};

pub(super) const MAX_BACKSTEP_MS: i64 = 1_500;

#[derive(Debug, Clone, Copy, PartialEq)]
pub(super) struct Published {
    pub(super) position_ms: i64,
    pub(super) updated_ms: Option<i64>,
    pub(super) rate: f64,
    pub(super) duration_ms: i64,
}

impl Published {
    fn rate(&self) -> f64 {
        if self.rate.is_finite() && self.rate > 0.0 {
            self.rate
        } else {
            1.0
        }
    }

    fn clamp(&self, position: i64) -> i64 {
        if self.duration_ms > 0 {
            position.clamp(0, self.duration_ms)
        } else {
            position.max(0)
        }
    }

    fn projected(&self, playing: bool, now_ms: i64) -> i64 {
        let since = match self.updated_ms {
            Some(updated) if playing => (now_ms - updated).max(0),
            _ => 0,
        };
        self.clamp(self.position_ms + (since as f64 * self.rate()).round() as i64)
    }

    fn same_as(&self, other: &Published) -> bool {
        self.position_ms == other.position_ms
            && self.updated_ms == other.updated_ms
            && self.rate == other.rate
            && self.duration_ms == other.duration_ms
    }
}

#[derive(Debug, Clone)]
struct Entry {
    track: String,
    published: Published,
    position_ms: i64,
    at_ms: i64,
    playing: bool,
    trust_next: bool,
}

#[derive(Debug, Default)]
pub(super) struct TimelineClock {
    entries: HashMap<String, Entry>,
    last_session: Option<String>,
}

impl TimelineClock {
    pub(super) fn sample(&mut self, session: &str, track: &str, published: Published, playing: bool, now_ms: i64) -> i64 {
        self.last_session = Some(session.to_string());
        let fresh = published.projected(playing, now_ms);
        let position = match self.entries.get(session).filter(|entry| entry.track == track) {
            None => fresh,
            Some(entry) => {
                let moved = if playing && entry.playing { ((now_ms - entry.at_ms).max(0) as f64 * published.rate()).round() as i64 } else { 0 };
                let continued = published.clamp(entry.position_ms + moved);
                if entry.published.same_as(&published) {
                    continued
                } else if entry.trust_next || fresh >= continued || continued - fresh > MAX_BACKSTEP_MS {
                    fresh
                } else {
                    continued
                }
            }
        };
        let trust_next = self
            .entries
            .get(session)
            .is_some_and(|entry| entry.track == track && entry.trust_next && entry.published.same_as(&published));
        self.entries.insert(
            session.to_string(),
            Entry { track: track.to_string(), published, position_ms: position, at_ms: now_ms, playing, trust_next },
        );
        position
    }

    pub(super) fn seeked(&mut self, session: Option<&str>, position_ms: i64, now_ms: i64) {
        let Some(key) = session.map(str::to_string).or_else(|| self.last_session.clone()) else {
            return;
        };
        if let Some(entry) = self.entries.get_mut(&key) {
            entry.position_ms = entry.published.clamp(position_ms);
            entry.at_ms = now_ms;
            entry.trust_next = true;
        }
    }
}

static CLOCK: Mutex<Option<TimelineClock>> = Mutex::new(None);

pub(super) fn sample(session: &str, track: &str, published: Published, playing: bool, now_ms: i64) -> i64 {
    let mut guard = CLOCK.lock().unwrap_or_else(PoisonError::into_inner);
    guard.get_or_insert_with(TimelineClock::default).sample(session, track, published, playing, now_ms)
}

pub(super) fn seeked(session: Option<&str>, position_ms: i64, now_ms: i64) {
    let mut guard = CLOCK.lock().unwrap_or_else(PoisonError::into_inner);
    guard.get_or_insert_with(TimelineClock::default).seeked(session, position_ms, now_ms);
}

pub(super) fn track_key(title: Option<&str>, artist: Option<&str>, album: Option<&str>, duration_ms: i64) -> String {
    format!("{}\u{1f}{}\u{1f}{}\u{1f}{}", title.unwrap_or_default(), artist.unwrap_or_default(), album.unwrap_or_default(), duration_ms / 2_000)
}

#[cfg(test)]
#[path = "timeline_clock_tests.rs"]
mod tests;
