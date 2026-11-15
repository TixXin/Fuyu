use std::path::{Path, PathBuf};

use rusqlite::Connection;

use super::*;

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-codex-threads-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn state_db(dir: &Path) -> PathBuf {
    let path = dir.join(STATE_DB);
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch(
        "CREATE TABLE threads (
            id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL, created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL, source TEXT NOT NULL, cwd TEXT NOT NULL, title TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0, first_user_message TEXT NOT NULL DEFAULT '',
            model TEXT, reasoning_effort TEXT, updated_at_ms INTEGER, thread_source TEXT,
            name TEXT, originator TEXT
        );
        INSERT INTO threads VALUES
            ('a', '/gone/rollout-a.jsonl', 1, 1000, 'vscode', '/work/app', 'fix it', 0,
             '# Files mentioned by the user:\n修复底部栏', 'gpt-6', 'high', 1000500, 'user', '修复底部栏头像', 'Codex Desktop'),
            ('b', '', 1, 2000, 'exec', '/work/b', 'b', 0, 'run tests', NULL, NULL, NULL, NULL, NULL, NULL),
            ('old', '/x', 1, 10, 'exec', '/w', 'o', 0, '', NULL, NULL, 10000, NULL, NULL, NULL),
            ('archived', '/x', 1, 3000, 'exec', '/w', 'o', 1, '', NULL, NULL, 3000000, NULL, NULL, NULL),
            ('child', '/x', 1, 3000, '{\"subagent\":{\"other\":\"guardian\"}}', '/w', 'o', 0, '', NULL, NULL, 3000000, 'subagent', NULL, NULL);",
    )
    .unwrap();
    path
}

fn history_db(dir: &Path) {
    let conn = Connection::open(dir.join(HISTORY_DB)).unwrap();
    conn.execute_batch(
        r#"CREATE TABLE thread_items (
            thread_id TEXT NOT NULL, turn_id TEXT NOT NULL, item_id TEXT NOT NULL,
            rollout_ordinal INTEGER NOT NULL, created_at_ms INTEGER NOT NULL, item_json TEXT NOT NULL,
            item_type TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE thread_turns (
            thread_id TEXT NOT NULL, turn_id TEXT NOT NULL, rollout_ordinal INTEGER NOT NULL,
            status TEXT NOT NULL, started_at INTEGER
        );
        INSERT INTO thread_items VALUES
            ('a', 't1', 'u1', 1, 1, '{"type":"userMessage","content":[{"type":"text","text":"第一个问题"}]}', 'userMessage'),
            ('a', 't1', 'm1', 2, 2, '{"type":"agentMessage","text":"旧回复"}', 'agentMessage'),
            ('a', 't2', 'u2', 3, 3, '{"type":"userMessage","content":[{"type":"text","text":"再加一个脚本\n"}]}', 'userMessage'),
            ('a', 't2', 'm2', 4, 4, '{"type":"agentMessage","text":"已经加好了。"}', 'agentMessage'),
            ('b', 't1', 'm1', 1, 1, '{"type":"agentMessage","text":"别的会话"}', 'agentMessage');
        INSERT INTO thread_turns VALUES ('a', 't1', 1, 'completed', 100), ('a', 't2', 3, 'inProgress', 1794506314);"#,
    )
    .unwrap();
}

#[test]
fn lists_recent_threads_without_archived_or_subagents() {
    let dir = temp_dir("list");
    let db = state_db(&dir);
    let threads = read_threads(&db, 500_000).unwrap().unwrap();
    let ids: Vec<_> = threads.iter().map(|thread| thread.id.as_str()).collect();
    assert_eq!(ids, ["b", "a"]);
    let a = &threads[1];
    assert_eq!(a.updated_at, 1_000_500);
    assert_eq!(a.rollout.as_deref(), Some(Path::new("/gone/rollout-a.jsonl")));
    assert_eq!(a.name.as_deref(), Some("修复底部栏头像"));
    assert_eq!(a.model.as_deref(), Some("gpt-6"));
    assert_eq!(a.effort.as_deref(), Some("high"));
    assert_eq!(a.originator.as_deref(), Some("Codex Desktop"));
    assert_eq!(threads[0].rollout, None);
    assert_eq!(threads[0].updated_at, 2_000_000);
    assert_eq!(threads[0].first_prompt.as_deref(), Some("run tests"));
}

#[test]
fn unknown_schema_falls_back() {
    let dir = temp_dir("schema");
    let db = dir.join(STATE_DB);
    Connection::open(&db).unwrap().execute_batch("CREATE TABLE threads (id TEXT, label TEXT);").unwrap();
    assert_eq!(read_threads(&db, 0).unwrap(), None);
    assert_eq!(recent_threads(&dir.join("missing"), 0), None);
}

#[test]
fn reads_last_prompt_reply_and_turn_from_history() {
    let dir = temp_dir("history");
    history_db(&dir);
    let (tail, state) = read_history(&dir.join(HISTORY_DB), "a").unwrap();
    assert_eq!(tail.last_message.as_deref(), Some("已经加好了。"));
    assert_eq!(tail.last_prompt.as_deref(), Some("再加一个脚本"));
    assert_eq!(tail.turn_started_at, Some(1_794_506_314_000));
    assert_eq!(state, TurnState::Working);
    let (empty, done) = read_history(&dir.join("missing.sqlite"), "a").unwrap();
    assert_eq!(empty.last_message, None);
    assert_eq!(done, TurnState::Done);
}

#[test]
fn sqlite_only_summary_uses_thread_fields() {
    let dir = temp_dir("summary");
    history_db(&dir);
    let thread = Thread {
        id: "a".into(),
        updated_at: 42,
        cwd: Some("/work/app".into()),
        model: Some("gpt-6".into()),
        originator: Some("Codex Desktop".into()),
        ..Thread::default()
    };
    let (summary, state) = sqlite_only_summary(&dir, &thread);
    assert_eq!(summary.provider, "codex");
    assert_eq!(summary.updated_at, 42);
    assert_eq!(summary.model.as_deref(), Some("gpt-6"));
    assert_eq!(summary.last_message.as_deref(), Some("已经加好了。"));
    assert!(summary.host.is_some());
    assert_eq!(state, TurnState::Working);
}

#[test]
fn immutable_uri_escapes_special_characters() {
    assert_eq!(
        immutable_uri(Path::new("/Users/a b/#1?/x%.sqlite")),
        "file:/Users/a b/%231%3F/x%25.sqlite?immutable=1"
    );
    assert_eq!(immutable_uri(Path::new(r"C:\Users\a\x.sqlite")), "file:/C:/Users/a/x.sqlite?immutable=1");
}

#[test]
fn opens_database_without_wal_file_read_only() {
    let dir = temp_dir("immutable");
    let db = state_db(&dir);
    let conn = open_read_only(&db).unwrap();
    let count: i64 = conn.query_row("SELECT count(*) FROM threads", [], |row| row.get(0)).unwrap();
    assert_eq!(count, 5);
    assert!(conn.execute("DELETE FROM threads", []).is_err());
}

#[test]
fn parses_item_text() {
    assert_eq!(agent_text(r#"{"text":"  "}"#), None);
    assert_eq!(user_text(r#"{"content":[{"type":"text","text":"a"},{"type":"image"}]}"#).as_deref(), Some("a"));
    assert_eq!(turn_state("failed"), TurnState::Failed);
    assert_eq!(turn_state("completed"), TurnState::Done);
}
