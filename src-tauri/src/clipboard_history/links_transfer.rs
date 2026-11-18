use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::user_error::UserError;
use super::{
    current_unix_millis,
    links::{ClipboardLink, ClipboardLinks},
};

const APP: &str = "fuyu-links";
const VERSION: u32 = 1;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportFile<'a> {
    app: &'static str,
    version: u32,
    exported_at: i64,
    links: &'a [ClipboardLink],
}

#[derive(Deserialize)]
#[serde(untagged)]
enum ImportEntry {
    Link {
        url: String,
        #[serde(default)]
        title: String,
    },
    Url(String),
}

#[derive(Deserialize)]
struct ImportFile {
    links: Vec<ImportEntry>,
}

pub(super) fn export(links: &ClipboardLinks) -> Result<String, UserError> {
    let file = ExportFile { app: APP, version: VERSION, exported_at: current_unix_millis(), links: &links.links };
    let content = serde_json::to_string_pretty(&file)
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
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

fn free_path(dir: &std::path::Path, stamp: &str) -> PathBuf {
    let base = format!("{APP}-{stamp}");
    (1..)
        .map(|n| dir.join(if n == 1 { format!("{base}.json") } else { format!("{base} ({n}).json") }))
        .find(|path| !path.exists())
        .unwrap_or_else(|| dir.join(format!("{base}.json")))
}

pub(super) fn parse(content: &str) -> Vec<(String, String)> {
    let entries = serde_json::from_str::<ImportFile>(content)
        .map(|file| file.links)
        .or_else(|_| serde_json::from_str::<Vec<ImportEntry>>(content));
    match entries {
        Ok(entries) => entries
            .into_iter()
            .map(|entry| match entry {
                ImportEntry::Link { url, title } => (url, title),
                ImportEntry::Url(url) => (url, String::new()),
            })
            .collect(),
        Err(_) => content
            .lines()
            .map(str::trim)
            .filter(|line| line.starts_with("http://") || line.starts_with("https://"))
            .map(|line| (line.to_string(), String::new()))
            .collect(),
    }
}
