use super::*;
use serde_json::json;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-third-party-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

#[test]
fn validates_third_party_provider_ids() {
    assert!(is_third_party_id("aider"));
    assert!(is_third_party_id("my-agent_1"));
    assert!(!is_third_party_id("codex"));
    assert!(!is_third_party_id("claudeCode"));
    assert!(!is_third_party_id("pi"));
    assert!(!is_third_party_id("updatedAt"));
    assert!(!is_third_party_id("1bad"));
    assert!(!is_third_party_id(""));
}

#[test]
fn reads_third_party_sessions_from_drop_in_and_configured_directories() {
    let root = temp_dir("sessions");
    let home = root.join("home");
    let app_dir = root.join("fuyu");
    let drop_in = app_dir.join(THIRD_PARTY_DIR_NAME).join("aider");
    let external_dir = home.join(".custom-agent/sessions/proj");
    fs::create_dir_all(&drop_in).unwrap();
    fs::create_dir_all(&external_dir).unwrap();

    fs::write(
        drop_in.join("s1.json"),
        json!({
            "sessionId": "aider-1",
            "title": "重构接口",
            "cwd": "/work/api",
            "phase": "running",
            "model": "deepseek-reasoner",
            "lastMessage": "正在修改路由",
        })
        .to_string(),
    )
    .unwrap();

    fs::write(
        external_dir.join("2026-11-17_ext-1.jsonl"),
        [
            r#"{"type":"session","id":"ext-1","cwd":"/work/ext"}"#,
            r#"{"type":"message","timestamp":"2026-11-17T08:00:00.000Z","message":{"role":"user","content":[{"type":"text","text":"加个单测"}]}}"#,
            r#"{"type":"message","timestamp":"2026-11-17T08:00:02.000Z","message":{"role":"assistant","content":[{"type":"text","text":"单测已通过。\n✓"}]},"stopReason":"stop"}"#,
        ]
        .join("\n"),
    )
    .unwrap();

    fs::write(
        app_dir.join(PROVIDERS_FILE_NAME),
        json!([
            { "id": "myAgent", "name": "My Agent", "sessionsDir": "~/.custom-agent/sessions" }
        ])
        .to_string(),
    )
    .unwrap();

    let now = crate::agent_status::snapshot::current_unix_millis();
    let roots = ScanRoots { home_dir: &home, local_app_dir: Some(&app_dir) };
    let mut listed = sessions(&roots, now, 60_000);
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    assert_eq!(listed.len(), 2);
    assert_eq!((listed[0].provider, listed[0].session_id.as_str(), listed[0].phase), ("aider", "aider-1", "running"));
    assert_eq!(listed[0].title.as_deref(), Some("重构接口"));
    assert_eq!((listed[1].provider, listed[1].session_id.as_str(), listed[1].phase), ("myAgent", "ext-1", "completed"));
    assert_eq!(listed[1].title.as_deref(), Some("加个单测"));
    assert_eq!(listed[1].reply_marker, Some("done"));

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn merges_third_party_status_and_running_markers_into_snapshot_others() {
    let app_dir = temp_dir("markers");
    let stored = json!({
        "codex": { "phase": "idle", "updatedAt": 10 },
        "aider": { "phase": "completed", "name": "Aider", "title": "修样式", "updatedAt": 20 },
        "updatedAt": 20,
    });
    let persisted: crate::agent_status::snapshot::PersistedAgentStatus = serde_json::from_value(stored).unwrap();
    let mut snapshot = crate::agent_status::snapshot::agent_status_snapshot_from_persisted(persisted, "p".into());
    assert!(snapshot.others.iter().any(|item| item.id == "aider" && item.name == "Aider" && item.phase == "completed"));

    fs::write(app_dir.join("agent-goose-running.flag"), "").unwrap();
    let now = crate::agent_status::snapshot::current_unix_millis();
    apply_running_markers(&app_dir, &mut snapshot, now);
    assert!(snapshot.others.iter().any(|item| item.id == "goose" && item.phase == "running"));

    let _ = fs::remove_dir_all(&app_dir);
}
