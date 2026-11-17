use std::sync::Arc;

use super::cache::ToastApp;

const FILETIME_EPOCH_DIFF_MS: i64 = 11_644_473_600_000;

pub(crate) fn ticks_to_unix_ms(ticks: i64) -> i64 {
    ticks / 10_000 - FILETIME_EPOCH_DIFF_MS
}

fn starts_with_ignore_ascii_case(text: &str, prefix: &str) -> bool {
    text.get(..prefix.len())
        .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
}

fn contains_ignore_ascii_case(text: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return false;
    }
    if !needle.is_ascii() {
        let lower_text = text.to_lowercase();
        let lower_needle = needle.to_lowercase();
        return lower_text.contains(&lower_needle);
    }
    text.as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub(crate) enum ToastMatcher {
    AumidExact(String),
    AumidPrefix(String),
    AumidContains(String),
    DisplayNameExact(String),
}

impl ToastMatcher {
    pub(crate) fn matches(&self, app: &ToastApp) -> bool {
        match self {
            Self::AumidExact(expected) => app.aumid.eq_ignore_ascii_case(expected),
            Self::AumidPrefix(prefix) => {
                !prefix.is_empty() && starts_with_ignore_ascii_case(&app.aumid, prefix)
            }
            Self::AumidContains(part) => contains_ignore_ascii_case(&app.aumid, part),
            Self::DisplayNameExact(expected) => {
                !expected.is_empty() && app.display_name.eq_ignore_ascii_case(expected)
            }
        }
    }
}

pub(crate) fn matches_any(matchers: &[ToastMatcher], app: &ToastApp) -> bool {
    matchers.iter().any(|matcher| matcher.matches(app))
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ToastItem {
    pub(crate) id: u32,
    pub(crate) ticks: i64,
    pub(crate) created_at: i64,
    pub(crate) app: ToastApp,
    pub(crate) texts: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum ToastPoll {
    Listening(Vec<ToastItem>),
    PermissionDenied,
    PermissionRequired,
    Error(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum PollBatch {
    Allowed(Vec<ToastItem>),
    PermissionDenied,
    PermissionRequired,
}

pub(crate) type PollCallback = Arc<dyn Fn(ToastPoll) + Send + Sync>;
pub(crate) type ForegroundCallback = Arc<dyn Fn(i64) + Send + Sync>;

pub(crate) struct Subscription {
    pub(crate) source: &'static str,
    pub(crate) matchers: Vec<ToastMatcher>,
    pub(crate) executables: Vec<String>,
    pub(crate) on_poll: PollCallback,
    pub(crate) on_foreground: ForegroundCallback,
}

struct RegisteredSource {
    source: &'static str,
    enabled: bool,
    was_front: bool,
    matchers: Vec<ToastMatcher>,
    executables: Vec<String>,
    on_poll: PollCallback,
    on_foreground: ForegroundCallback,
}

#[derive(Default)]
pub(crate) struct Dispatcher {
    sources: Vec<RegisteredSource>,
}

impl Dispatcher {
    pub(crate) fn subscribe(&mut self, subscription: Subscription) {
        if let Some(existing) = self
            .sources
            .iter_mut()
            .find(|entry| entry.source == subscription.source)
        {
            existing.matchers = subscription.matchers;
            existing.executables = subscription.executables;
            existing.on_poll = subscription.on_poll;
            existing.on_foreground = subscription.on_foreground;
            return;
        }
        self.sources.push(RegisteredSource {
            source: subscription.source,
            enabled: false,
            was_front: false,
            matchers: subscription.matchers,
            executables: subscription.executables,
            on_poll: subscription.on_poll,
            on_foreground: subscription.on_foreground,
        });
    }

    pub(crate) fn set_enabled(&mut self, source: &'static str, enabled: bool) -> (bool, bool) {
        let mut newly_enabled = false;
        if let Some(entry) = self.sources.iter_mut().find(|entry| entry.source == source) {
            if !entry.enabled && enabled {
                newly_enabled = true;
            }
            entry.enabled = enabled;
            if !enabled {
                entry.was_front = false;
            }
        }
        (self.any_enabled(), newly_enabled)
    }

    pub(crate) fn is_enabled(&self, source: &'static str) -> bool {
        self.sources
            .iter()
            .any(|entry| entry.source == source && entry.enabled)
    }

    pub(crate) fn any_enabled(&self) -> bool {
        self.sources.iter().any(|entry| entry.enabled)
    }

    pub(crate) fn active_matchers(&self) -> Vec<ToastMatcher> {
        let mut matchers = Vec::new();
        for entry in &self.sources {
            if entry.enabled {
                matchers.extend(entry.matchers.iter().cloned());
            }
        }
        matchers
    }

    pub(crate) fn dispatch_poll(
        &self,
        outcome: &Result<PollBatch, String>,
    ) -> Vec<(PollCallback, ToastPoll)> {
        let mut deliveries = Vec::new();
        for entry in &self.sources {
            if !entry.enabled {
                continue;
            }
            let payload = match outcome {
                Ok(PollBatch::Allowed(items)) => {
                    let matched = items
                        .iter()
                        .filter(|item| matches_any(&entry.matchers, &item.app))
                        .cloned()
                        .collect();
                    ToastPoll::Listening(matched)
                }
                Ok(PollBatch::PermissionDenied) => ToastPoll::PermissionDenied,
                Ok(PollBatch::PermissionRequired) => ToastPoll::PermissionRequired,
                Err(error) => ToastPoll::Error(error.clone()),
            };
            deliveries.push((entry.on_poll.clone(), payload));
        }
        deliveries
    }

    pub(crate) fn dispatch_foreground(
        &mut self,
        foreground_exe: Option<&str>,
    ) -> Vec<ForegroundCallback> {
        let mut callbacks = Vec::new();
        for entry in &mut self.sources {
            if !entry.enabled {
                entry.was_front = false;
                continue;
            }
            let front = foreground_exe.is_some_and(|exe| {
                entry
                    .executables
                    .iter()
                    .any(|candidate| candidate.eq_ignore_ascii_case(exe))
            });
            let entered = front && !entry.was_front;
            entry.was_front = front;
            if entered {
                callbacks.push(entry.on_foreground.clone());
            }
        }
        callbacks
    }
}
