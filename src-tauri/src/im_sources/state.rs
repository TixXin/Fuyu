#[cfg(any(windows, test))]
use std::collections::HashMap;

use serde::Serialize;

use super::specs::ImSourceSpec;
#[cfg(any(windows, test))]
use crate::toast_notifications::{ToastItem, ToastPoll};

pub(crate) const MAX_ITEMS: usize = 20;
#[cfg_attr(not(any(windows, test)), allow(dead_code))]
pub(crate) const FLASH_TOAST_WINDOW_MS: i64 = 2_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(any(windows, test)), allow(dead_code))]
pub enum ImNotificationKind {
    Toast,
    Flash,
    Badge,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImNotificationItem {
    pub id: String,
    pub kind: ImNotificationKind,
    pub title: String,
    pub body: String,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unread: Option<u32>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(any(windows, test)), allow(dead_code))]
pub enum ImSourceStatus {
    Disabled,
    Waiting,
    Listening,
    PermissionDenied,
    PermissionRequired,
    Error,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImSourceSnapshot {
    pub source: &'static str,
    pub revision: u64,
    pub enabled: bool,
    pub installed: bool,
    pub status: ImSourceStatus,
    pub items: Vec<ImNotificationItem>,
    pub error: Option<String>,
}

impl ImSourceSnapshot {
    pub(crate) fn new(source: &'static str) -> Self {
        Self {
            source,
            revision: 0,
            enabled: false,
            installed: false,
            status: ImSourceStatus::Disabled,
            items: Vec::new(),
            error: None,
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(crate) struct StateChange {
    pub(crate) changed: bool,
    pub(crate) newest_id: Option<String>,
    pub(crate) replaced_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
pub(crate) enum BadgeReading {
    NotAllowed,
    NotInDock,
    Label(Option<String>),
}

pub(crate) struct SourceState {
    pub(crate) spec: &'static ImSourceSpec,
    pub(crate) snapshot: ImSourceSnapshot,
    pub(crate) generation: u64,
    pub(crate) auto_clear: bool,
    #[cfg(any(windows, test))]
    toast_baseline: Option<HashMap<String, ImNotificationItem>>,
    #[cfg_attr(not(any(windows, test)), allow(dead_code))]
    last_toast_at: Option<i64>,
    #[cfg_attr(not(any(windows, test)), allow(dead_code))]
    last_flash_at: Option<i64>,
    #[cfg_attr(not(any(windows, test)), allow(dead_code))]
    flash_pending: bool,
    #[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
    unread: u32,
    #[cfg_attr(not(any(windows, test)), allow(dead_code))]
    pub(crate) last_packaged_aumid: Option<String>,
}

impl SourceState {
    pub(crate) fn new(spec: &'static ImSourceSpec) -> Self {
        Self {
            spec,
            snapshot: ImSourceSnapshot::new(spec.id),
            generation: 0,
            auto_clear: false,
            #[cfg(any(windows, test))]
            toast_baseline: None,
            last_toast_at: None,
            last_flash_at: None,
            flash_pending: false,
            unread: 0,
            last_packaged_aumid: None,
        }
    }

    pub(crate) fn set_enabled(&mut self, enabled: bool) -> StateChange {
        if self.snapshot.enabled == enabled {
            return StateChange::default();
        }
        self.generation += 1;
        #[cfg(any(windows, test))]
        {
            self.toast_baseline = None;
        }
        self.last_toast_at = None;
        self.last_flash_at = None;
        self.flash_pending = false;
        self.unread = 0;
        self.snapshot.enabled = enabled;
        self.snapshot.status = if enabled {
            ImSourceStatus::Waiting
        } else {
            ImSourceStatus::Disabled
        };
        self.snapshot.items.clear();
        self.snapshot.error = None;
        self.snapshot.revision += 1;
        StateChange {
            changed: true,
            newest_id: None,
            replaced_id: None,
        }
    }

    pub(crate) fn set_installed(&mut self, installed: bool) -> bool {
        if self.snapshot.installed == installed {
            return false;
        }
        self.snapshot.installed = installed;
        self.snapshot.revision += 1;
        true
    }

    pub(crate) fn clear(&mut self) -> bool {
        self.flash_pending = false;
        if self.snapshot.items.is_empty() {
            return false;
        }
        self.snapshot.items.clear();
        self.snapshot.revision += 1;
        true
    }

    pub(crate) fn apply_foreground(&mut self, at_ms: i64) -> StateChange {
        if !self.snapshot.enabled {
            return StateChange::default();
        }
        self.flash_pending = false;
        if !self.auto_clear {
            return StateChange::default();
        }
        let before = self.snapshot.items.len();
        self.snapshot.items.retain(|item| item.created_at > at_ms);
        if self.snapshot.items.len() == before {
            return StateChange::default();
        }
        self.snapshot.revision += 1;
        StateChange {
            changed: true,
            newest_id: None,
            replaced_id: None,
        }
    }

    #[cfg(any(windows, test))]
    pub(crate) fn apply_toast_poll(&mut self, poll: ToastPoll, now_ms: i64) -> StateChange {
        if !self.snapshot.enabled {
            return StateChange::default();
        }
        let before = self.snapshot.clone();
        let mut newest_id = None;
        let mut replaced_id = None;
        match poll {
            ToastPoll::Listening(raw_items) => {
                for raw in &raw_items {
                    if raw.app.aumid.contains('!') {
                        self.last_packaged_aumid = Some(raw.app.aumid.clone());
                    }
                }
                let mut current: Vec<ImNotificationItem> = raw_items
                    .into_iter()
                    .map(|item| from_toast_item(self.spec, item))
                    .collect();
                current.sort_by(|a, b| a.created_at.cmp(&b.created_at).then_with(|| a.id.cmp(&b.id)));
                self.snapshot.status = ImSourceStatus::Listening;
                self.snapshot.error = None;
                if let Some(previous) = &self.toast_baseline {
                    for item in &current {
                        if previous.get(&item.id) != Some(item) {
                            self.last_toast_at = Some(now_ms.max(item.created_at));
                            if let Some(flash_pos) = self.snapshot.items.iter().position(|existing| {
                                existing.kind == ImNotificationKind::Flash
                                    && within_window(existing.created_at, now_ms, item.created_at)
                            }) {
                                if replaced_id.is_none() {
                                    replaced_id = Some(self.snapshot.items[flash_pos].id.clone());
                                }
                                self.snapshot.items.retain(|existing| {
                                    !(existing.kind == ImNotificationKind::Flash
                                        && within_window(existing.created_at, now_ms, item.created_at))
                                });
                                self.flash_pending = false;
                            }
                            self.snapshot.items.retain(|existing| existing.id != item.id);
                            self.snapshot.items.insert(0, item.clone());
                            self.snapshot.items.truncate(MAX_ITEMS);
                            newest_id = Some(item.id.clone());
                        }
                    }
                }
                self.toast_baseline = Some(
                    current
                        .into_iter()
                        .map(|item| (item.id.clone(), item))
                        .collect(),
                );
            }
            ToastPoll::PermissionDenied => {
                self.toast_baseline = None;
                self.snapshot.status = ImSourceStatus::PermissionDenied;
                self.snapshot.error = None;
            }
            ToastPoll::PermissionRequired => {
                self.toast_baseline = None;
                self.snapshot.status = ImSourceStatus::PermissionRequired;
                self.snapshot.error = None;
            }
            ToastPoll::Error(error) => {
                self.snapshot.status = ImSourceStatus::Error;
                self.snapshot.error = Some(error);
            }
        }
        if self.snapshot == before && newest_id.is_none() {
            return StateChange::default();
        }
        self.snapshot.revision += 1;
        StateChange {
            changed: true,
            newest_id,
            replaced_id,
        }
    }

    #[cfg_attr(not(any(windows, test)), allow(dead_code))]
    pub(crate) fn apply_flash(&mut self, now_ms: i64) -> StateChange {
        if !self.snapshot.enabled {
            return StateChange::default();
        }
        if self
            .last_toast_at
            .is_some_and(|at| (now_ms - at).abs() <= FLASH_TOAST_WINDOW_MS)
        {
            return StateChange::default();
        }
        if self
            .last_flash_at
            .is_some_and(|at| (now_ms - at).abs() <= FLASH_TOAST_WINDOW_MS)
        {
            return StateChange::default();
        }
        if self.flash_pending
            && self
                .snapshot
                .items
                .iter()
                .any(|item| item.kind == ImNotificationKind::Flash)
        {
            return StateChange::default();
        }
        self.last_flash_at = Some(now_ms);
        self.flash_pending = true;
        self.snapshot
            .items
            .retain(|item| item.kind != ImNotificationKind::Flash);
        if self.snapshot.status == ImSourceStatus::Waiting {
            self.snapshot.status = ImSourceStatus::Listening;
        }
        let id = format!("{}:flash:{now_ms}", self.spec.id);
        self.snapshot.items.insert(
            0,
            ImNotificationItem {
                id: id.clone(),
                kind: ImNotificationKind::Flash,
                title: self.spec.display_name.into(),
                body: String::new(),
                created_at: now_ms,
                unread: None,
            },
        );
        self.snapshot.items.truncate(MAX_ITEMS);
        self.snapshot.revision += 1;
        StateChange {
            changed: true,
            newest_id: Some(id),
            replaced_id: None,
        }
    }

    #[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
    pub(crate) fn apply_badge(&mut self, reading: BadgeReading, now_ms: i64) -> StateChange {
        if !self.snapshot.enabled {
            return StateChange::default();
        }
        let before = self.snapshot.clone();
        let mut newest_id = None;
        match reading {
            BadgeReading::NotAllowed => {
                self.snapshot.status = ImSourceStatus::PermissionRequired;
                self.snapshot.error = None;
            }
            BadgeReading::NotInDock => {
                self.snapshot.status = ImSourceStatus::Listening;
                self.snapshot.error = None;
                self.unread = 0;
            }
            BadgeReading::Label(None) => {
                self.snapshot.status = ImSourceStatus::Listening;
                self.snapshot.error = None;
                self.unread = 0;
                if self.auto_clear {
                    self.snapshot.items.retain(|item| item.created_at > now_ms);
                }
            }
            BadgeReading::Label(Some(label)) => {
                let unread = parse_badge_unread(&label);
                self.snapshot.status = ImSourceStatus::Listening;
                self.snapshot.error = None;
                if unread > self.unread {
                    let id = format!("{}:badge:{now_ms}", self.spec.id);
                    self.snapshot.items.insert(
                        0,
                        ImNotificationItem {
                            id: id.clone(),
                            kind: ImNotificationKind::Badge,
                            title: self.spec.display_name.into(),
                            body: String::new(),
                            created_at: now_ms,
                            unread: Some(unread),
                        },
                    );
                    self.snapshot.items.truncate(MAX_ITEMS);
                    newest_id = Some(id);
                }
                self.unread = unread;
            }
        }
        if self.snapshot == before && newest_id.is_none() {
            return StateChange::default();
        }
        self.snapshot.revision += 1;
        StateChange {
            changed: true,
            newest_id,
            replaced_id: None,
        }
    }
}

#[cfg(any(windows, test))]
fn within_window(flash_at: i64, now_ms: i64, toast_at: i64) -> bool {
    (now_ms - flash_at).abs() <= FLASH_TOAST_WINDOW_MS
        || (toast_at - flash_at).abs() <= FLASH_TOAST_WINDOW_MS
}

#[cfg(any(windows, test))]
fn from_toast_item(spec: &ImSourceSpec, item: ToastItem) -> ImNotificationItem {
    let title = item
        .texts
        .first()
        .filter(|text| !text.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| spec.display_name.into());
    let body = item
        .texts
        .iter()
        .skip(1)
        .cloned()
        .collect::<Vec<_>>()
        .join("\n");
    ImNotificationItem {
        id: format!("{}:toast:{}:{}", spec.id, item.id, item.ticks),
        kind: ImNotificationKind::Toast,
        title: title.chars().take(120).collect(),
        body: body.chars().take(4000).collect(),
        created_at: item.created_at,
        unread: None,
    }
}

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
pub(crate) fn parse_badge_unread(label: &str) -> u32 {
    let digits: String = label.chars().filter(char::is_ascii_digit).collect();
    digits.parse().unwrap_or(1).max(1)
}
