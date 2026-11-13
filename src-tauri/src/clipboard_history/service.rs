use base64::{engine::general_purpose, Engine as _};
use image::RgbaImage;
use std::{fs, path::Path, time::Duration};
use tauri::{Emitter, Manager};

use super::clipboard_io::{
    quoted_path, read_clipboard_capture, write_clipboard_file, write_clipboard_files,
    write_clipboard_html, write_clipboard_image, write_clipboard_text, CaptureKinds,
    ClipboardCapture,
};
use super::secrets::{looks_like_secret, mask};
use super::hotkey::{request_hotkey_refresh, HOTKEY_EVENT};
use super::store::{
    create_item_id, encode_png, make_thumbnail, PersistedClipboardHistory, MAX_IMAGE_PNG_BYTES,
};
use super::{
    current_unix_millis, ClipboardHistoryImage, ClipboardHistoryItem, ClipboardSource, SecretHandling,
    ClipboardHistoryItemKind, ClipboardHistoryService, CopyAs, ClipboardHistorySettings,
    ClipboardHistorySnapshot, ClipboardHistoryState, HISTORY_CHANGED_EVENT,
    SHORT_DUPLICATE_WINDOW_MS,
};

const DAY_MS: i64 = 24 * 60 * 60 * 1000;

pub(super) fn is_expired(copied_at: i64, cutoff: i64) -> bool {
    copied_at < cutoff
}

const UNDO_WINDOW: Duration = Duration::from_secs(10);

const TEXT_FILE_KEEP: Duration = Duration::from_secs(60 * 60);

pub(super) fn remove_files_older_than(dir: &Path, age: Duration) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let old = entry.metadata().ok().filter(|meta| meta.is_file()).and_then(|meta| meta.modified().ok()).and_then(|time| time.elapsed().ok()).is_some_and(|elapsed| elapsed > age);
        if old {
            let _ = fs::remove_file(entry.path());
        }
    }
}

pub(super) fn remove_unreferenced_images(dir: &Path, items: &[ClipboardHistoryItem]) {
    let name = |path: &str| Path::new(path).file_name().map(|name| name.to_string_lossy().to_lowercase());
    let kept: std::collections::HashSet<String> = items
        .iter()
        .filter_map(|item| item.image.as_ref())
        .flat_map(|image| [name(&image.original_path), name(&image.thumbnail_path)])
        .flatten()
        .collect();
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("png")) && !path.file_name().is_some_and(|file| kept.contains(&file.to_string_lossy().to_lowercase())) {
            let _ = fs::remove_file(path);
        }
    }
}

const PATH_CAPTURE_PAUSE: Duration = Duration::from_millis(800);



impl ClipboardHistoryService {
    pub(super) fn snapshot(&self) -> Result<ClipboardHistorySnapshot, String> {
        let state = self.state.lock().map_err(|error| error.to_string())?;
        Ok(Self::snapshot_locked(&state))
    }

