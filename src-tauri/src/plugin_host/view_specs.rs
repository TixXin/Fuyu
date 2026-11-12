use serde::{Deserialize, Serialize};

use super::manifest::LocalizedText;

const MAX_VIEWS: usize = 2;
const MAX_STATUS_ITEMS: usize = 2;
const MAX_PRIORITY: i32 = 100;
pub(super) const DEFAULT_WEBVIEW_HEIGHT: u32 = 240;
const WEBVIEW_HEIGHTS: std::ops::RangeInclusive<u32> = 80..=480;
const WEBVIEW_WIDTHS: std::ops::RangeInclusive<u32> = 320..=860;

pub(super) const VIEW_ICONS: [&str; 47] = [
    "list", "list-checks", "list-todo", "kanban", "square-check", "timer", "clock", "calendar", "bell", "book-open",
    "bookmark", "star", "heart", "folder", "file-text", "git-pull-request", "bug", "code", "terminal", "cloud", "sun",
    "music", "newspaper", "rss", "mail", "message-square", "globe", "link", "activity", "chart-column", "zap", "flame",
    "coffee", "puzzle", "gauge", "target", "trophy", "rocket", "sparkles", "inbox", "tag", "hash", "search", "house",
    "notebook", "circle-check", "info",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewTemplate {
    List,
    Detail,
    Form,
    Status,
    Webview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ViewFrame {
    Card,
    None,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ViewSpec {
    pub id: String,
    pub title: LocalizedText,
    #[serde(default = "default_icon")]
    pub icon: String,
    pub template: ViewTemplate,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frame: Option<ViewFrame>,
}

pub(super) fn is_valid_entry(entry: &str) -> bool {
    let lower = entry.to_ascii_lowercase();
    (1..=200).contains(&entry.len())
        && (lower.ends_with(".html") || lower.ends_with(".htm"))
        && !entry.starts_with('/')
        && !entry.contains(['\\', ':', '?', '#', '%'])
        && entry.split('/').all(|part| !part.is_empty() && part != "." && part != "..")
}

fn check_webview(view: &ViewSpec) -> Result<(), String> {
    match view.template {
        ViewTemplate::Webview => {
            if !view.entry.as_deref().is_some_and(is_valid_entry) {
                return Err(format!("View \"{}\" needs an \"entry\": a relative path to an .html file inside the plugin folder.", view.id));
            }
            if view.height.is_some_and(|height| !WEBVIEW_HEIGHTS.contains(&height)) {
                return Err(format!("View \"{}\" has a height outside {}..{}.", view.id, WEBVIEW_HEIGHTS.start(), WEBVIEW_HEIGHTS.end()));
            }
            if view.width.is_some_and(|width| !WEBVIEW_WIDTHS.contains(&width)) {
                return Err(format!("View \"{}\" has a width outside {}..{}.", view.id, WEBVIEW_WIDTHS.start(), WEBVIEW_WIDTHS.end()));
            }
        }
        _ if view.entry.is_some() || view.height.is_some() || view.width.is_some() || view.frame.is_some() => {
            return Err(format!("View \"{}\": \"entry\", \"height\", \"width\" and \"frame\" are only for the webview template.", view.id));
        }
        _ => {}
    }
    Ok(())
}

fn default_icon() -> String {
    "puzzle".into()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StatusItemSpec {
    pub id: String,
    #[serde(default)]
    pub priority: i32,
}

fn is_valid_id(id: &str) -> bool {
    (1..=32).contains(&id.len()) && id.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn read<T: serde::de::DeserializeOwned>(raw: &serde_json::Value, field: &str) -> Result<Vec<T>, String> {
    if raw.is_null() {
        return Ok(Vec::new());
    }
    serde_json::from_value(raw.clone()).map_err(|error| format!("contributes.{field} is not valid: {error}"))
}

pub(super) fn check(
    views_raw: &serde_json::Value,
    status_raw: &serde_json::Value,
    api_version: u32,
) -> Result<(Vec<ViewSpec>, Vec<StatusItemSpec>), String> {
    if api_version < 2 {
        return Ok((Vec::new(), Vec::new()));
    }
    let views: Vec<ViewSpec> = read(views_raw, "views")?;
    let status_items: Vec<StatusItemSpec> = read(status_raw, "statusItems")?;
    if views.len() > MAX_VIEWS {
        return Err(format!("A plugin can add at most {MAX_VIEWS} views."));
    }
    for (index, view) in views.iter().enumerate() {
        if !is_valid_id(&view.id) || views[..index].iter().any(|earlier| earlier.id == view.id) {
            return Err(format!("View \"{}\" needs a unique id (letters, digits, '-', 1-32 characters).", view.id));
        }
        if !view.title.is_filled() {
            return Err(format!("View \"{}\" needs a title in both languages.", view.id));
        }
        if !VIEW_ICONS.contains(&view.icon.as_str()) {
            return Err(format!("View \"{}\" uses the icon \"{}\", which is not in the list of allowed icons.", view.id, view.icon));
        }
        check_webview(view)?;
    }
    if status_items.len() > MAX_STATUS_ITEMS {
        return Err(format!("A plugin can add at most {MAX_STATUS_ITEMS} status items."));
    }
    for (index, item) in status_items.iter().enumerate() {
        if !is_valid_id(&item.id) || status_items[..index].iter().any(|earlier| earlier.id == item.id) {
            return Err(format!("Status item \"{}\" needs a unique id (letters, digits, '-', 1-32 characters).", item.id));
        }
        if item.priority.abs() > MAX_PRIORITY {
            return Err(format!("Status item \"{}\" has a priority outside -{MAX_PRIORITY}..{MAX_PRIORITY}.", item.id));
        }
    }
    Ok((views, status_items))
}
