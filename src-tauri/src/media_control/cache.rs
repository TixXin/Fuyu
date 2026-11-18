#![cfg_attr(not(windows), allow(dead_code))]

use std::collections::HashMap;

pub(super) const COALESCE_MS: u64 = 80;
pub(super) const TIMELINE_MIN_EMIT_MS: i64 = 5_000;
pub(super) const TIMELINE_SEEK_JUMP_MS: i64 = 1_200;
pub(super) const TIMELINE_ENTRY_TTL_MS: i64 = 120_000;
pub(super) const MAX_TIMELINE_SESSIONS: usize = 32;
pub(super) const METADATA_TTL_MS: i64 = 15_000;
pub(super) const MISSING_COVER_RETRY_MS: i64 = 1_500;
pub(super) const FALLBACK_ACTIVE_TTL_MS: i64 = 2_000;
pub(super) const FALLBACK_SILENT_TTL_MS: i64 = 30_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum BurstSignal {
    Sessions,
    Track(Option<String>, i64),
    Playback(Option<String>, i64),
}

pub(super) fn merge_burst(current: BurstSignal, incoming: BurstSignal) -> BurstSignal {
    match (&current, incoming) {
        (BurstSignal::Sessions, _) | (_, BurstSignal::Sessions) => BurstSignal::Sessions,
        (_, BurstSignal::Track(id, at)) => BurstSignal::Track(id, at),
        (BurstSignal::Track(_, _), BurstSignal::Playback(_, _)) => current,
        (BurstSignal::Playback(_, _), BurstSignal::Playback(id, at)) => {
            BurstSignal::Playback(id, at)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct TimelineSample {
    pub(super) position_ms: i64,
    pub(super) duration_ms: i64,
    pub(super) at_ms: i64,
}

#[derive(Debug, Clone, Copy)]
struct TimelineEntry {
    sample: Option<TimelineSample>,
    last_emit_ms: i64,
    seen_at_ms: i64,
}

#[derive(Default)]
pub(super) struct TimelineGate {
    entries: HashMap<String, TimelineEntry>,
}

impl TimelineGate {
    pub(super) fn reset(&mut self) {
        self.entries.clear();
    }

    pub(super) fn should_emit(
        &mut self,
        session_id: Option<&str>,
        sample: Option<TimelineSample>,
        now_ms: i64,
    ) -> bool {
        self.entries
            .retain(|_, entry| now_ms.saturating_sub(entry.seen_at_ms) <= TIMELINE_ENTRY_TTL_MS);
        let key = session_id.unwrap_or_default().to_string();
        if let Some(entry) = self.entries.get_mut(&key) {
            entry.seen_at_ms = now_ms;
            let due = now_ms.saturating_sub(entry.last_emit_ms) >= TIMELINE_MIN_EMIT_MS;
            let emit_now = match (entry.sample, sample) {
                (Some(prev), Some(next)) => {
                    let wall_delta = (next.at_ms - prev.at_ms).max(0);
                    let pos_delta = next.position_ms - prev.position_ms;
                    let jumped = next.duration_ms != prev.duration_ms
                        || (pos_delta - wall_delta).abs() >= TIMELINE_SEEK_JUMP_MS;
                    entry.sample = Some(next);
                    jumped || due
                }
                (None, Some(next)) => {
                    entry.sample = Some(next);
                    true
                }
                (_, None) => due,
            };
            if emit_now {
                entry.last_emit_ms = now_ms;
            }
            return emit_now;
        }

        if self.entries.len() >= MAX_TIMELINE_SESSIONS {
            if let Some(oldest_key) = self
                .entries
                .iter()
                .min_by_key(|(_, entry)| entry.seen_at_ms)
                .map(|(k, _)| k.clone())
            {
                self.entries.remove(&oldest_key);
            }
        }
        self.entries.insert(
            key,
            TimelineEntry {
                sample,
                last_emit_ms: now_ms,
                seen_at_ms: now_ms,
            },
        );
        true
    }
}

struct CachedMetadataEntry<T> {
    session_id: String,
    epoch: u64,
    fetched_at_ms: i64,
    has_title: bool,
    has_cover: bool,
    value: T,
}

pub(super) struct MetadataCache<T> {
    entry: Option<CachedMetadataEntry<T>>,
}

impl<T> Default for MetadataCache<T> {
    fn default() -> Self {
        Self { entry: None }
    }
}

impl<T: Clone> MetadataCache<T> {
    pub(super) fn get(
        &self,
        session_id: Option<&str>,
        epoch: u64,
        events_running: bool,
        now_ms: i64,
    ) -> Option<T> {
        if !events_running {
            return None;
        }
        let cached = self.entry.as_ref()?;
        let key = session_id.unwrap_or_default();
        if cached.session_id != key || cached.epoch != epoch {
            return None;
        }
        let ttl = if cached.has_title && !cached.has_cover {
            MISSING_COVER_RETRY_MS
        } else {
            METADATA_TTL_MS
        };
        if now_ms.saturating_sub(cached.fetched_at_ms) < ttl {
            Some(cached.value.clone())
        } else {
            None
        }
    }

    pub(super) fn put(
        &mut self,
        session_id: Option<&str>,
        epoch: u64,
        now_ms: i64,
        has_title: bool,
        has_cover: bool,
        value: T,
    ) {
        self.entry = Some(CachedMetadataEntry {
            session_id: session_id.unwrap_or_default().to_string(),
            epoch,
            fetched_at_ms: now_ms,
            has_title,
            has_cover,
            value,
        });
    }
}

pub(super) struct FallbackCache<T, K> {
    config_key: Option<K>,
    entries: Vec<T>,
    scanned_at_ms: Option<i64>,
    had_playing: bool,
}

impl<T, K> Default for FallbackCache<T, K> {
    fn default() -> Self {
        Self {
            config_key: None,
            entries: Vec::new(),
            scanned_at_ms: None,
            had_playing: false,
        }
    }
}

pub(super) struct FallbackQuery<K> {
    pub(super) smtc_playing: bool,
    pub(super) target_needs_fallback: bool,
    pub(super) audio_active: bool,
    pub(super) config_key: K,
    pub(super) now_ms: i64,
}

impl<T: Clone, K: PartialEq> FallbackCache<T, K> {
    pub(super) fn resolve(
        &mut self,
        query: FallbackQuery<K>,
        is_playing: impl Fn(&T) -> bool,
        scan: impl FnOnce() -> Vec<T>,
    ) -> Vec<T> {
        if self.config_key.as_ref() != Some(&query.config_key) {
            self.config_key = Some(query.config_key);
            self.entries.clear();
            self.scanned_at_ms = None;
            self.had_playing = false;
        }

        if query.smtc_playing && !query.target_needs_fallback {
            return Vec::new();
        }

        let ttl = if query.target_needs_fallback || query.audio_active || self.had_playing {
            FALLBACK_ACTIVE_TTL_MS
        } else {
            FALLBACK_SILENT_TTL_MS
        };

        if let Some(scanned_at) = self.scanned_at_ms {
            if query.now_ms.saturating_sub(scanned_at) < ttl {
                return self.entries.clone();
            }
        }

        let fresh = scan();
        self.had_playing = fresh.iter().any(&is_playing);
        self.scanned_at_ms = Some(query.now_ms);
        self.entries = fresh.clone();
        fresh
    }
}

#[cfg(test)]
#[path = "cache_tests.rs"]
mod tests;
