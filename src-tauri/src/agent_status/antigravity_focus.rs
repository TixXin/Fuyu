use std::{fs, path::Path};

use serde_json::Value;

const SAVED_DIR: &str = "agent-antigravity";
const IDE_APPS: [&str; 2] = ["antigravity ide", "antigravity-ide"];
const DESKTOP_APP: &str = "antigravity";
pub(super) const APPS: [&str; 3] = [IDE_APPS[0], IDE_APPS[1], DESKTOP_APP];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Product {
    Ide,
    Desktop,
    Cli,
}

impl Product {
    pub(super) fn label(self) -> &'static str {
        match self {
            Product::Ide => "ide",
            Product::Desktop => "desktop",
            Product::Cli => "cli",
        }
    }
}

pub(super) fn product_of_transcript(path: &str) -> Option<Product> {
    let parts: Vec<String> = path.split(['\\', '/']).map(str::to_ascii_lowercase).collect();
    parts.windows(2).find_map(|pair| match (pair[0].as_str(), pair[1].as_str()) {
        (".gemini", "antigravity-ide") => Some(Product::Ide),
        (".gemini", "antigravity") => Some(Product::Desktop),
        (".gemini", "antigravity-cli") => Some(Product::Cli),
        _ => None,
    })
}

pub(super) fn apps_for(product: Option<Product>) -> Vec<String> {
    let order: &[&str] = match product {
        Some(Product::Cli) => &[],
        Some(Product::Desktop) => &[DESKTOP_APP, IDE_APPS[0], IDE_APPS[1]],
        Some(Product::Ide) | None => &APPS,
    };
    order.iter().map(|app| app.to_string()).collect()
}

pub(super) fn transcript_of(input: &Value, session_id: &str) -> Option<Option<String>> {
    (input["conversationId"].as_str() == Some(session_id)).then(|| input["transcriptPath"].as_str().map(str::to_string))
}

pub(super) fn session_product(app_dir: &Path, session_id: &str) -> Option<Product> {
    let mut newest: Option<(std::time::SystemTime, Option<String>)> = None;
    for entry in fs::read_dir(app_dir.join(SAVED_DIR)).into_iter().flatten().flatten() {
        let Some(modified) = entry.metadata().ok().and_then(|meta| meta.modified().ok()) else {
            continue;
        };
        if newest.as_ref().is_some_and(|(at, _)| *at >= modified) {
            continue;
        }
        let input = fs::read_to_string(entry.path())
            .ok()
            .and_then(|text| serde_json::from_str::<Value>(text.trim_start_matches('\u{feff}').trim()).ok());
        if let Some(transcript) = input.as_ref().and_then(|input| transcript_of(input, session_id)) {
            newest = Some((modified, transcript));
        }
    }
    newest.and_then(|(_, transcript)| transcript).as_deref().and_then(product_of_transcript)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_status::window_focus::{app_name, preferred_window, SessionHints, WindowCandidate};
    use serde_json::json;

    #[test]
    fn knows_the_ide_and_the_desktop_app_by_their_program_names() {
        #[cfg(not(target_os = "macos"))]
        {
            assert_eq!(app_name(r"C:\Users\a\AppData\Local\Programs\Antigravity IDE\Antigravity IDE.exe"), "antigravity ide");
            assert_eq!(app_name(r"C:\Users\a\AppData\Local\Programs\antigravity\Antigravity.exe"), "antigravity");
        }
        #[cfg(target_os = "macos")]
        {
            assert_eq!(app_name("/Applications/Antigravity IDE.app/Contents/MacOS/Electron"), "antigravity ide");
            assert_eq!(app_name("/Applications/Antigravity.app/Contents/MacOS/Electron"), "antigravity");
        }
        for name in ["antigravity ide", "antigravity-ide", "antigravity"] {
            assert!(APPS.contains(&name));
        }
    }

    #[test]
    fn the_transcript_path_tells_which_product_ran_the_session() {
        let ide = r"C:\Users\a\.gemini\antigravity-ide\brain\c1\transcript_full.jsonl";
        assert_eq!(product_of_transcript(ide), Some(Product::Ide));
        assert_eq!(product_of_transcript("/Users/a/.gemini/antigravity/brain/c1/t.jsonl"), Some(Product::Desktop));
        assert_eq!(product_of_transcript("/home/a/.gemini/antigravity-cli/brain/c1/t.jsonl"), Some(Product::Cli));
        assert_eq!(product_of_transcript("/tmp/antigravity-ide/t.jsonl"), None);
        assert_eq!(apps_for(Some(Product::Ide))[0], "antigravity ide");
        assert_eq!(apps_for(Some(Product::Desktop))[0], "antigravity");
        assert!(apps_for(Some(Product::Cli)).is_empty());
        assert_eq!(apps_for(None).len(), 3);
    }

    #[test]
    fn reads_the_product_from_the_newest_saved_hook_input() {
        let dir = std::env::temp_dir().join(format!("fuyu-antigravity-focus-{}", std::process::id()));
        let saved = dir.join(SAVED_DIR);
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&saved).unwrap();
        let input = |id: &str, data: &str| json!({ "conversationId": id, "transcriptPath": format!("C:\\Users\\a\\.gemini\\{data}\\brain\\{id}\\t.jsonl") }).to_string();
        fs::write(saved.join("running-1.json"), input("c1", "antigravity-ide")).unwrap();
        fs::write(saved.join("stop-1.json"), input("c2", "antigravity")).unwrap();
        fs::write(saved.join("broken.json"), "{").unwrap();
        assert_eq!(session_product(&dir, "c1"), Some(Product::Ide));
        assert_eq!(session_product(&dir, "c2"), Some(Product::Desktop));
        assert_eq!(session_product(&dir, "c3"), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn picks_the_window_of_the_right_product_and_folder() {
        let window = |title: &str, app: &str| WindowCandidate { title: title.into(), app: app.into() };
        let windows = [
            window("Agent Manager - Antigravity", "antigravity"),
            window("main.rs - shop - Antigravity IDE", "antigravity ide"),
            window("README.md - blog - Antigravity IDE", "antigravity ide"),
        ];
        let hints = |folder| SessionHints { folder: Some(folder), ..SessionHints::default() };
        let ide = apps_for(Some(Product::Ide));
        assert_eq!(preferred_window(&windows, &hints("blog"), &ide), Some(2));
        assert_eq!(preferred_window(&windows, &hints("shop"), &ide), Some(1));
        assert_eq!(preferred_window(&windows, &hints("elsewhere"), &ide), Some(1));
        assert_eq!(preferred_window(&windows, &hints("blog"), &apps_for(Some(Product::Desktop))), Some(0));
        assert_eq!(preferred_window(&windows[..1], &hints("blog"), &ide), Some(0));
        assert_eq!(preferred_window(&windows, &hints("blog"), &[]), None);
    }
}
