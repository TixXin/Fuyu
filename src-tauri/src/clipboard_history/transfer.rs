use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, path::PathBuf};

use crate::user_error::UserError;
use super::{
    current_unix_millis, snippets::ClipboardSnippet, ClipboardHistoryItem, ClipboardHistoryItemKind,
    ClipboardHistoryService,
};

const APP: &str = "fuyu-clipboard";
const LEGACY_APPS: [&str; 1] = ["fly-island-clipboard"];
const VERSION: u32 = 1;
const MAX_IMPORT_BYTES: usize = 512 * 1024 * 1024;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportedEntry {
    #[serde(flatten)]
    item: ClipboardHistoryItem,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    image_png: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportFile {
    app: String,
    version: u32,
    exported_at: i64,
    items: Vec<ExportedEntry>,
    #[serde(default)]
    snippets: Vec<ClipboardSnippet>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    items: usize,
    snippets: usize,
}

fn free_path(dir: &std::path::Path, stamp: &str) -> PathBuf {
    let base = format!("{APP}-{stamp}");
    (1..)
        .map(|n| dir.join(if n == 1 { format!("{base}.json") } else { format!("{base} ({n}).json") }))
        .find(|path| !path.exists())
        .unwrap_or_else(|| dir.join(format!("{base}.json")))
}

fn parse_export(content: &str) -> Result<ExportFile, UserError> {
    let file: ExportFile = serde_json::from_str(content)
        .map_err(|_| UserError::new("clipboard.notExport", "This is not a clipboard file exported from Fuyu."))?;
    let known = file.app == APP || LEGACY_APPS.contains(&file.app.as_str());
    if !known || file.version > VERSION {
        return Err(UserError::new(
            "clipboard.newerExport",
            "This is not a clipboard file exported from Fuyu, or it comes from a newer version.",
        ));
    }
    Ok(file)
}

impl ClipboardHistoryService {
    pub(super) fn export(&self) -> Result<String, UserError> {
        let _ = self.flush_persisted();
        let (items, snippets) = {
            let state = self.state.lock().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
            (state.items.clone(), state.snippets.clone())
        };
        let items = items
            .into_iter()
            .map(|item| {
                let image_png = item
                    .image
                    .as_ref()
                    .and_then(|image| fs::read(&image.original_path).ok())
                    .map(|bytes| general_purpose::STANDARD.encode(bytes));
                ExportedEntry { item, image_png }
            })
            .collect();
        let file = ExportFile { app: APP.into(), version: VERSION, exported_at: current_unix_millis(), items, snippets };
        let content = serde_json::to_string(&file).map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
        let dir = crate::system::downloads_dir().ok_or_else(|| UserError::new("file.noDownloads", "The Downloads folder was not found."))?;
        let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M").to_string();
        let path = free_path(&dir, &stamp);
        fs::write(&path, content).map_err(|error| {
            UserError::new("file.write", format!("Could not write {}.", path.display()))
                .arg("path", path.display().to_string())
                .detail(error)
        })?;
        Ok(path.to_string_lossy().into_owned())
    }

    pub(super) fn import(&self, content: &str) -> Result<ImportReport, UserError> {
        if content.len() > MAX_IMPORT_BYTES {
            return Err(UserError::new("clipboard.importTooLarge", "The clipboard file is too large."));
        }
        let file = parse_export(content)?;
        let mut seen: HashSet<String> = self
            .state
            .lock()
            .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
            .items
            .iter()
            .map(|item| item.hash.clone())
            .collect();
        let mut added = Vec::new();
        for ExportedEntry { mut item, image_png } in file.items {
            if seen.contains(&item.hash) {
                continue;
            }
            if item.kind == ClipboardHistoryItemKind::Image {
                let Some(rgba) = image_png
                    .and_then(|png| general_purpose::STANDARD.decode(png).ok())
                    .and_then(|bytes| image::load_from_memory(&bytes).ok())
                    .map(|image| image.to_rgba8())
                else {
                    continue;
                };
                let (width, height) = (rgba.width() as usize, rgba.height() as usize);
                item.image = Some(self.persist_image(&item.hash, width, height, rgba.into_raw())?);
            }
            seen.insert(item.hash.clone());
            added.push(item);
        }

        let mut state = self.state.lock().map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
        let items = added.len();
        state.items.extend(added);
        state.items.sort_by_key(|item| std::cmp::Reverse(item.copied_at));
        let mut snippets = 0;
        let state_ref = &mut *state;
        crate::sync::clock::with(|clock, wall| {
            for snippet in file.snippets {
                if !state_ref.snippets.iter().any(|kept| kept.text() == snippet.text()) {
                    super::snippets::adopt(&mut state_ref.snippets, &mut state_ref.snippet_tombstones, snippet, clock, wall);
                    snippets += 1;
                }
            }
        });
        self.enforce_limit_locked(&mut state);
        self.persist_locked(&state)?;
        drop(state);
        self.flush_persisted()?;
        self.emit_changed();
        Ok(ImportReport { items, snippets })
    }
}

#[cfg(test)]
mod tests {
    use super::{free_path, parse_export};

    #[test]
    fn export_names_do_not_overwrite() {
        let dir = std::env::temp_dir().join(format!("fuyu-export-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let first = free_path(&dir, "2026-11-09-1430");
        assert!(first.ends_with("fuyu-clipboard-2026-11-09-1430.json"));
        std::fs::write(&first, "{}").expect("write");
        assert!(free_path(&dir, "2026-11-09-1430").ends_with("fuyu-clipboard-2026-11-09-1430 (2).json"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn file(app: &str, version: u32) -> String {
        format!(r#"{{"app":"{app}","version":{version},"exportedAt":0,"items":[]}}"#)
    }

    #[test]
    fn imports_new_and_legacy_files() {
        assert!(parse_export(&file("fuyu-clipboard", 1)).is_ok());
        assert!(parse_export(&file("fly-island-clipboard", 1)).is_ok());
    }

    #[test]
    fn rejects_unknown_apps_and_newer_versions() {
        assert_eq!(parse_export(&file("other-clipboard", 1)).err().map(|e| e.code()), Some("clipboard.newerExport"));
        assert_eq!(parse_export(&file("fuyu-clipboard", 2)).err().map(|e| e.code()), Some("clipboard.newerExport"));
        assert_eq!(parse_export("not json").err().map(|e| e.code()), Some("clipboard.notExport"));
    }
}