    pub(super) fn set_settings(
        &self,
        settings: ClipboardHistorySettings,
    ) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        state.settings = settings.normalized();
        self.enforce_limit_locked(&mut state);
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        request_hotkey_refresh();
        Ok(snapshot)
    }

    pub(super) fn copy_item(&self, id: &str) -> Result<ClipboardHistorySnapshot, String> {
        self.copy_item_as(id, CopyAs::Original)
    }

    pub(super) fn copy_item_as(&self, id: &str, copy_as: CopyAs) -> Result<ClipboardHistorySnapshot, String> {
        let item = {
            let state = self.state.lock().map_err(|error| error.to_string())?;
            state
                .items
                .iter()
                .find(|item| item.id == id)
                .cloned()
                .ok_or_else(|| "Clipboard history item was not found.".to_string())?
        };

        match (item.kind, copy_as) {
            (ClipboardHistoryItemKind::Text, copy_as) => {
                let text = item
                    .text
                    .clone()
                    .ok_or_else(|| "Clipboard text item has no text.".to_string())?;
                match (&item.html, copy_as) {
                    (_, CopyAs::TextFile) => write_clipboard_file(&self.write_text_file(&text)?)?,
                    (Some(html), CopyAs::Original) => write_clipboard_html(html, &text)?,
                    _ => write_clipboard_text(&text)?,
                }
            }
            (ClipboardHistoryItemKind::Files, copy_as) => {
                let files = item.files.clone().unwrap_or_default();
                if copy_as == CopyAs::Plain || copy_as == CopyAs::Path {
                    super::suspend_clipboard_capture(PATH_CAPTURE_PAUSE);
                    let quoted: Vec<String> = files.iter().map(|path| quoted_path(Path::new(path))).collect();
                    write_clipboard_text(&quoted.join(" "))?;
                } else {
                    write_clipboard_files(&files)?;
                }
            }
            (ClipboardHistoryItemKind::Image, CopyAs::Text) => {
                let text = item.ocr_text.clone().ok_or_else(|| "No text was read in this image.".to_string())?;
                write_clipboard_text(&text)?;
            }
            (ClipboardHistoryItemKind::Image, copy_as) => {
                let image = item
                    .image
                    .as_ref()
                    .ok_or_else(|| "Clipboard image item has no image.".to_string())?;
                if copy_as == CopyAs::Path || copy_as == CopyAs::Plain {
                    super::suspend_clipboard_capture(PATH_CAPTURE_PAUSE);
                    write_clipboard_text(&quoted_path(Path::new(&image.original_path)))?;
                } else {
                    let rgba = image::open(&image.original_path)
                        .map_err(|error| format!("Failed to load clipboard image: {error}"))?
                        .to_rgba8();
                    write_clipboard_image(rgba.width() as usize, rgba.height() as usize, &rgba)?;
                    if copy_as == CopyAs::File {
                        write_clipboard_file(Path::new(&image.original_path))?;
                    }
                }
            }
        }

        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        state.last_capture_hash = Some(item.hash.clone());
        if let Some(index) = state
            .items
            .iter()
            .position(|history_item| history_item.hash == item.hash)
        {
            let mut moved_item = state.items.remove(index);
            moved_item.copied_at = current_unix_millis();
            state.items.insert(0, moved_item);
            self.persist_locked(&state)?;
        }
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn toggle_favorite(&self, id: &str) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        let item = state
            .items
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "Clipboard history item was not found.".to_string())?;
        item.favorite = !item.favorite;
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn set_note(
        &self,
        id: &str,
        note: &str,
    ) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        let item = state
            .items
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "Clipboard history item was not found.".to_string())?;
        let (note, tags) = super::split_note_tags(note);
        item.note = note;
        item.tags = tags;
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn delete_item(&self, id: &str) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        if let Some(index) = state.items.iter().position(|item| item.id == id) {
            let item = state.items.remove(index);
            if let Some((earlier, _)) = state.recently_deleted.replace((item, index)) {
                self.remove_item_files(&earlier);
            }
            self.persist_locked(&state)?;
            let id = id.to_string();
            std::thread::spawn(move || {
                std::thread::sleep(UNDO_WINDOW);
                if let Ok(service) = super::service() {
                    service.forget_deleted(&id);
                }
            });
        }
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    pub(super) fn restore_item(&self, id: &str) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        if state.recently_deleted.as_ref().is_some_and(|(item, _)| item.id == id) {
            if let Some((item, index)) = state.recently_deleted.take() {
                let index = index.min(state.items.len());
                state.items.insert(index, item);
                self.persist_locked(&state)?;
            }
        }
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    fn forget_deleted(&self, id: &str) {
        let Ok(mut state) = self.state.lock() else { return };
        if state.recently_deleted.as_ref().is_some_and(|(item, _)| item.id == id) {
            if let Some((item, _)) = state.recently_deleted.take() {
                self.remove_item_files(&item);
            }
        }
    }

    pub(super) fn clear(&self) -> Result<ClipboardHistorySnapshot, String> {
        let mut state = self.state.lock().map_err(|error| error.to_string())?;
        for item in state.items.iter().filter(|item| !item.favorite) {
            self.remove_item_files(item);
        }
        state.items.retain(|item| item.favorite);
        self.persist_locked(&state)?;
        let snapshot = Self::snapshot_locked(&state);
        drop(state);

        self.emit_changed();
        Ok(snapshot)
    }

    fn write_text_file(&self, text: &str) -> Result<std::path::PathBuf, String> {
        let dir = self.image_dir.with_file_name("clipboard-text");
        fs::create_dir_all(&dir).map_err(|error| format!("Failed to create the text file folder: {error}"))?;
        remove_files_older_than(&dir, TEXT_FILE_KEEP);
        let path = dir.join(format!("{}.txt", text_file_stem(text)));
        fs::write(&path, text).map_err(|error| format!("Failed to write the text file: {error}"))?;
        Ok(path)
    }

    pub(super) fn capture_current_clipboard(&self) {
        if super::clipboard_capture_suspended() {
            return;
        }
        if super::capture_pause::skips_capture(current_unix_millis()) {
            return;
        }

        let settings = match self.state.lock() {
            Ok(state) => state.settings.clone(),
            Err(error) => {
                eprintln!("failed to lock clipboard history state: {error}");
                return;
            }
        };

        if !settings.enabled {
            return;
        }
        if settings.skip_sensitive && super::system::is_marked_private() {
            return;
        }

        let source = source_app();
        if source.as_ref().is_some_and(|source| is_excluded(&settings.excluded_apps, &source.path)) {
            return;
        }

        let kinds = CaptureKinds { images: settings.capture_images, files: settings.capture_files, html: settings.capture_html };
        let capture = match read_clipboard_capture(kinds) {
            Ok(Some(capture)) => capture,
            Ok(None) => return,
            Err(error) => {
                eprintln!("failed to read clipboard: {error}");
                return;
            }
        };

        let secret = matches!(&capture, ClipboardCapture::Text { text, .. } if looks_like_secret(text));
        if secret && settings.secrets == SecretHandling::Skip {
            return;
        }
        let masked = secret && settings.secrets == SecretHandling::Mask;

        if let Err(error) = self.insert_capture(capture, source, masked) {
            eprintln!("failed to store clipboard history item: {error}");
        }
    }

    pub(super) fn insert_capture(&self, capture: ClipboardCapture, source: Option<ClipboardSource>, masked: bool) -> Result<(), String> {
        let now = current_unix_millis();
        let hash = capture.hash().to_string();
        let mut state = self.state.lock().map_err(|error| error.to_string())?;

        if state.last_capture_hash.as_deref() == Some(hash.as_str()) {
            return Ok(());
        }
        state.last_capture_hash = Some(hash.clone());

        if let Some(first) = state.items.first() {
            if first.hash == hash
                && now.saturating_sub(first.copied_at) <= SHORT_DUPLICATE_WINDOW_MS
            {
                return Ok(());
            }
        }

        if let Some(index) = state.items.iter().position(|item| item.hash == hash) {
            let mut item = state.items.remove(index);
            item.copied_at = now;
            state.items.insert(0, item);
            self.persist_locked(&state)?;
            drop(state);
            self.emit_changed();
            return Ok(());
        }

        let base = |hash: String, kind, preview| ClipboardHistoryItem {
            id: create_item_id(now, &hash),
            kind,
            hash,
            created_at: now,
            copied_at: now,
            favorite: false,
            note: String::new(),
            preview,
            text: None,
            image: None,
            html: None,
            files: None,
            source: source.clone(),
            tags: Vec::new(),
            ocr_text: None,
            masked: false,
        };
        let item = match capture {
            ClipboardCapture::Text { hash, text, preview, html } => ClipboardHistoryItem {
                preview: if masked { mask(&text) } else { preview },
                text: Some(text),
                html,
                masked,
                ..base(hash, ClipboardHistoryItemKind::Text, String::new())
            },
            ClipboardCapture::Files { hash, paths, preview } => ClipboardHistoryItem {
                files: Some(paths),
                ..base(hash, ClipboardHistoryItemKind::Files, preview)
            },
            ClipboardCapture::Image { hash, width, height, rgba } => {
                let image = self.persist_image(&hash, width, height, rgba)?;
                ClipboardHistoryItem {
                    image: Some(image),
                    ..base(hash, ClipboardHistoryItemKind::Image, format!("{width} x {height} image"))
                }
            }
        };

        let ocr_job = (state.settings.ocr)
            .then(|| item.image.as_ref().map(|image| (item.id.clone(), image.original_path.clone())))
            .flatten();
        state.items.insert(0, item);
        self.enforce_limit_locked(&mut state);
        self.persist_locked(&state)?;
        drop(state);

        self.emit_changed();
        if let Some((id, path)) = ocr_job {
            std::thread::spawn(move || {
                if let Some(text) = read_image_text(&path) {
                    if let Ok(service) = super::service() {
                        service.set_ocr_text(&id, text);
                    }
                }
            });
        }
        Ok(())
    }

    fn set_ocr_text(&self, id: &str, text: String) {
        let Ok(mut state) = self.state.lock() else {
            return;
        };
        let Some(item) = state.items.iter_mut().find(|item| item.id == id) else {
            return;
        };
        item.ocr_text = Some(text);
        if self.persist_locked(&state).is_ok() {
            drop(state);
            self.emit_changed();
        }
    }

    pub(super) fn persist_image(
        &self,
        hash: &str,
        width: usize,
        height: usize,
        rgba: Vec<u8>,
    ) -> Result<ClipboardHistoryImage, String> {
        let rgba_image = RgbaImage::from_raw(width as u32, height as u32, rgba)
            .ok_or_else(|| "Clipboard image data is invalid.".to_string())?;
        let original_bytes = encode_png(&rgba_image)?;

        if original_bytes.len() > MAX_IMAGE_PNG_BYTES {
            return Err("Clipboard image is larger than the history limit.".to_string());
        }

        let thumbnail = make_thumbnail(&rgba_image);
        let thumbnail_bytes = encode_png(&thumbnail)?;
        let safe_hash = hash.chars().take(24).collect::<String>();
        let original_path = self.image_dir.join(format!("{safe_hash}.png"));
        let thumbnail_path = self.image_dir.join(format!("{safe_hash}-thumb.png"));

        fs::write(&original_path, &original_bytes)
            .map_err(|error| format!("Failed to write clipboard image: {error}"))?;
        fs::write(&thumbnail_path, &thumbnail_bytes)
            .map_err(|error| format!("Failed to write clipboard image thumbnail: {error}"))?;

        Ok(ClipboardHistoryImage {
            width,
            height,
            byte_size: original_bytes.len() as u64,
            original_path: original_path.to_string_lossy().to_string(),
            thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
            thumbnail_data_url: Some(format!(
                "data:image/png;base64,{}",
                general_purpose::STANDARD.encode(thumbnail_bytes)
            )),
        })
    }

    pub(super) fn enforce_limit_locked(&self, state: &mut ClipboardHistoryState) {
        let days = state.settings.retention_days;
        if days > 0 {
            let cutoff = current_unix_millis().saturating_sub(i64::from(days) * DAY_MS);
            let (kept, expired): (Vec<_>, Vec<_>) = std::mem::take(&mut state.items)
                .into_iter()
                .partition(|item| item.favorite || !is_expired(item.copied_at, cutoff));
            for item in &expired {
                self.remove_item_files(item);
            }
            state.items = kept;
        }
        while state.items.len() > state.settings.max_items {
            let removal_index = state
                .items
                .iter()
                .rposition(|item| !item.favorite)
                .or_else(|| state.items.len().checked_sub(1));
            let Some(removal_index) = removal_index else {
                break;
            };

            let item = state.items.remove(removal_index);
            self.remove_item_files(&item);
        }
    }

    pub(super) fn persist_locked(&self, state: &ClipboardHistoryState) -> Result<(), String> {
        let history = PersistedClipboardHistory {
            settings: state.settings.clone(),
            items: state.items.clone(),
            snippets: state.snippets.clone(),
        };
        let content = serde_json::to_string_pretty(&history)
            .map_err(|error| format!("Failed to serialize clipboard history: {error}"))?;
        crate::fs_write::replace_file(&self.history_path, content.as_bytes())
            .map_err(|error| format!("Failed to write clipboard history: {error}"))
    }

    fn remove_item_files(&self, item: &ClipboardHistoryItem) {
        if let Some(image) = &item.image {
            let _ = fs::remove_file(&image.original_path);
            let _ = fs::remove_file(&image.thumbnail_path);
        }
    }

    pub(super) fn snapshot_locked(state: &ClipboardHistoryState) -> ClipboardHistorySnapshot {
        ClipboardHistorySnapshot {
            settings: state.settings.clone(),
            items: state.items.clone(),
            snippets: state.snippets.clone(),
            capture: super::capture_pause::status(current_unix_millis()),
        }
    }

    pub(super) fn emit_changed(&self) {
        let _ = self.app.emit(HISTORY_CHANGED_EVENT, ());
        let enabled = self.state.lock().map(|state| state.settings.enabled).unwrap_or(false);
        super::plugin_view::publish_changed(enabled);
    }

    pub(super) fn emit_shortcut(&self) {
        let settings = self.state.lock().map(|state| state.settings.clone()).ok();
        if let Some(settings) = settings.filter(|settings| settings.open_in == super::OpenIn::Window) {
            if let Err(error) = super::popup::toggle(&self.app, &settings) {
                eprintln!("failed to open the clipboard window: {error}");
            }
            return;
        }
        if let Some(window) = self.app.get_webview_window(crate::island::WINDOW_LABEL) {
            let _ = window.show();
            crate::island::focus::focus_island_for_shortcut(&window);
        }

        let _ = self.app.emit(HOTKEY_EVENT, ());
    }
}


