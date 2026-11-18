use image::{imageops::FilterType, DynamicImage, ImageFormat, RgbaImage};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fs, io::Cursor, path::Path};

use super::{ClipboardHistoryItem, ClipboardHistoryItemKind, ClipboardHistorySettings};

pub(super) const HISTORY_FILE_NAME: &str = "clipboard-history.json";

pub(super) const HISTORY_VERSION: u32 = 3;

pub(super) const IMAGE_DIRECTORY_NAME: &str = "clipboard-images";

pub(super) const MAX_IMAGE_PNG_BYTES: usize = 10 * 1024 * 1024;

const THUMBNAIL_MAX_SIDE: u32 = 128;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PersistedClipboardHistory {
    #[serde(default)]
    pub(super) version: u32,
    pub(super) settings: ClipboardHistorySettings,
    pub(super) items: Vec<ClipboardHistoryItem>,
    #[serde(default)]
    pub(super) snippets: Vec<super::snippets::ClipboardSnippet>,
    #[serde(default)]
    pub(super) snippet_tombstones: Vec<crate::sync::Tombstone>,
    #[serde(default)]
    pub(super) favorite_tombstones: Vec<crate::sync::Tombstone>,
}

pub(super) fn referenced_image_names(items: &[ClipboardHistoryItem]) -> HashSet<String> {
    let file_name = |path: &str| Path::new(path).file_name().map(|name| name.to_string_lossy().to_lowercase());
    items
        .iter()
        .filter_map(|item| item.image.as_ref())
        .flat_map(|image| [file_name(&image.original_path), file_name(&image.thumbnail_path)])
        .flatten()
        .collect()
}

pub(super) fn strip_disk_backed_thumbnails(items: &mut [ClipboardHistoryItem]) {
    for item in items {
        let Some(image) = item.image.as_mut() else {
            continue;
        };
        if image.thumbnail_data_url.is_some()
            && !image.thumbnail_path.is_empty()
            && Path::new(&image.thumbnail_path).is_file()
        {
            image.thumbnail_data_url = None;
        }
    }
}

pub(super) fn item_with_protocol_thumbnail(item: &ClipboardHistoryItem) -> ClipboardHistoryItem {
    let mut clone = item.clone();
    if let Some(image) = clone.image.as_mut() {
        if image.thumbnail_data_url.is_none() && !image.thumbnail_path.is_empty() {
            image.thumbnail_data_url = Some(super::image_protocol::thumbnail_url(&clone.id, &clone.hash));
        }
    }
    clone
}

pub(super) fn migrate_settings(version: u32, mut settings: ClipboardHistorySettings) -> ClipboardHistorySettings {
    if version < HISTORY_VERSION {
        settings.hide_from_capture = false;
    }
    settings.normalized()
}

pub(super) fn load_history(history_path: &Path) -> PersistedClipboardHistory {
    fs::read_to_string(history_path)
        .ok()
        .and_then(|content| serde_json::from_str::<PersistedClipboardHistory>(&content).ok())
        .map(|mut history| {
            history.settings = migrate_settings(history.version, history.settings);
            history.version = HISTORY_VERSION;
            history.items.retain(|item| match item.kind {
                ClipboardHistoryItemKind::Text => {
                    item.text.as_ref().is_some_and(|text| !text.is_empty())
                }
                ClipboardHistoryItemKind::Image => item.image.is_some(),
                ClipboardHistoryItemKind::Files => item.files.as_ref().is_some_and(|files| !files.is_empty()),
            });
            strip_disk_backed_thumbnails(&mut history.items);
            crate::sync::clock::with(|clock, _| {
                super::snippets::fill_missing(&mut history.snippets, clock.device());
                super::favorites_sync::fill_missing(&mut history.items, clock.device());
            });
            crate::sync::clock::observe(super::snippets::all_stamps(&history.snippets, &history.snippet_tombstones));
            crate::sync::clock::observe(super::favorites_sync::all_stamps(&history.items, &history.favorite_tombstones));
            history
        })
        .unwrap_or_default()
}

pub(super) fn encode_png(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(image.clone())
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|error| format!("Failed to encode clipboard image: {error}"))?;
    Ok(bytes.into_inner())
}

pub(super) fn make_thumbnail(image: &RgbaImage) -> RgbaImage {
    let width = image.width().max(1);
    let height = image.height().max(1);
    let scale = (THUMBNAIL_MAX_SIDE as f32 / width.max(height) as f32).min(1.0);
    let thumbnail_width = ((width as f32 * scale).round() as u32).max(1);
    let thumbnail_height = ((height as f32 * scale).round() as u32).max(1);

    image::imageops::resize(
        image,
        thumbnail_width,
        thumbnail_height,
        FilterType::Lanczos3,
    )
}

