use super::*;
use std::{collections::HashMap, fs};

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-cursor-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn script_paths(dir: &Path) -> (PathBuf, PathBuf) {
    (dir.join("fuyu-agent-running.sh"), dir.join("fuyu-agent-status.sh"))
}

#[test]
fn install_keeps_other_hooks_and_uninstall_removes_only_ours() {
    let home = temp_dir("hooks");
    let cursor = home.join(".cursor");
    fs::create_dir_all(&cursor).unwrap();
    let foreign = json!({
        "version": 1,
        "hooks": {
            "beforeShellExecution": [{ "command": "./mine.sh", "timeout": 5 }]
        }
    });
    fs::write(cursor.join("hooks.json"), serde_json::to_string_pretty(&foreign).unwrap()).unwrap();
    let (running, status) = script_paths(&home);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    install(&env).unwrap();
    let installed: Value = serde_json::from_str(&fs::read_to_string(cursor.join("hooks.json")).unwrap()).unwrap();
    let shell = installed["hooks"]["beforeShellExecution"].as_array().unwrap();
    assert_eq!(shell[0]["command"], "./mine.sh");
    assert!(shell.iter().any(|entry| entry["command"].as_str().unwrap_or("").contains("fuyu-agent-approval")));
    assert!(installed["hooks"]["stop"].as_array().unwrap()[0]["command"].as_str().unwrap().contains("cursor completed"));
    assert_eq!(check(&env), HookInstallState::Current);
    uninstall(&env).unwrap();
    let left: Value = serde_json::from_str(&fs::read_to_string(cursor.join("hooks.json")).unwrap()).unwrap();
    assert_eq!(left["hooks"]["beforeShellExecution"], json!([{ "command": "./mine.sh", "timeout": 5 }]));
    assert!(left["hooks"].get("stop").is_none());
    assert_eq!(check(&env), HookInstallState::NotInstalled);
}

#[test]
fn missing_cursor_directory_is_absent_and_uninstall_does_not_create_it() {
    let home = temp_dir("absent");
    let (running, status) = script_paths(&home);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    assert_eq!(check(&env), HookInstallState::Absent);
    assert!(install(&env).is_ok());
    uninstall(&env).unwrap();
    assert!(!home.join(".cursor").exists());
}

#[test]
fn a_dashed_project_folder_resolves_to_the_real_path() {
    let root = temp_dir("workspace");
    let project = root.join("Users").join("ada").join("projects").join("Fuyu");
    fs::create_dir_all(&project).unwrap();
    let found = resolve_workspace(&root, "Users-ada-projects-Fuyu").unwrap();
    assert_eq!(found, project);
    let longer = root.join("Users").join("ada").join("projects-old");
    fs::create_dir_all(&longer).unwrap();
    assert_eq!(resolve_workspace(&root, "Users-ada-projects-old").unwrap(), longer);
}

#[test]
fn transcripts_use_the_first_prompt_until_a_title_exists() {
    let home = temp_dir("sessions");
    let cursor = home.join(".cursor");
    let id = "11111111-1111-1111-1111-111111111111";
    let dir = cursor.join("projects").join("Users-ada-app").join("agent-transcripts").join(id);
    fs::create_dir_all(&dir).unwrap();
    let file = dir.join(format!("{id}.jsonl"));
    fs::write(
        &file,
        concat!(
            "{\"role\":\"user\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"Fix the icon\"}]}}\n",
            "{\"role\":\"assistant\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"Edited it.\"},{\"type\":\"tool_use\",\"name\":\"Shell\",\"input\":{\"command\":\"ls src\"}}]}}\n",
            "{\"type\":\"turn_ended\",\"status\":\"success\"}\n",
        ),
    )
    .unwrap();
    let now = file_modified_unix_millis(&file).unwrap() + 1_000;
    let listed = sessions(&ScanRoots { home_dir: &home, local_app_dir: Some(&home) }, now, 60 * 60 * 1000);
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].session_id, id);
    assert_eq!(listed[0].title.as_deref(), Some("Fix the icon"));
    assert_eq!(listed[0].phase, "completed");
    assert_eq!(listed[0].last_message.as_deref(), Some("Edited it."));
    assert!(listed[0].current_tool.is_none());
    assert_eq!(listed[0].host.as_ref().map(|host| host.name.as_str()), Some("Cursor"));

    fs::write(
        &file,
        "{\"role\":\"user\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"Keep going\"}]}}\n",
    )
    .unwrap();
    let now = file_modified_unix_millis(&file).unwrap() + 1_000;
    let running = sessions(&ScanRoots { home_dir: &home, local_app_dir: Some(&home) }, now, 60 * 60 * 1000);
    assert_eq!(running[0].phase, "running");
    assert!(sessions(&ScanRoots { home_dir: &home, local_app_dir: None }, now, 60 * 60 * 1000).is_empty());
}