fn read_image_text(path: &str) -> Option<String> {
    const OCR_MAX_SIDE: u32 = 2600;
    let image = image::open(path).ok()?;
    let image = if image.width() > OCR_MAX_SIDE || image.height() > OCR_MAX_SIDE {
        image.resize(OCR_MAX_SIDE, OCR_MAX_SIDE, image::imageops::FilterType::Triangle)
    } else {
        image
    };
    let rgba = image.to_rgba8();
    super::system::recognize_text(rgba.width(), rgba.height(), rgba.as_raw())
}

fn source_app() -> Option<ClipboardSource> {
    let path = super::system::source_app_path()?;
    let name = Path::new(&path).file_stem()?.to_string_lossy().into_owned();
    Some(ClipboardSource { path, name })
}

pub(super) fn text_file_stem(text: &str) -> String {
    let stem: String = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') && !c.is_control())
        .take(40)
        .collect();
    let stem = stem.trim().trim_end_matches('.').to_string();
    if stem.is_empty() { "clipboard".to_string() } else { stem }
}

#[cfg(test)]
#[test]
fn text_files_are_named_by_their_first_words() {
    assert_eq!(text_file_stem("  hello: world?\nsecond line"), "hello world second line");
    assert_eq!(text_file_stem("..."), "clipboard");
    assert_eq!(text_file_stem(&"字".repeat(60)).chars().count(), 40);
}

