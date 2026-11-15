use std::{
    collections::HashSet,
    sync::atomic::{AtomicU64, Ordering},
    time::Duration,
};

use super::{service, ClipboardHistoryItem, ClipboardHistoryService, ClipboardHistorySnapshot};

const UNDO_WINDOW: Duration = Duration::from_secs(10);

const MAX_IDS: usize = 1_000;

static DELETE_GENERATION: AtomicU64 = AtomicU64::new(0);

pub(super) type Removed = Vec<(ClipboardHistoryItem, usize)>;

#[tauri::command]
pub fn delete_clipboard_history_items(ids: Vec<String>) -> Result<ClipboardHistorySnapshot, String> {
    service()?.delete_items(&checked(ids)?)
}

#[tauri::command]
pub fn restore_clipboard_history_items(ids: Vec<String>) -> Result<ClipboardHistorySnapshot, String> {
    service()?.restore_items(&checked(ids)?)
}

fn checked(ids: Vec<String>) -> Result<Vec<String>, String> {
    if ids.len() > MAX_IDS {
        return Err(format!("Too many entries at once (at most {MAX_IDS})."));
    }
    Ok(ids)
}

pub(super) fn take_items(items: &mut Vec<ClipboardHistoryItem>, ids: &[String]) -> Removed {
    let wanted: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let mut removed = Vec::new();
    let mut kept = Vec::with_capacity(items.len());
    for (index, item) in std::mem::take(items).into_iter().enumerate() {
        if wanted.contains(item.id.as_str()) {
            removed.push((item, index));
        } else {
            kept.push(item);
        }
    }
    *items = kept;
    removed
}

pub(super) fn put_back(items: &mut Vec<ClipboardHistoryItem>, removed: &mut Removed, ids: &[String]) -> bool {
    let wanted: HashSet<&str> = ids.iter().map(String::as_str).collect();
    let (mut back, left): (Removed, Removed) = std::mem::take(removed).into_iter().partition(|(item, _)| wanted.contains(item.id.as_str()));
    *removed = left;
    back.sort_by_key(|(_, index)| *index);
    let restored = !back.is_empty();
    for (item, index) in back {
        if items.iter().any(|existing| existing.id == item.id) {
            continue;
        }
        let index = index.min(items.len());
        items.insert(index, item);
    }
    restored
}

impl ClipboardHistoryService {
    pub(super) fn delete_items(&self, ids: &[String]) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        let removed = take_items(&mut state.items, ids);
        if !removed.is_empty() {
            for (earlier, _) in std::mem::replace(&mut state.recently_deleted, removed) {
                self.remove_item_files(&earlier);
            }
            self.persist_locked(&state)?;
            let generation = DELETE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
            std::thread::spawn(move || {
                std::thread::sleep(UNDO_WINDOW);
                if let Ok(service) = super::service() {
                    service.forget_deleted(generation);
                }
            });
        }
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn restore_items(&self, ids: &[String]) -> Result<ClipboardHistorySnapshot, String> {
        let mut guard = self.state.lock().map_err(|error| error.to_string())?;
        let state = &mut *guard;
        if put_back(&mut state.items, &mut state.recently_deleted, ids) {
            self.persist_locked(state)?;
        }
        let snapshot = Self::snapshot_locked(state);
        drop(guard);

        self.emit_changed();
        Ok(snapshot)
    }

    fn forget_deleted(&self, generation: u64) {
        if DELETE_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        let Ok(mut state) = self.state.lock() else { return };
        for (item, _) in std::mem::take(&mut state.recently_deleted) {
            self.remove_item_files(&item);
        }
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

    fn ids(items: &[ClipboardHistoryItem]) -> Vec<&str> {
        items.iter().map(|item| item.id.as_str()).collect()
    }

    fn strings(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| id.to_string()).collect()
    }

    #[test]
    fn several_entries_come_out_and_go_back_where_they_were() {
        let mut items: Vec<_> = ["a", "b", "c", "d", "e"].into_iter().map(item).collect();
        let mut removed = take_items(&mut items, &strings(&["d", "b", "missing", "a"]));
        assert_eq!(ids(&items), ["c", "e"]);
        assert_eq!(removed.iter().map(|(item, index)| (item.id.as_str(), *index)).collect::<Vec<_>>(), [("a", 0), ("b", 1), ("d", 3)]);
        assert!(put_back(&mut items, &mut removed, &strings(&["a", "b", "d"])));
        assert_eq!(ids(&items), ["a", "b", "c", "d", "e"]);
        assert!(removed.is_empty());
    }

    #[test]
    fn restoring_keeps_what_was_not_asked_for_and_skips_duplicates() {
        let mut items: Vec<_> = ["a", "b", "c"].into_iter().map(item).collect();
        let mut removed = take_items(&mut items, &strings(&["a", "c"]));
        items.push(item("c"));
        assert!(put_back(&mut items, &mut removed, &strings(&["c"])));
        assert_eq!(ids(&items), ["b", "c"]);
        assert_eq!(removed.len(), 1);
        assert!(!put_back(&mut items, &mut removed, &strings(&["zzz"])));
        assert!(put_back(&mut items, &mut removed, &strings(&["a"])));
        assert_eq!(ids(&items), ["a", "b", "c"]);
    }

    #[test]
    fn a_single_id_still_works_and_too_many_are_refused() {
        let mut items: Vec<_> = ["a", "b"].into_iter().map(item).collect();
        let removed = take_items(&mut items, &strings(&["b"]));
        assert_eq!((ids(&items), removed[0].1), (vec!["a"], 1));
        assert!(checked(vec![String::new(); MAX_IDS + 1]).is_err());
        assert!(checked(vec![String::new(); MAX_IDS]).is_ok());
    }
}
