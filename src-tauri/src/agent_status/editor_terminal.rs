use std::{fs, path::Path};

use serde_json::Value;

const EXTENSION_IDS: [&str; 2] = ["tixxin.fuyu", "tixxin.focusd-island"];

const EDITORS: &[(&str, &str, &str)] = &[
    ("code", "vscode", ".vscode"),
    ("code - insiders", "vscode-insiders", ".vscode-insiders"),
    ("cursor", "cursor", ".cursor"),
    ("windsurf", "windsurf", ".windsurf"),
    ("vscodium", "vscodium", ".vscode-oss"),
    ("trae", "trae", ".trae"),
    ("kiro", "kiro", ".kiro"),
];

pub(super) fn editor_of_app(app: &str) -> Option<(&'static str, &'static str)> {
    EDITORS
        .iter()
        .find(|(name, _, _)| *name == app)
        .map(|&(_, scheme, folder)| (scheme, folder))
}

pub(super) fn installed_extension(extensions_dir: &Path) -> Option<&'static str> {
    EXTENSION_IDS.into_iter().find(|id| extension_installed(extensions_dir, id))
}

fn extension_installed(extensions_dir: &Path, id: &str) -> bool {
    let obsolete = fs::read_to_string(extensions_dir.join(".obsolete"))
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .unwrap_or(Value::Null);
    let prefix = format!("{id}-");
    let Ok(entries) = fs::read_dir(extensions_dir) else {
        return false;
    };
    entries.flatten().any(|entry| {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_version = name
            .to_lowercase()
            .strip_prefix(&prefix)
            .is_some_and(|version| version.starts_with(|c: char| c.is_ascii_digit()));
        is_version && entry.path().is_dir() && obsolete[&name] != true
    })
}

pub(super) fn focus_link(scheme: &str, extension: &str, chain: &[u32], title: Option<&str>) -> String {
    let pids = chain.iter().map(u32::to_string).collect::<Vec<_>>().join(",");
    let mut link = format!("{scheme}://{extension}/focus?pids={pids}");
    if let Some(title) = title.filter(|title| !title.is_empty()) {
        link.push_str("&title=");
        link.push_str(&percent_encode(title));
    }
    link
}

fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (byte as char).to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum EditorTerminal {
    Sent,
    NoExtension,
    Failed,
}

pub(super) fn show_session_terminal(
    home_dir: &Path,
    app: &str,
    chain: &[u32],
    title: Option<&str>,
) -> Option<EditorTerminal> {
    let (scheme, folder) = editor_of_app(app)?;
    let Some(extension) = installed_extension(&home_dir.join(folder).join("extensions")) else {
        return Some(EditorTerminal::NoExtension);
    };
    if chain.is_empty() && title.is_none_or(str::is_empty) {
        return Some(EditorTerminal::Failed);
    }
    let opened = tauri_plugin_opener::open_url(focus_link(scheme, extension, chain, title), None::<&str>);
    Some(if opened.is_ok() { EditorTerminal::Sent } else { EditorTerminal::Failed })
}