#[test]
fn titles_come_from_the_small_databases_and_skip_archived_rows() {
    let dir = temp_dir("titles");
    let search = dir.join("search.db");
    let summary = dir.join("summary.db");
    let conn = rusqlite::Connection::open(&search).unwrap();
    conn.execute_batch(
        "CREATE TABLE conversations (id TEXT, title TEXT, is_archived INTEGER);
         INSERT INTO conversations VALUES ('s1', 'Icon polish', 0);
         INSERT INTO conversations VALUES ('old', 'Archived chat', 1);",
    )
    .unwrap();
    drop(conn);
    let conn = rusqlite::Connection::open(&summary).unwrap();
    conn.execute_batch(
        "CREATE TABLE conversation_summaries (conversationId TEXT, title TEXT, model TEXT);
         INSERT INTO conversation_summaries VALUES ('s1', 'From the summary', 'composer');",
    )
    .unwrap();
    drop(conn);
    let mut titles = HashMap::new();
    read_search_db(&search, &mut titles);
    assert_eq!(titles.get("s1").and_then(|meta| meta.title.as_deref()), Some("Icon polish"));
    assert!(!titles.contains_key("old"));
    read_summary_db(&summary, &mut titles);
    let meta = titles.get("s1").unwrap();
    assert_eq!(meta.title.as_deref(), Some("From the summary"));
    assert_eq!(meta.model.as_deref(), Some("composer"));
}

#[test]
fn composer_data_supplies_the_model_effort_and_an_unfinished_run() {
    let dir = temp_dir("composer");
    let db = dir.join("state.vscdb");
    let conn = rusqlite::Connection::open(&db).unwrap();
    conn.execute_batch(
        "CREATE TABLE composerHeaders (composerId TEXT, value TEXT);
         CREATE TABLE cursorDiskKV (key TEXT, value TEXT);
         INSERT INTO composerHeaders VALUES (
           's1',
           '{\"unfinishedRunAt\":1700000000000,\"hasBlockingPendingActions\":true}'
         );
         INSERT INTO cursorDiskKV VALUES (
           'composerData:s1',
           '{\"unfinishedRunAt\":1700000000000,\"contextTokensUsed\":1500,\"modelConfig\":{\"modelName\":\"grok-4.7\",\"selectedModels\":[{\"parameters\":[{\"id\":\"reasoning_effort\",\"value\":\"high\"}]}]}}'
         );
         INSERT INTO cursorDiskKV VALUES ('composerData:plain', '{\"modelConfig\":{\"modelName\":\"default\"}}');
         INSERT INTO cursorDiskKV VALUES ('agentKv:blob:abc', '{\"modelConfig\":{\"modelName\":\"should-skip\"}}');",
    )
    .unwrap();
    drop(conn);
    let mut titles = HashMap::new();
    read_state_db(&db, &mut titles);
    let meta = titles.get("s1").unwrap();
    assert!(meta.running);
    assert_eq!(meta.started_at, Some(1_700_000_000_000));
    assert_eq!(meta.model.as_deref(), Some("grok-4.7"));
    assert_eq!(meta.effort.as_deref(), Some("high"));
    assert_eq!(meta.context_tokens, Some(1500));
    assert!(titles.get("plain").and_then(|meta| meta.model.as_ref()).is_none());
    assert!(!titles.contains_key("abc"));
}

#[test]
fn an_unfinished_run_stays_running_after_the_transcript_ends() {
    let home = temp_dir("live");
    let db = state_db(&home);
    if !db.starts_with(&home) {
        return;
    }
    let id = "22222222-2222-2222-2222-222222222222";
    let dir = home.join(".cursor").join("projects").join("Users-ada-app").join("agent-transcripts").join(id);
    fs::create_dir_all(&dir).unwrap();
    let file = dir.join(format!("{id}.jsonl"));
    fs::write(
        &file,
        concat!(
            "{\"role\":\"user\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"Keep going\"}]}}\n",
            "{\"type\":\"turn_ended\",\"status\":\"success\"}\n",
        ),
    )
    .unwrap();
    fs::create_dir_all(db.parent().unwrap()).unwrap();
    let conn = rusqlite::Connection::open(&db).unwrap();
    conn.execute_batch(&format!(
        "CREATE TABLE composerHeaders (composerId TEXT, value TEXT);
         CREATE TABLE cursorDiskKV (key TEXT, value TEXT);
         INSERT INTO cursorDiskKV VALUES (
           'composerData:{id}',
           '{{\"unfinishedRunAt\":1700000000000,\"modelConfig\":{{\"modelName\":\"grok-4.7\",\"selectedModels\":[{{\"parameters\":[{{\"id\":\"reasoning_effort\",\"value\":\"high\"}}]}}]}}}}'
         );"
    ))
    .unwrap();
    drop(conn);
    let now = file_modified_unix_millis(&file).unwrap() + 1_000;
    let listed = sessions(&ScanRoots { home_dir: &home, local_app_dir: Some(&home) }, now, 60 * 60 * 1000);
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].phase, "running");
    assert_eq!(listed[0].model.as_deref(), Some("grok-4.7"));
    assert_eq!(listed[0].effort.as_deref(), Some("high"));
    assert_eq!(listed[0].turn_started_at, Some(1_700_000_000_000));
}
