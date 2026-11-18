use std::{
    path::{Path, PathBuf},
    sync::{Arc, Condvar, Mutex, PoisonError},
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use super::store::PersistedClipboardHistory;

pub(super) const PERSIST_DEBOUNCE: Duration = Duration::from_millis(200);

pub(super) fn serialize_compact(history: &PersistedClipboardHistory) -> Result<Vec<u8>, String> {
    serde_json::to_vec(history)
        .map_err(|error| format!("Failed to serialize clipboard history: {error}"))
}

pub(super) fn write_history(path: &Path, history: &PersistedClipboardHistory) -> Result<(), String> {
    let bytes = serialize_compact(history)?;
    crate::fs_write::replace_file(path, &bytes)
        .map_err(|error| format!("Failed to write clipboard history: {error}"))
}

#[derive(Default)]
struct Queue {
    pending: Option<PersistedClipboardHistory>,
    dirty_since: Option<Instant>,
    due_at: Option<Instant>,
    queued_seq: u64,
    written_seq: u64,
    flush_upto: u64,
    last_error: Option<String>,
    closed: bool,
}

struct Shared {
    path: PathBuf,
    debounce: Duration,
    queue: Mutex<Queue>,
    wake: Condvar,
}

struct ExitGuard(Arc<Shared>);

impl Drop for ExitGuard {
    fn drop(&mut self) {
        let mut queue = self.0.queue.lock().unwrap_or_else(PoisonError::into_inner);
        queue.closed = true;
        self.0.wake.notify_all();
    }
}

pub(super) struct HistoryWriter {
    shared: Arc<Shared>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl HistoryWriter {
    pub(super) fn new(path: PathBuf, debounce: Duration) -> Self {
        Self {
            shared: Arc::new(Shared {
                path,
                debounce,
                queue: Mutex::new(Queue::default()),
                wake: Condvar::new(),
            }),
            worker: Mutex::new(None),
        }
    }

    pub(super) fn schedule(&self, history: PersistedClipboardHistory) -> Result<(), String> {
        let mut worker = self.worker.lock().unwrap_or_else(PoisonError::into_inner);
        let mut queue = self.shared.queue.lock().unwrap_or_else(PoisonError::into_inner);
        if queue.closed {
            drop(queue);
            drop(worker);
            return write_history(&self.shared.path, &history);
        }
        if worker.is_none() {
            let shared = Arc::clone(&self.shared);
            match thread::Builder::new()
                .name("clipboard-persist".into())
                .spawn(move || run_worker(shared))
            {
                Ok(handle) => *worker = Some(handle),
                Err(_) => {
                    drop(queue);
                    drop(worker);
                    return write_history(&self.shared.path, &history);
                }
            }
        }
        let now = Instant::now();
        let dirty_since = *queue.dirty_since.get_or_insert(now);
        let max_due = dirty_since + self.shared.debounce.saturating_mul(5);
        queue.due_at = Some((now + self.shared.debounce).min(max_due));
        queue.queued_seq += 1;
        queue.pending = Some(history);
        self.shared.wake.notify_all();
        Ok(())
    }

    pub(super) fn flush(&self) -> Result<(), String> {
        let mut queue = self.shared.queue.lock().unwrap_or_else(PoisonError::into_inner);
        let target = queue.queued_seq;
        if target == 0 {
            return Ok(());
        }
        if queue.written_seq < target {
            queue.flush_upto = queue.flush_upto.max(target);
            self.shared.wake.notify_all();
            while queue.written_seq < target && !queue.closed {
                queue = self.shared.wake.wait(queue).unwrap_or_else(PoisonError::into_inner);
            }
        }
        match &queue.last_error {
            Some(error) => Err(error.clone()),
            None => Ok(()),
        }
    }

    pub(super) fn shutdown(&self) {
        let handle = {
            let mut worker = self.worker.lock().unwrap_or_else(PoisonError::into_inner);
            let mut queue = self.shared.queue.lock().unwrap_or_else(PoisonError::into_inner);
            queue.closed = true;
            queue.flush_upto = queue.queued_seq;
            self.shared.wake.notify_all();
            drop(queue);
            worker.take()
        };
        if let Some(handle) = handle {
            let _ = handle.join();
        }
    }
}

impl Drop for HistoryWriter {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn run_worker(shared: Arc<Shared>) {
    let _guard = ExitGuard(Arc::clone(&shared));
    let mut queue = shared.queue.lock().unwrap_or_else(PoisonError::into_inner);
    loop {
        if queue.pending.is_none() {
            if queue.closed {
                break;
            }
            queue = shared.wake.wait(queue).unwrap_or_else(PoisonError::into_inner);
            continue;
        }
        let immediate = queue.closed || queue.flush_upto >= queue.queued_seq;
        if !immediate {
            if let Some(due) = queue.due_at {
                if let Some(wait) = due.checked_duration_since(Instant::now()) {
                    if !wait.is_zero() {
                        let (next_queue, _) = shared
                            .wake
                            .wait_timeout(queue, wait)
                            .unwrap_or_else(PoisonError::into_inner);
                        queue = next_queue;
                        continue;
                    }
                }
            }
        }
        let Some(history) = queue.pending.take() else {
            continue;
        };
        let seq = queue.queued_seq;
        queue.dirty_since = None;
        queue.due_at = None;
        drop(queue);
        let result = write_history(&shared.path, &history);
        queue = shared.queue.lock().unwrap_or_else(PoisonError::into_inner);
        queue.written_seq = seq;
        match result {
            Ok(()) => queue.last_error = None,
            Err(error) => {
                eprintln!("{error}");
                queue.last_error = Some(error);
            }
        }
        shared.wake.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        time::{Duration, Instant},
    };

    use super::{write_history, HistoryWriter};
    use crate::clipboard_history::{
        store::{load_history, PersistedClipboardHistory, HISTORY_VERSION},
        ClipboardHistoryItem, ClipboardHistorySettings,
    };

    fn sample_history(id: &str, note: &str) -> PersistedClipboardHistory {
        let item: ClipboardHistoryItem = serde_json::from_value(serde_json::json!({
            "id": id,
            "kind": "text",
            "hash": id,
            "createdAt": 10,
            "copiedAt": 20,
            "favorite": true,
            "note": note,
            "preview": id,
            "text": format!("content-{id}"),
            "tags": ["ops"]
        }))
        .expect("sample item");
        PersistedClipboardHistory {
            version: HISTORY_VERSION,
            settings: ClipboardHistorySettings::default(),
            items: vec![item],
            snippets: Vec::new(),
            snippet_tombstones: Vec::new(),
        }
    }

    #[test]
    fn rapid_schedules_coalesce_in_memory_and_write_compact_json_after_debounce() {
        let dir = std::env::temp_dir().join(format!("fuyu-clip-persist-debounce-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("clipboard-history.json");
        let writer = HistoryWriter::new(path.clone(), Duration::from_millis(120));

        for index in 0..5 {
            writer
                .schedule(sample_history(&format!("item-{index}"), &format!("note-{index}")))
                .expect("schedule");
        }
        assert!(!path.exists());

        let deadline = Instant::now() + Duration::from_secs(2);
        while !path.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(15));
        }
        assert!(path.exists());
        let raw = fs::read_to_string(&path).expect("read compact json");
        assert!(!raw.contains('\n'));
        let loaded = load_history(&path);
        assert_eq!(loaded.items.len(), 1);
        assert_eq!(loaded.items[0].id, "item-4");
        assert_eq!(loaded.items[0].note, "note-4");

        writer.shutdown();
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn flush_and_shutdown_persist_latest_change_without_waiting_for_debounce() {
        let dir = std::env::temp_dir().join(format!("fuyu-clip-persist-flush-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("clipboard-history.json");
        let writer = HistoryWriter::new(path.clone(), Duration::from_secs(30));

        writer.schedule(sample_history("first", "one")).expect("schedule first");
        writer.schedule(sample_history("second", "two")).expect("schedule second");
        let started = Instant::now();
        writer.flush().expect("flush");
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_eq!(load_history(&path).items[0].id, "second");

        writer.schedule(sample_history("final", "before-exit")).expect("schedule final");
        let shutdown_started = Instant::now();
        writer.shutdown();
        assert!(shutdown_started.elapsed() < Duration::from_secs(2));
        let loaded = load_history(&path);
        assert_eq!(loaded.items[0].id, "final");
        assert_eq!(loaded.items[0].note, "before-exit");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn compact_and_legacy_pretty_history_files_load_identically() {
        let dir = std::env::temp_dir().join(format!("fuyu-clip-persist-compat-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let pretty_path = dir.join("pretty.json");
        let compact_path = dir.join("compact.json");
        let original = sample_history("compat", "long note text");

        let pretty = serde_json::to_string_pretty(&original).expect("pretty json");
        assert!(pretty.contains('\n'));
        fs::write(&pretty_path, pretty).expect("write pretty");
        write_history(&compact_path, &original).expect("write compact");

        let from_pretty = load_history(&pretty_path);
        let from_compact = load_history(&compact_path);
        assert_eq!(from_pretty.items.len(), 1);
        assert_eq!(from_compact.items.len(), 1);
        assert_eq!(from_pretty.items[0].id, from_compact.items[0].id);
        assert_eq!(from_pretty.items[0].note, from_compact.items[0].note);
        assert_eq!(from_pretty.items[0].tags, from_compact.items[0].tags);
        assert_eq!(from_pretty.items[0].text, from_compact.items[0].text);

        let _ = fs::remove_dir_all(&dir);
    }
}
