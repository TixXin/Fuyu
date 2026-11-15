use super::*;
use serde_json::json;
use std::ffi::OsString;

const NOW: i64 = 1_763_200_000_000;

const V2_SCHEMA: &str = "
CREATE TABLE project (id text PRIMARY KEY, worktree text NOT NULL);
CREATE TABLE session_v2 (
  id text PRIMARY KEY, project_id text NOT NULL, workspace_id text, parent_id text, slug text NOT NULL,
  directory text NOT NULL, path text, title text, version text NOT NULL, model text, agent text,
  cost real DEFAULT 0 NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL,
  time_archived integer, time_idle integer, time_viewed integer, idle_outcome text, time_busy integer
);
CREATE TABLE session_message (
  id text PRIMARY KEY, session_id text NOT NULL, type text NOT NULL, seq integer NOT NULL,
  time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL
);
CREATE TABLE session_part (
  message_id text NOT NULL, session_id text NOT NULL, ordinal integer NOT NULL, type text NOT NULL, call_id text,
  time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL,
  PRIMARY KEY (message_id, ordinal)
);
";

const V1_SCHEMA: &str = "
CREATE TABLE session (
  id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL, directory text NOT NULL,
  title text NOT NULL, version text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL,
  time_compacting integer, time_archived integer
);
CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE part (id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
";

fn database(name: &str, schema: &str) -> (PathBuf, Connection) {
    let dir = std::env::temp_dir().join(format!("fuyu-opencode-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("opencode.db");
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch(schema).unwrap();
    (path, conn)
}

fn v2_session(conn: &Connection, id: &str, title: Option<&str>, busy: Option<i64>, idle: Option<i64>, outcome: Option<&str>) {
    conn.execute(
        "INSERT INTO session_v2 (id, project_id, slug, directory, title, version, model, agent, time_created, time_updated, time_busy, time_idle, idle_outcome)
         VALUES (?1, 'prj_01', 'calm-river', 'D:/work/demo', ?2, '2.3.0', ?3, 'build', ?4, ?4, ?5, ?6, ?7)",
        params![
            id,
            title,
            json!({"id": "claude-sonnet-5-5", "providerID": "anthropic", "variant": "high"}).to_string(),
            NOW - 60_000,
            busy,
            idle,
            outcome
        ],
    )
    .unwrap();
}

fn v2_message(conn: &Connection, session: &str, id: &str, seq: i64, kind: &str, data: Value) {
    conn.execute(
        "INSERT INTO session_message (id, session_id, type, seq, time_created, time_updated, data) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)",
        params![id, session, kind, seq, NOW - 50_000 + seq, data.to_string()],
    )
    .unwrap();
}

fn rows(path: &Path) -> Vec<Stored> {
    let mut rows = read_database(path, NOW - 3_600_000).unwrap();
    rows.sort_by(|a, b| a.summary.session_id.cmp(&b.summary.session_id));
    rows
}

#[test]
fn reads_a_running_v2_session_with_its_reply_in_parts() {
    let (path, conn) = database("v2-running", V2_SCHEMA);
    v2_session(&conn, "ses_a1", Some("Fix the login page"), Some(NOW - 10_000), Some(NOW - 40_000), Some("succeeded"));
    v2_message(&conn, "ses_a1", "msg_1", 1, "user", json!({"text": "why does login fail", "time": {"created": NOW - 49_999}}));
    v2_message(&conn, "ses_a1", "msg_2", 2, "assistant", json!({"agent": "build", "model": {"id": "claude-sonnet-5-5", "providerID": "anthropic"}, "content": [], "time": {"created": NOW - 49_998}}));
    conn.execute(
        "INSERT INTO session_part VALUES ('msg_2', 'ses_a1', 0, 'text', NULL, ?1, ?1, ?2)",
        params![NOW - 49_998, json!({"type": "text", "text": "Looking at the session cookie."}).to_string()],
    )
    .unwrap();
    let rows = rows(&path);
    assert_eq!(rows.len(), 1);
    let row = &rows[0];
    assert_eq!(row.state, TurnState::Working);
    assert!(row.from_service);
    assert_eq!(row.summary.provider, PROVIDER);
    assert_eq!(row.summary.title.as_deref(), Some("Fix the login page"));
    assert_eq!(row.summary.cwd.as_deref(), Some("D:/work/demo"));
    assert_eq!(row.summary.model.as_deref(), Some("claude-sonnet-5-5"));
    assert_eq!(row.summary.effort.as_deref(), Some("high"));
    assert_eq!(row.summary.last_prompt.as_deref(), Some("why does login fail"));
    assert_eq!(row.summary.last_message.as_deref(), Some("Looking at the session cookie."));
    assert_eq!(row.summary.turn_started_at, Some(NOW - 49_999));
    assert_eq!(row.summary.updated_at, NOW - 10_000);
    conn.execute("UPDATE session_part SET data = ?1", params![json!({"type": "text", "text": "Fixed the cookie.\n✓"}).to_string()]).unwrap();
    let again = read_database(&path, NOW - 3_600_000).unwrap();
    let row = &again[0];
    assert_eq!((row.summary.reply_marker, row.summary.last_message.as_deref()), (Some("done"), Some("Fixed the cookie.")));
}

#[test]
fn v2_outcome_decides_done_or_failed_and_children_are_hidden() {
    let (path, conn) = database("v2-outcome", V2_SCHEMA);
    v2_session(&conn, "ses_done", None, Some(NOW - 30_000), Some(NOW - 20_000), Some("succeeded"));
    v2_session(&conn, "ses_fail", Some("New session - 2026-11-15T08:00:00.000Z"), Some(NOW - 30_000), Some(NOW - 20_000), Some("failed"));
    v2_session(&conn, "ses_child", Some("Child session - x"), Some(NOW - 1_000), None, None);
    conn.execute("UPDATE session_v2 SET parent_id = 'ses_done' WHERE id = 'ses_child'", []).unwrap();
    v2_session(&conn, "ses_old", Some("Old"), None, Some(NOW - 7_200_000), Some("succeeded"));
    conn.execute("UPDATE session_v2 SET time_updated = ?1 WHERE id = 'ses_old'", [NOW - 7_200_000]).unwrap();
    v2_message(&conn, "ses_fail", "msg_1", 1, "user", json!({"text": "deploy the site", "time": {"created": NOW - 49_999}}));
    let rows = rows(&path);
    let ids: Vec<_> = rows.iter().map(|row| row.summary.session_id.as_str()).collect();
    assert_eq!(ids, ["ses_done", "ses_fail"]);
    assert_eq!(rows[0].state, TurnState::Done);
    assert_eq!(rows[0].summary.title.as_deref(), Some("demo"));
    assert_eq!(rows[0].summary.title_source, Some("folder"));
    assert_eq!(rows[1].state, TurnState::Failed);
    assert_eq!(rows[1].summary.title.as_deref(), Some("deploy the site"));
}

#[test]
fn reads_v1_sessions_and_prefers_the_v2_copy() {
    let (path, conn) = database("v1", &format!("{V2_SCHEMA}{V1_SCHEMA}"));
    v2_session(&conn, "ses_both", Some("Imported"), Some(NOW - 30_000), Some(NOW - 20_000), Some("succeeded"));
    for (id, title) in [("ses_both", "Old copy"), ("ses_v1", "New session - 2026-11-15T08:00:00.000Z")] {
        conn.execute(
            "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?1, 'prj', 's', '/home/me/api', ?2, '1.19.5', ?3, ?3)",
            params![id, title, NOW - 30_000],
        )
        .unwrap();
    }
    let message = |id: &str, at: i64, data: Value| {
        conn.execute("INSERT INTO message VALUES (?1, 'ses_v1', ?2, ?2, ?3)", params![id, at, data.to_string()]).unwrap();
    };
    message("msg_a", NOW - 25_000, json!({"role": "user", "time": {"created": NOW - 25_000}, "agent": "build"}));
    message("msg_b", NOW - 24_000, json!({"role": "assistant", "time": {"created": NOW - 24_000}, "modelID": "gpt-6", "providerID": "openai"}));
    let part = |id: &str, message: &str, data: Value| {
        conn.execute("INSERT INTO part VALUES (?1, ?2, 'ses_v1', ?3, ?3, ?4)", params![id, message, NOW, data.to_string()]).unwrap();
    };
    part("prt_1", "msg_a", json!({"type": "text", "text": "add rate limiting"}));
    part("prt_2", "msg_a", json!({"type": "text", "text": "<system-reminder>", "synthetic": true}));
    part("prt_3", "msg_b", json!({"type": "text", "text": "Adding a token bucket."}));
    let rows = rows(&path);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].summary.title.as_deref(), Some("Imported"));
    let v1 = &rows[1];
    assert!(!v1.from_service);
    assert_eq!(v1.state, TurnState::Working);
    assert_eq!(v1.summary.title.as_deref(), Some("add rate limiting"));
    assert_eq!(v1.summary.model.as_deref(), Some("gpt-6"));
    assert_eq!(v1.summary.last_message.as_deref(), Some("Adding a token bucket."));
    assert_eq!(v1.summary.updated_at, NOW - 24_000);

    conn.execute(
        "UPDATE message SET data = json_set(data, '$.time.completed', ?1) WHERE id = 'msg_b'",
        [NOW - 23_000],
    )
    .unwrap();
    assert_eq!(rows_of(&path, "ses_v1").state, TurnState::Done);
    conn.execute("UPDATE message SET data = json_set(data, '$.error', json('{\"name\":\"APIError\"}')) WHERE id = 'msg_b'", []).unwrap();
    assert_eq!(rows_of(&path, "ses_v1").state, TurnState::Failed);
}

fn rows_of(path: &Path, id: &str) -> Stored {
    rows(path).into_iter().find(|row| row.summary.session_id == id).unwrap()
}

#[test]
fn early_v2_without_busy_time_falls_back_to_messages() {
    let schema = V2_SCHEMA.replace(", time_idle integer, time_viewed integer, idle_outcome text, time_busy integer", "");
    let (path, conn) = database("v2-early", &schema);
    conn.execute(
        "INSERT INTO session_v2 (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES ('ses_e', 'p', 's', '/w', 'Early', '2.0.30', ?1, ?1)",
        [NOW - 5_000],
    )
    .unwrap();
    v2_message(&conn, "ses_e", "msg_1", 1, "user", json!({"text": "hi"}));
    v2_message(&conn, "ses_e", "msg_2", 2, "assistant", json!({"content": [{"type": "text", "text": "Hello"}], "time": {"created": NOW, "completed": NOW}}));
    let row = rows_of(&path, "ses_e");
    assert_eq!(row.state, TurnState::Done);
    assert_eq!(row.summary.last_message.as_deref(), Some("Hello"));
}

#[test]
fn a_stopped_service_closes_its_sessions() {
    let (path, conn) = database("service", V2_SCHEMA);
    v2_session(&conn, "ses_s", Some("Run"), Some(NOW - 10_000), None, None);
    let stored = rows(&path);
    assert_eq!(finish(stored.clone(), Service::Running, NOW)[0].phase, "running");
    assert_eq!(finish(stored.clone(), Service::Unknown, NOW)[0].phase, "running");
    assert_eq!(finish(stored.clone(), Service::Unknown, NOW + AGENT_RUNNING_STALE_AFTER_MS)[0].phase, "stale");
    let gone = &finish(stored, Service::Gone, NOW)[0];
    assert_eq!(gone.phase, "completed");
    assert!(gone.closed);
}

#[test]
fn finds_the_database_and_service_file() {
    let home = Path::new("/home/me");
    let none = |_: &str| None::<OsString>;
    assert_eq!(database_path(home, none), Some(home.join(".local/share/opencode/opencode.db")));
    let data = std::env::temp_dir().join("xdg-data");
    let xdg = |name: &str| (name == "XDG_DATA_HOME").then(|| data.clone().into_os_string());
    assert_eq!(database_path(home, xdg), Some(data.join("opencode").join("opencode.db")));
    let relative = |name: &str| (name == "XDG_DATA_HOME").then(|| OsString::from("data"));
    assert_eq!(database_path(home, relative), Some(home.join(".local/share/opencode/opencode.db")));
    let named = |name: &str| (name == "OPENCODE_DB").then(|| OsString::from("opencode-canary.db"));
    assert_eq!(database_path(home, named), Some(home.join(".local/share/opencode/opencode-canary.db")));
    let memory = |name: &str| (name == "OPENCODE_DB").then(|| OsString::from(":memory:"));
    assert_eq!(database_path(home, memory), None);
}

#[test]
fn a_missing_database_reads_as_empty() {
    let missing = std::env::temp_dir().join("fuyu-opencode-missing/opencode.db");
    assert!(read_database(&missing, 0).is_err());
    assert!(cached_rows(&missing, 0).is_empty());
}

#[test]
fn v2_shows_the_running_tool_todos_tokens_and_plan_agent() {
    let (path, conn) = database("v2-fields", V2_SCHEMA);
    v2_session(&conn, "ses_f", Some("Fields"), Some(NOW - 10_000), Some(NOW - 40_000), Some("succeeded"));
    conn.execute("UPDATE session_v2 SET agent = 'plan'", []).unwrap();
    v2_message(&conn, "ses_f", "msg_1", 1, "user", json!({"text": "plan the fix"}));
    let todo = |status: &str| json!({"type": "tool", "id": "t1", "name": "todowrite", "state": {"status": status, "input": {"todos": [
        {"content": "Read the code", "status": "completed"}, {"content": "Write the plan", "status": "in_progress"}
    ]}}});
    v2_message(&conn, "ses_f", "msg_2", 2, "assistant", json!({"agent": "plan", "content": [todo("completed")],
        "tokens": {"input": 1200, "output": 300, "reasoning": 0, "cache": {"read": 8000, "write": 500}}, "time": {"created": NOW - 49_000, "completed": NOW - 48_000}}));
    v2_message(&conn, "ses_f", "msg_3", 3, "assistant", json!({"agent": "plan", "content": [], "time": {"created": NOW - 47_000}}));
    conn.execute(
        "INSERT INTO session_part VALUES ('msg_3', 'ses_f', 0, 'tool', 'c1', ?1, ?1, ?2)",
        params![NOW - 47_000, json!({"type": "tool", "id": "c1", "name": "bash", "state": {"status": "running", "input": {"command": "cargo test"}, "metadata": {}}}).to_string()],
    )
    .unwrap();
    let row = rows_of(&path, "ses_f");
    assert_eq!(row.state, TurnState::Working);
    let tool = row.summary.current_tool.clone().unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("bash", Some("cargo test")));
    let todos = row.summary.todos.clone().unwrap();
    assert_eq!((todos.done, todos.total, todos.current.as_deref()), (1, 2, Some("Write the plan")));
    assert_eq!(row.summary.context_tokens, Some(10_000));
    assert_eq!(row.summary.permission_mode, Some("plan"));
    conn.execute("UPDATE session_v2 SET agent = 'build', time_idle = ?1", [NOW - 5_000]).unwrap();
    let done = rows_of(&path, "ses_f");
    assert_eq!((done.summary.current_tool, done.summary.permission_mode), (None, None));
}

