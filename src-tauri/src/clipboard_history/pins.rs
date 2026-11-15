use super::{service, ClipboardHistoryItem, ClipboardHistoryService, ClipboardHistorySnapshot};

const RESERVED_KEYS: [char; 4] = ['E', 'I', 'N', 'U'];

const MAX_ORDER_IDS: usize = 1_000;

#[tauri::command]
pub fn set_clipboard_pin_key(id: String, key: Option<String>) -> Result<ClipboardHistorySnapshot, String> {
    let key = match key {
        Some(key) => Some(checked_key(&key)?),
        None => None,
    };
    service()?.update_pins(|items| assign_key(items, &id, key))
}

#[tauri::command]
pub fn set_clipboard_pin_order(ids: Vec<String>) -> Result<ClipboardHistorySnapshot, String> {
    if ids.len() > MAX_ORDER_IDS {
        return Err(format!("Too many entries at once (at most {MAX_ORDER_IDS})."));
    }
    service()?.update_pins(|items| {
        apply_order(items, &ids);
        Ok(())
    })
}

pub(super) fn checked_key(key: &str) -> Result<String, String> {
    let mut chars = key.trim().chars();
    match (chars.next(), chars.next()) {
        (Some(letter), None) if letter.is_ascii_alphabetic() && !RESERVED_KEYS.contains(&letter.to_ascii_uppercase()) => {
            Ok(letter.to_ascii_uppercase().to_string())
        }
        _ => Err(format!("A pin key is one letter from A to Z, except {}.", RESERVED_KEYS.iter().collect::<String>())),
    }
}

pub(super) fn assign_key(items: &mut [ClipboardHistoryItem], id: &str, key: Option<String>) -> Result<(), String> {
    if !items.iter().any(|item| item.id == id) {
        return Err("Clipboard history item was not found.".to_string());
    }
    for item in items.iter_mut() {
        if item.id == id {
            if key.is_some() {
                item.favorite = true;
            }
            item.pin_key = key.clone();
        } else if key.is_some() && item.pin_key == key {
            item.pin_key = None;
        }
    }
    Ok(())
}

pub(super) fn apply_order(items: &mut [ClipboardHistoryItem], ids: &[String]) {
    for item in items.iter_mut() {
        item.pin_order = ids.iter().position(|id| *id == item.id).and_then(|index| u32::try_from(index).ok());
    }
}

impl ClipboardHistoryService {
    fn update_pins(&self, change: impl FnOnce(&mut [ClipboardHistoryItem]) -> Result<(), String>) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        change(&mut state.items)?;
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> ClipboardHistoryItem {
        serde_json::from_value(serde_json::json!({
            "id": id, "kind": "text", "hash": id, "createdAt": 0, "copiedAt": 0, "preview": id, "text": id
        }))
        .expect("item")
    }

    #[test]
    fn keys_are_single_letters_without_the_dead_keys() {
        assert_eq!(checked_key("k").as_deref(), Ok("K"));
        assert_eq!(checked_key(" Z ").as_deref(), Ok("Z"));
        for bad in ["e", "N", "", "ab", "1", "é"] {
            assert!(checked_key(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn a_key_moves_to_the_new_entry_and_pins_it() {
        let mut items = vec![item("a"), item("b")];
        assign_key(&mut items, "a", Some("K".into())).expect("assign");
        assert!(items[0].favorite);
        assign_key(&mut items, "b", Some("K".into())).expect("assign");
        assert_eq!((items[0].pin_key.as_deref(), items[1].pin_key.as_deref()), (None, Some("K")));
        assert!(items[1].favorite);
        assign_key(&mut items, "b", None).expect("clear");
        assert_eq!(items[1].pin_key, None);
        assert!(items[1].favorite);
        assert!(assign_key(&mut items, "missing", None).is_err());
    }

    #[test]
    fn order_follows_the_list_and_old_entries_read_without_one() {
        let mut items = vec![item("a"), item("b"), item("c")];
        assert_eq!(items[0].pin_order, None);
        apply_order(&mut items, &["c".into(), "a".into()]);
        assert_eq!(items.iter().map(|item| item.pin_order).collect::<Vec<_>>(), [Some(1), None, Some(0)]);
        let json = serde_json::to_value(&items[1]).expect("json");
        assert!(json.get("pinOrder").is_none() && json.get("pinKey").is_none());
    }
}
