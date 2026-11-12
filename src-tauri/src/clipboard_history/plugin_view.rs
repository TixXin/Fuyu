use serde_json::{json, Value};

use super::{service, ClipboardHistoryItem, ClipboardHistoryItemKind};

const DEFAULT_LIMIT: usize = 20;
const MAX_LIMIT: usize = 50;
const MAX_TEXT_CHARS: usize = 4000;

pub(crate) fn plugin_history(params: &Value) -> Result<Value, (u16, String)> {
    let limit = match params.get("limit") {
        None | Some(Value::Null) => DEFAULT_LIMIT,
        Some(value) => value
            .as_u64()
            .and_then(|limit| usize::try_from(limit).ok())
            .filter(|limit| (1..=MAX_LIMIT).contains(limit))
            .ok_or_else(|| (400, format!("\"limit\" must be a whole number from 1 to {MAX_LIMIT}.")))?,
    };
    let snapshot = service().map_err(|error| (503, error))?.snapshot().map_err(|error| (500, error))?;
    if !snapshot.settings.enabled {
        return Err((409, "Clipboard history is switched off.".into()));
    }
    Ok(json!({ "items": text_items(&snapshot.items, limit, false) }))
}

pub(crate) fn local_api_history(params: &Value) -> Result<Value, (u16, String)> {
    let snapshot = service().map_err(|error| (503, error))?.snapshot().map_err(|error| (500, error))?;
    if !snapshot.settings.local_api_read {
        return Err((403, "Reading the clipboard history is off in Fuyu settings (Clipboard, Local API).".into()));
    }
    if !snapshot.settings.enabled {
        return Err((409, "Clipboard history is switched off.".into()));
    }
    let limit = params.get("limit").and_then(Value::as_u64).and_then(|limit| usize::try_from(limit).ok()).filter(|&limit| limit > 0).unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);
    Ok(json!({ "items": text_items(&snapshot.items, limit, true) }))
}

fn format_text_item(item: &ClipboardHistoryItem, hide_masked: bool) -> Value {
    let text = if hide_masked && item.masked {
        item.preview.as_str()
    } else {
        item.text.as_deref().unwrap_or_default()
    };
    let truncated = text.chars().count() > MAX_TEXT_CHARS;
    json!({
        "id": item.id,
        "text": if truncated { text.chars().take(MAX_TEXT_CHARS).collect::<String>() } else { text.to_string() },
        "truncated": truncated,
        "copiedAt": item.copied_at,
        "favorite": item.favorite,
    })
}

pub(super) fn text_items(items: &[ClipboardHistoryItem], limit: usize, hide_masked: bool) -> Vec<Value> {
    let mut texts: Vec<&ClipboardHistoryItem> = items
        .iter()
        .filter(|item| item.kind == ClipboardHistoryItemKind::Text && item.text.is_some())
        .collect();
    texts.sort_by_key(|item| std::cmp::Reverse(item.copied_at));
    texts
        .into_iter()
        .take(limit)
        .map(|item| format_text_item(item, hide_masked))
        .collect()
}

pub(crate) fn plugin_item(id: &str) -> Option<Value> {
    let snapshot = service().ok()?.snapshot().ok()?;
    if !snapshot.settings.enabled {
        return None;
    }
    snapshot
        .items
        .iter()
        .find(|item| item.id == id && item.kind == ClipboardHistoryItemKind::Text && item.text.is_some())
        .map(|item| format_text_item(item, false))
}

pub(super) fn publish_changed(enabled: bool) {
    if enabled {
        crate::plugin_host::publish_event("clipboard.changed", json!({}));
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{text_items, ClipboardHistoryItem, MAX_TEXT_CHARS};

    fn item(id: &str, kind: &str, copied_at: i64, text: Option<String>) -> ClipboardHistoryItem {
        serde_json::from_value(json!({
            "id": id, "kind": kind, "hash": id, "createdAt": 0, "copiedAt": copied_at,
            "preview": "p", "text": text, "image": null
        }))
        .expect("item")
    }

    #[test]
    fn plugins_get_newest_text_items_without_images() {
        let items = vec![
            item("old", "text", 1, Some("old".into())),
            item("img", "image", 9, None),
            item("new", "text", 5, Some("x".repeat(MAX_TEXT_CHARS + 10))),
        ];
        let seen = text_items(&items, 10, false);
        assert_eq!(seen.iter().map(|item| item["id"].as_str().unwrap_or("")).collect::<Vec<_>>(), vec!["new", "old"]);
        assert_eq!(seen[0]["truncated"], true);
        assert_eq!(seen[0]["text"].as_str().map(|text| text.chars().count()), Some(MAX_TEXT_CHARS));
        assert_eq!(seen[1]["truncated"], false);
        assert_eq!(text_items(&items, 1, false).len(), 1);
    }
}