#[test]
fn v1_reads_tool_parts_tokens_mode_and_the_todo_table() {
    let schema = format!("{V1_SCHEMA}CREATE TABLE todo (session_id text NOT NULL, content text NOT NULL, status text NOT NULL, priority text NOT NULL, position integer NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL);");
    let (path, conn) = database("v1-fields", &schema);
    conn.execute(
        "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES ('ses_1', 'prj', 's', '/w', 'One', '1.19.5', ?1, ?1)",
        [NOW - 30_000],
    )
    .unwrap();
    conn.execute("INSERT INTO message VALUES ('msg_a', 'ses_1', ?1, ?1, ?2)", params![NOW - 25_000, json!({"role": "user", "time": {"created": NOW - 25_000}}).to_string()]).unwrap();
    conn.execute(
        "INSERT INTO message VALUES ('msg_b', 'ses_1', ?1, ?1, ?2)",
        params![NOW - 24_000, json!({"role": "assistant", "mode": "plan", "agent": "plan", "modelID": "gpt-6", "time": {"created": NOW - 24_000},
            "tokens": {"input": 100, "output": 20, "reasoning": 5, "cache": {"read": 400, "write": 0}}}).to_string()],
    )
    .unwrap();
    let part = |id: &str, message: &str, data: Value| {
        conn.execute("INSERT INTO part VALUES (?1, ?2, 'ses_1', ?3, ?3, ?4)", params![id, message, NOW, data.to_string()]).unwrap();
    };
    part("prt_1", "msg_a", json!({"type": "text", "text": "look around"}));
    part("prt_2", "msg_b", json!({"type": "tool", "callID": "c1", "tool": "read", "state": {"status": "completed", "input": {"filePath": "/w/a.rs"}}}));
    part("prt_3", "msg_b", json!({"type": "tool", "callID": "c2", "tool": "read", "state": {"status": "running", "input": {"filePath": "/w/src/main.rs"}}}));
    for (position, (content, status)) in [("Scan", "completed"), ("Report", "pending")].into_iter().enumerate() {
        conn.execute("INSERT INTO todo VALUES ('ses_1', ?1, ?2, 'medium', ?3, ?4, ?4)", params![content, status, position as i64, NOW]).unwrap();
    }
    let row = rows_of(&path, "ses_1");
    assert_eq!(row.state, TurnState::Working);
    let tool = row.summary.current_tool.clone().unwrap();
    assert_eq!((tool.name.as_str(), tool.detail.as_deref()), ("read", Some("main.rs")));
    let todos = row.summary.todos.clone().unwrap();
    assert_eq!((todos.done, todos.total, todos.current), (1, 2, None));
    assert_eq!(row.summary.context_tokens, Some(525));
    assert_eq!(row.summary.permission_mode, Some("plan"));
}