pub(super) fn is_excluded(excluded: &[String], path: &str) -> bool {
    let name = Path::new(path).file_name().map(|name| name.to_string_lossy().to_lowercase());
    name.is_some_and(|name| excluded.contains(&name))
}

#[cfg(test)]
#[test]
fn excluded_apps_match_by_executable_name() {
    let path = |parts: &[&str]| parts.iter().collect::<std::path::PathBuf>().to_string_lossy().into_owned();
    let excluded = vec!["keepass.exe".to_string(), "1password.app".to_string()];
    assert!(is_excluded(&excluded, &path(&["Program Files", "KeePass", "KeePass.exe"])));
    assert!(!is_excluded(&excluded, &path(&["Windows", "notepad.exe"])));
    assert!(is_excluded(&excluded, "/Applications/1Password.app"));
}

#[cfg(test)]
#[test]
fn entries_expire_after_the_retention_cutoff() {
    assert!(is_expired(999, 1000));
    assert!(!is_expired(1000, 1000));
}

#[cfg(test)]
#[test]
fn only_images_no_entry_refers_to_are_swept() {
    let dir = std::env::temp_dir().join(format!("fuyu-clip-sweep-{}", std::process::id()));
    fs::create_dir_all(&dir).expect("dir");
    for name in ["kept.png", "kept-thumb.png", "orphan.png", "notes.txt"] {
        fs::write(dir.join(name), b"x").expect("file");
    }
    let old = |name: &str| std::path::Path::new("old").join(name).to_string_lossy().into_owned();
    let item: ClipboardHistoryItem = serde_json::from_value(serde_json::json!({
        "id": "a", "kind": "image", "hash": "a", "createdAt": 0, "copiedAt": 0, "preview": "p", "text": null,
        "image": { "width": 1, "height": 1, "byteSize": 1, "originalPath": old("Kept.png"), "thumbnailPath": old("kept-thumb.png") }
    }))
    .expect("item");
    remove_unreferenced_images(&dir, &[item]);
    let mut left: Vec<String> = fs::read_dir(&dir).expect("read").flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect();
    left.sort();
    let _ = fs::remove_dir_all(&dir);
    assert_eq!(left, ["kept-thumb.png", "kept.png", "notes.txt"]);
}
