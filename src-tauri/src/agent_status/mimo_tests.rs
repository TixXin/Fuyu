use super::*;
use crate::agent_status::{AGENT_RUNNING_SCRIPT_FILE_NAME, AGENT_STATUS_SCRIPT_FILE_NAME};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::time::SystemTime;

const SCHEMA: &str = "
CREATE TABLE session (
  id text primary key, project_id text not null, workspace_id text, parent_id text, context_from text, context_watermark text,
  slug text not null, directory text not null, title text not null, title_source text not null default 'user',
  title_revision integer not null default 0, version text not null, time_created integer not null, time_updated integer not null,
  time_compacting integer, time_archived integer
);
CREATE TABLE message (id text primary key, session_id text not null, agent_id text not null default 'main', time_created integer not null, time_updated integer not null, data text not null);
CREATE TABLE part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);
";

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-mimo-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn now() -> i64 {
    super::super::snapshot::system_time_to_unix_millis(SystemTime::now()).unwrap()
}

fn message(conn: &Connection, session: &str, id: &str, agent: &str, at: i64, data: Value, text: Option<&str>) {
    conn.execute(
        "INSERT INTO message (id, session_id, agent_id, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
        params![id, session, agent, at, data.to_string()],
    )
    .unwrap();
    if let Some(text) = text {
        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?4, ?4, ?5)",
            params![format!("p-{id}"), id, session, at, json!({ "type": "text", "text": text }).to_string()],
        )
        .unwrap();
    }
}

#[test]
fn lists_mimo_sessions_with_only_the_main_agents_messages() {
    let dir = temp_dir("db");
    let db = dir.join("mimocode.db");
    let conn = Connection::open(&db).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    let now = now();
    conn.execute(
        "INSERT INTO session (id, project_id, slug, directory, title, title_source, version, time_created, time_updated)
         VALUES ('s1', 'p', 'slug', '/Users/dev/shop', 'New session - 2026-11-15', 'fallback', '1', ?1, ?1)",
        [now - 5_000],
    )
    .unwrap();
    message(&conn, "s1", "m1", "main", now - 5_000, json!({ "role": "user", "time": { "created": now - 5_000 } }), Some("修一下登录"));
    message(&conn, "s1", "m2", "main", now - 4_000, json!({ "role": "assistant", "modelID": "mimo-v2", "time": { "created": now - 4_000, "completed": now - 3_000 } }), Some("修好了。\n\n✓"));
    message(&conn, "s1", "m3", "explore-1", now - 2_000, json!({ "role": "assistant", "modelID": "mimo-v2", "time": { "created": now - 2_000 } }), Some("子代理还在读文件"));

    let listed = sessions(&db, now, 60 * 60 * 1000);
    assert_eq!(listed.len(), 1);
    let session = &listed[0];
    assert_eq!((session.provider, session.session_id.as_str()), (PROVIDER, "s1"));
    assert_eq!(session.title.as_deref(), Some("修一下登录"));
    assert_eq!((session.phase, session.last_message.as_deref()), ("completed", Some("修好了。")));
    assert_eq!(session.model.as_deref(), Some("mimo-v2"));
    drop(conn);
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn messages_without_an_agent_id_count_as_the_main_agents() {
    let dir = temp_dir("null-agent");
    let db = dir.join("mimocode.db");
    let conn = Connection::open(&db).unwrap();
    conn.execute_batch(&SCHEMA.replace("agent_id text not null default 'main'", "agent_id text")).unwrap();
    let now = now();
    conn.execute(
        "INSERT INTO session (id, project_id, slug, directory, title, title_source, version, time_created, time_updated)
         VALUES ('s1', 'p', 'slug', '/Users/dev/shop', '旧会话', 'user', '1', ?1, ?1)",
        [now - 5_000],
    )
    .unwrap();
    message(&conn, "s1", "m1", "main", now - 5_000, json!({ "role": "user", "time": { "created": now - 5_000 } }), Some("看看日志"));
    message(&conn, "s1", "m2", "main", now - 4_000, json!({ "role": "assistant", "modelID": "mimo-v2", "time": { "created": now - 4_000, "completed": now - 3_000 } }), Some("日志没问题。"));
    conn.execute("UPDATE message SET agent_id = NULL", []).unwrap();

    let session = sessions(&db, now, 60 * 60 * 1000).remove(0);
    assert_eq!((session.phase, session.last_message.as_deref()), ("completed", Some("日志没问题。")));
    assert_eq!((session.model.as_deref(), session.last_prompt.as_deref()), (Some("mimo-v2"), Some("看看日志")));
    drop(conn);
    fs::remove_dir_all(&dir).unwrap();
}

#[test]
fn finds_its_directories_like_opencode_with_its_own_names() {
    let home = Path::new("/home/dev");
    let none = |_: &str| None;
    assert_eq!(database_path(home, none), Some(home.join(".local").join("share").join("mimocode").join("mimocode.db")));
    assert_eq!(config_dir(home, &none), home.join(".config").join("mimocode"));
    let opt = std::env::temp_dir().join("mimo-home");
    let mimo_home = |name: &str| (name == "MIMOCODE_HOME").then(|| opt.clone().into_os_string());
    assert_eq!(database_path(home, mimo_home), Some(opt.join("data").join("mimocode.db")));
    assert_eq!(config_dir(home, &mimo_home), opt.join("config"));
    let xdg_dir = std::env::temp_dir().join("xdg");
    let xdg = |name: &str| (name == "XDG_DATA_HOME").then(|| xdg_dir.clone().into_os_string());
    assert_eq!(database_path(home, xdg), Some(xdg_dir.join("mimocode").join("mimocode.db")));
    let relative = |name: &str| (name == "MIMOCODE_HOME").then(|| OsString::from("mimo"));
    assert_eq!(config_dir(home, &relative), home.join(".config").join("mimocode"));
    let named = |name: &str| (name == "MIMOCODE_DB").then(|| OsString::from("other.db"));
    assert_eq!(database_path(home, named), Some(home.join(".local").join("share").join("mimocode").join("other.db")));
    let memory = |name: &str| (name == "MIMOCODE_DB").then(|| OsString::from(":memory:"));
    assert_eq!(database_path(home, memory), None);
}

#[test]
fn installs_its_own_copy_of_the_plugin() {
    let home = temp_dir("plugin");
    let running = home.join(".fuyu").join(AGENT_RUNNING_SCRIPT_FILE_NAME);
    let status = home.join(".fuyu").join(AGENT_STATUS_SCRIPT_FILE_NAME);
    let env = HookEnv { home_dir: &home, running_script: &running, status_script: &status };
    let none = |_: &str| None;
    install_with(&env, &none).unwrap();
    assert_eq!(state_with(&env, &none), HookInstallState::Absent);

    fs::create_dir_all(home.join(".config").join("mimocode")).unwrap();
    assert_eq!(state_with(&env, &none), HookInstallState::NotInstalled);
    install_with(&env, &none).unwrap();
    assert_eq!(state_with(&env, &none), HookInstallState::Current);
    let text = fs::read_to_string(plugin_path(&home, &none)).unwrap();
    assert!(text.contains("const ROUTE = \"/mimo/permission\";") && text.contains("`mimo-plugin-"));
    assert!(!text.contains("opencode-plugin") && !text.contains("/opencode/permission"));
    assert!(!home.join(".config").join("opencode").exists());

    fs::write(plugin_path(&home, &none), "old").unwrap();
    assert_eq!(state_with(&env, &none), HookInstallState::Outdated);
    fs::remove_dir_all(&home).unwrap();
}
