use plugin_base::{host_service, ServeError};
use serde::Serialize;

use super::plugin_view::{text_items, ClipboardText, DEFAULT_LIMIT, MAX_LIMIT};
use super::{service, switched_on};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClipboardTexts {
    items: Vec<ClipboardText>,
}

pub(super) fn limit_of(limit: Option<u32>) -> Result<usize, ServeError> {
    match limit.map(usize::try_from) {
        None => Ok(DEFAULT_LIMIT),
        Some(Ok(limit)) if (1..=MAX_LIMIT).contains(&limit) => Ok(limit),
        Some(_) => Err(ServeError::bad_params("clipboard.history", format!("limit must be a whole number from 1 to {MAX_LIMIT}"))),
    }
}

fn texts(limit: Option<u32>) -> Result<ClipboardTexts, ServeError> {
    if !switched_on() {
        return Err(ServeError::new("inactive", "The clipboard plugin is switched off."));
    }
    let limit = limit_of(limit)?;
    let snapshot = service().and_then(|service| service.snapshot()).map_err(|error| ServeError::new("failed", error))?;
    Ok(ClipboardTexts { items: text_items(&snapshot.items, limit, true) })
}

#[host_service("clipboard.history")]
fn history_for_host(limit: Option<u32>) -> Result<ClipboardTexts, ServeError> {
    texts(limit)
}

#[tauri::command]
pub fn get_clipboard_texts(limit: Option<u32>) -> Result<ClipboardTexts, String> {
    texts(limit).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{limit_of, DEFAULT_LIMIT, MAX_LIMIT};

    #[test]
    fn the_history_limit_defaults_and_stays_in_range() {
        assert_eq!(limit_of(None).ok(), Some(DEFAULT_LIMIT));
        assert_eq!(limit_of(Some(1)).ok(), Some(1));
        assert_eq!(limit_of(Some(50)).ok(), Some(MAX_LIMIT));
        assert_eq!(limit_of(Some(0)).err().map(|error| error.code).as_deref(), Some("bad-params"));
        assert!(limit_of(Some(51)).is_err());
    }
}