pub(super) fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(super) fn preview_text(text: &str) -> String {
    const PREVIEW_LIMIT: usize = 140;
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if collapsed.chars().count() <= PREVIEW_LIMIT {
        return collapsed;
    }

    let mut preview = collapsed.chars().take(PREVIEW_LIMIT).collect::<String>();
    preview.push_str("...");
    preview
}

pub(super) fn create_item_id(timestamp: i64, hash: &str) -> String {
    let short_hash = hash.chars().take(12).collect::<String>();
    format!("{timestamp}-{short_hash}")
}

#[cfg(test)]
mod tests {
    use super::{item_with_protocol_thumbnail, load_history, strip_disk_backed_thumbnails, PersistedClipboardHistory, HISTORY_VERSION};
    use crate::clipboard_history::{privacy::effective_capture_protection, ClipboardHistoryItem, ClipboardHistorySettings};

    #[test]
    fn capture_hiding_defaults_to_off_migrates_old_history_and_yields_to_recording_mode() {
        assert!(!ClipboardHistorySettings::default().hide_from_capture);
        let dir = std::env::temp_dir().join(format!("fuyu-clip-migrate-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let hidden = ClipboardHistorySettings { hide_from_capture: true, ..ClipboardHistorySettings::default() };
        let v2 = dir.join("v2.json");
        let saved_v2 = PersistedClipboardHistory { version: 2, settings: hidden.clone(), ..PersistedClipboardHistory::default() };
        std::fs::write(&v2, serde_json::to_string(&saved_v2).expect("json")).expect("v2");
        let migrated = load_history(&v2);
        assert_eq!(migrated.version, HISTORY_VERSION);
        assert!(!migrated.settings.hide_from_capture);

        let v3 = dir.join("v3.json");
        let saved_v3 = PersistedClipboardHistory { version: HISTORY_VERSION, settings: hidden, ..PersistedClipboardHistory::default() };
        std::fs::write(&v3, serde_json::to_string(&saved_v3).expect("json")).expect("v3");
        assert!(load_history(&v3).settings.hide_from_capture);
        let _ = std::fs::remove_dir_all(&dir);

        assert!(!effective_capture_protection(false, false, false));
        assert!(effective_capture_protection(true, false, false));
        assert!(effective_capture_protection(false, true, false));
        assert!(!effective_capture_protection(true, false, true));
    }

    #[test]
    fn disk_backed_thumbnails_drop_inline_base64_and_resolve_protocol_urls() {
        let dir = std::env::temp_dir().join(format!("fuyu-clip-store-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let thumb = dir.join("h1-thumb.png");
        std::fs::write(&thumb, b"png").expect("thumb");
        let mut items: Vec<ClipboardHistoryItem> = serde_json::from_value(serde_json::json!([
            {
                "id": "disk", "kind": "image", "hash": "abcdef0123456789", "createdAt": 1, "copiedAt": 1, "preview": "p",
                "image": {
                    "width": 10, "height": 10, "byteSize": 3,
                    "originalPath": dir.join("h1.png").to_string_lossy(),
                    "thumbnailPath": thumb.to_string_lossy(),
                    "thumbnailDataUrl": "data:image/png;base64,legacy"
                }
            },
            {
                "id": "legacy", "kind": "image", "hash": "legacyhash", "createdAt": 1, "copiedAt": 1, "preview": "p",
                "image": {
                    "width": 10, "height": 10, "byteSize": 3,
                    "originalPath": "",
                    "thumbnailPath": dir.join("missing-thumb.png").to_string_lossy(),
                    "thumbnailDataUrl": "data:image/png;base64,keepme"
                }
            }
        ]))
        .expect("items");

        strip_disk_backed_thumbnails(&mut items);
        assert!(items[0].image.as_ref().expect("img0").thumbnail_data_url.is_none());
        assert_eq!(
            items[1].image.as_ref().expect("img1").thumbnail_data_url.as_deref(),
            Some("data:image/png;base64,keepme")
        );

        let resolved0 = item_with_protocol_thumbnail(&items[0]);
        let url0 = resolved0.image.as_ref().expect("img0").thumbnail_data_url.as_deref().expect("url0");
        assert!(url0.contains("/disk/thumb?v=abcdef0123456789"));

        let resolved1 = item_with_protocol_thumbnail(&items[1]);
        assert_eq!(
            resolved1.image.as_ref().expect("img1").thumbnail_data_url.as_deref(),
            Some("data:image/png;base64,keepme")
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
