use super::*;
use rusqlite::{params, Connection};
use serde_json::json;
use std::path::{Path, PathBuf};

const NOW: i64 = 1_763_200_000_000;

const SCHEMA: &str = "
CREATE TABLE session_v2 (
  id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL, directory text NOT NULL, title text,
  version text NOT NULL, model text, agent text, time_created integer NOT NULL, time_updated integer NOT NULL,
  time_archived integer, time_idle integer, idle_outcome text, time_busy integer
);
CREATE TABLE session_message (
  id text PRIMARY KEY, session_id text NOT NULL, type text NOT NULL, seq integer NOT NULL,
  time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL
);
CREATE TABLE session_part (
  message_id text NOT NULL, session_id text NOT NULL, ordinal integer NOT NULL, type text NOT NULL, call_id text,
  time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL, PRIMARY KEY (message_id, ordinal)
);
CREATE TABLE session (
  id text PRIMARY KEY, project_id text NOT NULL, parent_id text, slug text NOT NULL, directory text NOT NULL,
  title text NOT NULL, version text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, time_archived integer
);
CREATE TABLE message (id text PRIMARY KEY, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE part (id text PRIMARY KEY, message_id text NOT NULL, session_id text NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL, data text NOT NULL);
CREATE TABLE todo (session_id text NOT NULL, content text NOT NULL, status text NOT NULL, priority text NOT NULL, position integer NOT NULL, time_created integer NOT NULL, time_updated integer NOT NULL);
";

fn home(name: &str) -> PathBuf {
    let home = std::env::temp_dir().join(format!("fuyu-opencode-remote-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&home);
    std::fs::create_dir_all(home.join(".local/share/opencode")).unwrap();
    home
}

fn fill(db: &Path) {
    let conn = Connection::open(db).unwrap();
    conn.execute_batch(SCHEMA).unwrap();
    conn.execute(
        "INSERT INTO session_v2 (id, project_id, slug, directory, title, version, agent, time_created, time_updated, time_busy, time_idle)
         VALUES ('ses_v2', 'p', 's', '/srv/app', 'Fix the build', '2.3.0', 'build', ?1, ?1, ?2, ?3)",
        params![NOW - 60_000, NOW - 5_000, NOW - 40_000],
    )
    .unwrap();
    for seq in 1..=45_i64 {
        let (kind, data) = match seq {
            1 => ("user", json!({ "text": "first question" })),
            44 => ("user", json!({ "text": "why is it red", "time": { "created": NOW - 10_000 } })),
            _ => ("assistant", json!({ "model": { "id": "gpt-6" }, "content": [], "time": { "created": NOW - 9_000 } })),
        };
        conn.execute(
            "INSERT INTO session_message VALUES (?1, 'ses_v2', ?2, ?3, ?4, ?4, ?5)",
            params![format!("msg_{seq:02}"), kind, seq, NOW - 50_000 + seq, data.to_string()],
        )
        .unwrap();
    }
    let tool = json!({ "type": "tool", "name": "bash", "state": { "status": "running", "input": { "command": "make" }, "output": "x".repeat(200_000) } });
    conn.execute("INSERT INTO session_part VALUES ('msg_45', 'ses_v2', 0, 'tool', 'c1', ?1, ?1, ?2)", params![NOW, tool.to_string()]).unwrap();
    for (id, updated) in [("ses_v1", NOW - 30_000), ("ses_old", NOW - 10 * 86_400_000)] {
        conn.execute(
            "INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?1, 'p', 's', '/srv/old', 'One', '1.19.5', ?2, ?2)",
            params![id, updated],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO message VALUES (?1, ?2, ?3, ?3, ?4)",
            params![format!("m_{id}"), id, updated, json!({ "role": "assistant", "modelID": "gpt-6", "time": { "created": updated, "completed": updated } }).to_string()],
        )
        .unwrap();
        conn.execute("INSERT INTO part VALUES (?1, ?2, ?3, ?4, ?4, ?5)", params![format!("p_{id}"), format!("m_{id}"), id, updated, json!({ "type": "text", "text": "All done." }).to_string()]).unwrap();
        conn.execute("INSERT INTO todo VALUES (?1, 'Ship', 'pending', 'high', 0, ?2, ?2)", params![id, updated]).unwrap();
    }
}

fn window_minutes() -> i64 {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    (now - NOW) / 60_000 + 1_440
}

fn run(home: &Path, path: Option<&Path>) -> String {
    let mut command = std::process::Command::new("/bin/sh");
    command
        .arg("-c")
        .arg(format!("cd \"$HOME\" || exit 3\nexec 2>/dev/null\nW={}\n{FIND}", window_minutes()))
        .env("HOME", home)
        .env_remove("XDG_DATA_HOME")
        .env_remove("OPENCODE_DB");
    if let Some(path) = path {
        command.env("PATH", path);
    }
    String::from_utf8(command.output().unwrap().stdout).unwrap()
}

fn check(home: &Path) {
    let extract = home.join(EXTRACT);
    assert!(std::fs::metadata(&extract).unwrap().len() < 64 * 1024, "the big tool output stays behind");
    let conn = Connection::open(&extract).unwrap();
    let count = |sql: &str| conn.query_row(sql, [], |row| row.get::<_, i64>(0)).unwrap();
    assert_eq!(count("SELECT count(*) FROM session_message"), 41);
    assert_eq!(count("SELECT count(*) FROM session"), 1);
    let roots = ScanRoots { home_dir: home, local_app_dir: None };
    let mut sessions = read_sessions(&roots, NOW, 86_400_000);
    sessions.sort_by(|a, b| a.session_id.cmp(&b.session_id));
    let ids: Vec<_> = sessions.iter().map(|session| session.session_id.as_str()).collect();
    assert_eq!(ids, ["ses_v1", "ses_v2"]);
    let v2 = &sessions[1];
    assert_eq!((v2.title.as_deref(), v2.last_prompt.as_deref(), v2.phase), (Some("Fix the build"), Some("why is it red"), "running"));
    assert_eq!(v2.current_tool.as_ref().and_then(|tool| tool.detail.as_deref()), Some("make"));
    let v1 = &sessions[0];
    assert_eq!((v1.last_message.as_deref(), v1.todos.as_ref().map(|todos| todos.total)), (Some("All done."), Some(1)));
}

#[cfg(unix)]
#[test]
fn the_remote_extract_keeps_recent_sessions_small_and_reads_like_the_local_database() {
    if std::process::Command::new("sqlite3").arg("-version").output().is_err() {
        return;
    }
    let home = home("sqlite3");
    fill(&home.join(".local/share/opencode/opencode.db"));
    assert_eq!(run(&home, None), ".fuyu/opencode-recent.db\n");
    check(&home);
    let built = std::fs::metadata(home.join(EXTRACT)).unwrap().modified().unwrap();
    assert_eq!(run(&home, None), ".fuyu/opencode-recent.db\n");
    assert_eq!(std::fs::metadata(home.join(EXTRACT)).unwrap().modified().unwrap(), built, "an unchanged database is not extracted again");
    let _ = std::fs::remove_dir_all(&home);
}

#[cfg(unix)]
#[test]
fn without_sqlite3_python_does_the_same_and_without_either_nothing_is_sent() {
    let Ok(python) = which("python3") else { return };
    let home = home("python");
    fill(&home.join(".local/share/opencode/opencode.db"));
    let bin = home.join("bin");
    std::fs::create_dir_all(&bin).unwrap();
    for tool in ["stat", "tr", "cat", "mkdir", "rm", "date", "sed", "mv"] {
        std::os::unix::fs::symlink(which(tool).unwrap(), bin.join(tool)).unwrap();
    }
    assert_eq!(run(&home, Some(&bin)), "");
    std::os::unix::fs::symlink(python, bin.join("python3")).unwrap();
    assert_eq!(run(&home, Some(&bin)), ".fuyu/opencode-recent.db\n");
    check(&home);
    let _ = std::fs::remove_dir_all(&home);
}

fn which(tool: &str) -> Result<PathBuf, ()> {
    let output = std::process::Command::new("/bin/sh").arg("-c").arg(format!("command -v {tool}")).output().map_err(|_| ())?;
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.starts_with('/') {
        Ok(PathBuf::from(path))
    } else {
        Err(())
    }
}

#[test]
fn only_the_extract_is_mirrored() {
    assert_eq!(REMOTE_FILES.files, [EXTRACT]);
    assert!(FIND.ends_with("\noc"));
    let roots = ScanRoots { home_dir: Path::new("/nowhere"), local_app_dir: None };
    assert!(read_sessions(&roots, NOW, 1).is_empty());
}
