use std::fs;

use serde_json::json;

use super::*;
use crate::agent_status::window_focus::{app_name, preferred_window, SessionHints, WindowCandidate};

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
    assert!(is_desktop_app("antigravity"));
    assert!(!is_desktop_app("antigravity ide"));
    assert!(!is_desktop_app("antigravity-ide"));
}

#[test]
fn matches_antigravity_conversation_urls_and_paths_strictly() {
    let id = "0f8a4018-7a62-467c-8948-e03a3ad978af";
    assert!(conversation_url_matches("/c/0f8a4018-7a62-467c-8948-e03a3ad978af", id));
    assert!(conversation_url_matches("https://127.0.0.1:50191/c/0f8a4018-7a62-467c-8948-e03a3ad978af", id));
    assert!(conversation_url_matches(
        "https://127.0.0.1:50191/c/0f8a4018-7a62-467c-8948-e03a3ad978af?project=12a569cf",
        id
    ));
    assert!(conversation_url_matches(
        "http://localhost:50191/c/0f8a4018-7a62-467c-8948-e03a3ad978af#bottom",
        id
    ));
    assert!(conversation_url_matches(
        "https://127.0.0.1:50191/c/0f8a4018-7a62-467c-8948-e03a3ad978af/artifacts",
        id
    ));
    assert!(!conversation_url_matches(
        "https://127.0.0.1:50191/c/0f8a4018-7a62-467c-8948-e03a3ad978af-extra",
        id
    ));
    assert!(!conversation_url_matches("https://127.0.0.1:50191/?project=0f8a4018-7a62-467c-8948-e03a3ad978af", id));
    assert!(!conversation_url_matches("https://127.0.0.1:50191/customizations", id));
    assert!(!conversation_url_matches("/c/", ""));
    assert!(!conversation_url_matches("/c/a/b", "a/b"));
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
