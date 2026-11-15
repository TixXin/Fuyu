use super::*;
use crate::agent_status::{AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME};
use rusqlite::{params, Connection};
use std::time::SystemTime;

const SCHEMA: &str = "
CREATE TABLE session (
  id text primary key, project_id text not null, workspace_id text, parent_id text, slug text not null,
  directory text not null, path text, title text not null, version text not null, share_url text,
  summary_additions integer, summary_deletions integer, summary_files integer, summary_diffs text, revert text,
  permission text, time_created integer not null, time_updated integer not null, time_compacting integer,
  time_archived integer, task_type text not null default 'interactive', title_source text not null default 'first_input',
  title_message_id text, time_title_updated integer, trace_id text, time_deleted integer, last_outcome text
);
CREATE TABLE message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer);
CREATE TABLE part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer);
CREATE TABLE todo (session_id text not null, content text not null, status text not null, priority text not null, position integer not null, time_created integer not null, time_updated integer not null, primary key (session_id, position));
";

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-zcode-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn now() -> i64 {
    super::super::snapshot::system_time_to_unix_millis(SystemTime::now()).unwrap()
}

fn session(conn: &Connection, id: &str, title: &str, title_source: &str, task_type: &str, at: i64) {
    conn.execute(
        "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated, task_type, title_source)
         VALUES (?1, 'prj', 'slug', '/Users/dev/shop', ?2, '1', ?3, ?3, ?4, ?5)",
        params![id, title, at, task_type, title_source],
    )
    .unwrap();
}

fn message(conn: &Connection, session: &str, id: &str, at: i64, data: Value) {
    conn.execute(
        "INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?3, ?4)",
        params![id, session, at, data.to_string()],
    )
    .unwrap();
}

fn part(conn: &Connection, message: &str, session: &str, id: &str, at: i64, data: Value) {
    conn.execute(
        "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
        params![id, message, session, at, data.to_string()],
    )
    .unwrap();
}

#[test]
fn lists_zcode_sessions_from_its_database() {
    let dir = temp_dir("db");
    let db = dir.join("db.sqlite");
    let conn = Connection::open(&db).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    let now = now();
    session(&conn, "s_work", "购物车改成深色", "generated", "interactive", now - 5_000);
    message(&conn, "s_work", "m1", now - 5_000, json!({ "role": "user", "time": { "created": now - 5_000 }, "agent": "build" }));
    part(&conn, "m1", "s_work", "p1", now - 5_000, json!({ "type": "text", "text": "把购物车改成深色" }));
    message(&conn, "s_work", "m2", now - 4_000, json!({ "role": "assistant", "time": { "created": now - 4_000 }, "modelId": "glm-5", "mode": "build", "agent": "build", "tokens": { "input": 100, "output": 20, "reasoning": 0, "cache": { "read": 0, "write": 0 } } }));
    part(&conn, "m2", "s_work", "p2", now - 4_000, json!({ "type": "tool", "tool": "bash", "callID": "c1", "state": { "status": "running", "input": { "command": "npm test" }, "time": { "start": now - 4_000 } } }));
    session(&conn, "s_new", "New session", "default", "interactive", now - 3_000);
    message(&conn, "s_new", "m3", now - 3_000, json!({ "role": "user", "time": { "created": now - 3_000 }, "agent": "build" }));
    part(&conn, "m3", "s_new", "p3", now - 3_000, json!({ "type": "text", "text": "看看日志" }));
    message(&conn, "s_new", "m4", now - 2_000, json!({ "role": "assistant", "time": { "created": now - 2_000, "completed": now - 1_000 }, "modelId": "glm-5", "mode": "build", "agent": "build", "tokens": {} }));
    part(&conn, "m4", "s_new", "p4", now - 2_000, json!({ "type": "text", "text": "日志没问题。\n\n✓" }));
    session(&conn, "s_child", "子任务", "generated", "subagent_child", now - 1_000);
    session(&conn, "s_gone", "删掉的", "generated", "interactive", now - 1_000);
    conn.execute("UPDATE session SET time_deleted = ?1 WHERE id = 's_gone'", [now]).unwrap();

    let mut listed = sessions(&db, now, 60 * 60 * 1000);
    listed.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    assert_eq!(listed.iter().map(|s| s.session_id.as_str()).collect::<Vec<_>>(), ["s_new", "s_work"]);
    let new = &listed[0];
    assert_eq!((new.provider, new.title.as_deref(), new.phase), (PROVIDER, Some("看看日志"), "completed"));
    assert_eq!((new.last_message.as_deref(), new.reply_marker), (Some("日志没问题。"), Some("done")));
    let work = &listed[1];
    assert_eq!((work.title.as_deref(), work.model.as_deref(), work.phase), (Some("购物车改成深色"), Some("glm-5"), "running"));
    assert_eq!(work.current_tool.as_ref().map(|tool| tool.name.as_str()), Some("bash"));
    assert_eq!(work.cwd.as_deref(), Some("/Users/dev/shop"));
    drop(conn);
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn finds_the_database_by_env_or_default() {
    let home = Path::new("/home/dev");
    let none = |_: &str| None;
    assert_eq!(database_path(home, none), home.join(".zcode/cli/db/db.sqlite"));
    let custom = |_: &str| Some(std::ffi::OsString::from("/data/z.sqlite"));
    assert_eq!(database_path(home, custom), PathBuf::from("/data/z.sqlite"));
    let relative = |_: &str| Some(std::ffi::OsString::from("z.sqlite"));
    assert_eq!(database_path(home, relative), home.join(".zcode/cli/db/db.sqlite"));
}

#[test]
fn installs_hooks_into_the_cli_config() {
    let home = temp_dir("hooks");
    let running = home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    install_hooks(&env).unwrap();
    assert!(!config_path(&home).exists());
    assert_eq!(hooks_state(&env), HookInstallState::Absent);

    fs::create_dir_all(home.join(".zcode/cli")).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::NotInstalled);
    fs::write(
        config_path(&home),
        r#"{"model":"glm-5","hooks":{"enabled":false,"timeoutMs":60000,"events":{"Stop":[{"hooks":[{"type":"process","command":"node","args":["mine.mjs"]}]}]}}}"#,
    )
    .unwrap();
    install_hooks(&env).unwrap();
    install_hooks(&env).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::Current);

    let config = read_config(&config_path(&home)).unwrap();
    assert_eq!((config["model"].as_str(), config["hooks"]["enabled"].as_bool()), (Some("glm-5"), Some(true)));
    assert_eq!(config["hooks"]["timeoutMs"], 60000);
    let events = &config["hooks"]["events"];
    assert_eq!(events["Stop"][0]["hooks"][0]["args"][0], "mine.mjs");
    let commands = |event: &str| -> Vec<String> {
        events[event].as_array().unwrap().iter().filter_map(|entry| entry["hooks"][0]["command"].as_str().map(str::to_string)).collect()
    };
    assert!(commands("UserPromptSubmit")[0].contains("zcode"));
    assert!(commands("Stop").iter().any(|command| command.contains("zcode completed")));
    let permission = commands("PermissionRequest");
    assert!(permission.iter().any(|command| command.contains("zcode notification")));
    assert!(permission.iter().any(|command| command.contains("fuyu-agent-approval") && command.contains("zcode permission")));

    let mut disabled = config.clone();
    disabled["hooks"]["enabled"] = json!(false);
    fs::write(config_path(&home), disabled.to_string()).unwrap();
    assert_eq!(hooks_state(&env), HookInstallState::Outdated);
    fs::remove_dir_all(&home).unwrap();
}
