use serde::{Deserialize, Serialize};

use super::session::Mode;
use crate::clipboard_history::shortcut::parse_shortcut_binding;

pub(super) const MAX_BINDINGS: usize = 16;
pub(super) const STATUS_EVENT: &str = "screenshot-shortcut-status";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ShortcutAction {
    Region,
    Copy,
    Text,
    Translate,
    Long,
    Fullscreen,
    Pins,
}

impl ShortcutAction {
    pub(super) fn mode(self) -> Option<Mode> {
        match self {
            Self::Region => Some(Mode::Region),
            Self::Copy => Some(Mode::Copy),
            Self::Text => Some(Mode::Text),
            Self::Translate => Some(Mode::Translate),
            Self::Long => Some(Mode::Long),
            Self::Fullscreen => Some(Mode::Fullscreen),
            Self::Pins => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutConfig {
    pub(crate) action: ShortcutAction,
    pub(crate) shortcut: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShortcutStatus {
    pub(crate) action: ShortcutAction,
    pub(crate) problem: &'static str,
}

pub(crate) fn default_shortcuts() -> Vec<ShortcutConfig> {
    [(ShortcutAction::Region, "Ctrl+Shift+1"), (ShortcutAction::Copy, "Ctrl+Shift+2"), (ShortcutAction::Text, "Ctrl+Shift+3"), (ShortcutAction::Translate, "Ctrl+Shift+4"), (ShortcutAction::Long, "Ctrl+Shift+5"), (ShortcutAction::Fullscreen, "Ctrl+Shift+7")]
        .into_iter()
        .map(|(action, shortcut)| ShortcutConfig { action, shortcut: shortcut.to_string() })
        .collect()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Binding {
    pub(crate) action: ShortcutAction,
    pub(crate) modifiers: u32,
    pub(crate) key_code: u32,
}

pub(crate) fn plan(config: &[ShortcutConfig]) -> (Vec<Binding>, Vec<ShortcutStatus>) {
    let mut bindings: Vec<Binding> = Vec::new();
    let mut problems = Vec::new();
    for entry in config.iter().take(MAX_BINDINGS) {
        if entry.shortcut.trim().is_empty() {
            continue;
        }
        let Some(binding) = parse_shortcut_binding(&entry.shortcut) else {
            problems.push(ShortcutStatus { action: entry.action, problem: "invalid" });
            continue;
        };
        if bindings.iter().any(|known| known.modifiers == binding.modifiers && known.key_code == binding.key_code) {
            problems.push(ShortcutStatus { action: entry.action, problem: "duplicate" });
            continue;
        }
        bindings.push(Binding { action: entry.action, modifiers: binding.modifiers, key_code: binding.key_code });
    }
    (bindings, problems)
}

