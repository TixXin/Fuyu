use super::{apply_image_edit, image_hash, remove_unused};
use crate::clipboard_history::edit::apply_undo;
use crate::clipboard_history::{ClipboardHistoryImage, ClipboardHistoryItem};

fn image(dir: &std::path::Path, name: &str, width: usize, height: usize) -> ClipboardHistoryImage {
    let original = dir.join(format!("{name}.png"));
    let thumbnail = dir.join(format!("{name}-thumb.png"));
    std::fs::write(&original, b"png").expect("write original");
    std::fs::write(&thumbnail, b"thumb").expect("write thumbnail");
    serde_json::from_value(serde_json::json!({
        "width": width, "height": height, "byteSize": 3,
        "originalPath": original.to_string_lossy(), "thumbnailPath": thumbnail.to_string_lossy(),
        "thumbnailDataUrl": format!("data:image/png;base64,{name}"),
    }))
    .expect("image")
}

fn item(image: &ClipboardHistoryImage) -> ClipboardHistoryItem {
    serde_json::from_value(serde_json::json!({
        "id": "a", "kind": "image", "hash": "old", "createdAt": 5, "copiedAt": 9, "favorite": true, "note": "keep",
        "preview": "40 x 30 image", "text": null, "image": image, "tags": ["work"], "ocrText": "old words",
        "source": { "path": "C:/shot.exe", "name": "Shot" },
    }))
    .expect("item")
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-edit-image-{name}-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir
}

#[test]
fn the_hash_is_the_one_a_capture_of_the_same_pixels_gets() {
    let mut input = Vec::new();
    input.extend_from_slice(&2usize.to_le_bytes());
    input.extend_from_slice(&1usize.to_le_bytes());
    input.extend_from_slice(&[1, 2, 3, 4, 5, 6, 7, 8]);
    assert_eq!(image_hash(2, 1, &[1, 2, 3, 4, 5, 6, 7, 8]), crate::clipboard_history::store::hash_bytes(&input));
    assert_ne!(image_hash(1, 2, &[1, 2, 3, 4, 5, 6, 7, 8]), image_hash(2, 1, &[1, 2, 3, 4, 5, 6, 7, 8]));
}

#[test]
fn a_replaced_image_keeps_the_entry_and_drops_the_old_words() {
    let dir = temp_dir("replace");
    let before = image(&dir, "old", 40, 30);
    let after = image(&dir, "new", 30, 20);
    let mut items = vec![item(&before)];
    let edit = apply_image_edit(&mut items, "a", after.clone(), "new".into(), 42).unwrap();
    assert!(edit.is_some());
    let edited = &items[0];
    assert_eq!((edited.id.as_str(), edited.created_at, edited.copied_at, edited.favorite), ("a", 5, 9, true));
    assert_eq!((edited.note.as_str(), edited.tags.clone()), ("keep", vec!["work".to_string()]));
    assert!(edited.source.is_some());
    assert_eq!((edited.hash.as_str(), edited.preview.as_str()), ("new", "30 x 20 image"));
    assert_eq!(edited.image.as_ref().map(|image| image.original_path.clone()), Some(after.original_path.clone()));
    assert_eq!((edited.ocr_text.clone(), edited.edited_at), (None, Some(42)));
    assert!(std::path::Path::new(&before.original_path).exists(), "the old file stays for undo");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn the_same_pixels_or_a_text_entry_is_not_an_image_edit() {
    let dir = temp_dir("same");
    let before = image(&dir, "old", 40, 30);
    let mut items = vec![item(&before)];
    assert!(apply_image_edit(&mut items, "a", before.clone(), "old".into(), 1).unwrap().is_none());
    assert!(apply_image_edit(&mut items, "missing", before.clone(), "x".into(), 1).is_err());
    let mut text: Vec<ClipboardHistoryItem> = vec![serde_json::from_value(serde_json::json!({
        "id": "t", "kind": "text", "hash": "t", "createdAt": 0, "copiedAt": 0, "preview": "hi", "text": "hi", "image": null,
    }))
    .unwrap()];
    assert!(apply_image_edit(&mut text, "t", before, "x".into(), 1).is_err());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn undo_points_back_at_the_old_file_and_its_words() {
    let dir = temp_dir("undo");
    let before = image(&dir, "old", 40, 30);
    let after = image(&dir, "new", 30, 20);
    let mut items = vec![item(&before)];
    let edit = apply_image_edit(&mut items, "a", after.clone(), "new".into(), 1_000).unwrap().unwrap();
    items[0].favorite = false;
    let undone = apply_undo(&mut items, "a", &edit, 7_000).unwrap();
    let restored = &items[0];
    assert_eq!((restored.hash.as_str(), restored.preview.as_str(), restored.ocr_text.as_deref()), ("old", "40 x 30 image", Some("old words")));
    assert_eq!(restored.image.as_ref().map(|image| image.original_path.clone()), Some(before.original_path.clone()));
    assert_eq!((restored.edited_at, restored.favorite), (None, false));
    let replaced = undone.image.expect("the undone image");
    assert!(remove_unused(&items, &replaced), "the edited file goes once nothing points at it");
    assert!(!std::path::Path::new(&after.original_path).exists() && !std::path::Path::new(&after.thumbnail_path).exists());
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_file_another_entry_still_uses_is_kept() {
    let dir = temp_dir("kept");
    let shared = image(&dir, "shared", 10, 10);
    let items = vec![item(&shared)];
    assert!(!remove_unused(&items, &shared));
    assert!(std::path::Path::new(&shared.original_path).exists());
    let edit_late = {
        let mut items = vec![item(&shared)];
        let edit = apply_image_edit(&mut items, "a", image(&dir, "later", 5, 5), "later".into(), 1_000).unwrap().unwrap();
        apply_undo(&mut items, "a", &edit, 20_000).is_err()
    };
    assert!(edit_late, "undo is refused once the window has passed");
    let _ = std::fs::remove_dir_all(&dir);
}
