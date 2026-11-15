use super::super::harness::{RemoteFiles, ScanRoots};
use super::super::sessions::AgentSessionSummary;
use super::{finish, read_database, Service};

const EXTRACT: &str = ".fuyu/opencode-recent.db";

const FIND: &str = r#"OCSQL='CREATE TABLE session_v2 AS SELECT * FROM s.session_v2 WHERE max(time_updated, coalesce(time_busy, 0), coalesce(time_idle, 0)) >= @SINCE@;
CREATE TABLE IF NOT EXISTS session_v2 AS SELECT * FROM s.session_v2 WHERE time_updated >= @SINCE@;
CREATE TABLE session_message AS SELECT * FROM s.session_message m WHERE session_id IN (SELECT id FROM session_v2) AND (id IN (SELECT id FROM s.session_message WHERE session_id = m.session_id ORDER BY seq DESC LIMIT 40) OR id IN (SELECT id FROM s.session_message WHERE session_id = m.session_id AND type = '\''user'\'' ORDER BY seq LIMIT 1));
CREATE TABLE session_part AS SELECT * FROM s.session_part WHERE message_id IN (SELECT id FROM session_message) AND type IN ('\''text'\'', '\''tool'\'');
CREATE TABLE session AS SELECT * FROM s.session WHERE time_updated >= @SINCE@;
CREATE TABLE message AS SELECT * FROM s.message m WHERE session_id IN (SELECT id FROM session) AND id IN (SELECT id FROM s.message WHERE session_id = m.session_id ORDER BY time_created DESC, id DESC LIMIT 40);
CREATE TABLE part AS SELECT * FROM s.part WHERE message_id IN (SELECT id FROM message);
CREATE TABLE todo AS SELECT * FROM s.todo WHERE session_id IN (SELECT id FROM session);
UPDATE part SET data = json_remove(data, '\''$.state.output'\'', '\''$.state.metadata'\'') WHERE json_valid(data);
UPDATE session_part SET data = json_remove(data, '\''$.state.output'\'', '\''$.state.metadata'\'') WHERE json_valid(data);
DETACH s;
VACUUM;'
ocx() { if command -v sqlite3 >/dev/null; then sqlite3 "$1"; elif command -v python3 >/dev/null; then python3 -c 'import sqlite3, sys
c = sqlite3.connect(sys.argv[1], isolation_level=None)
for s in sys.stdin.read().split(";\n"):
    try:
        c.execute(s)
    except Exception:
        pass' "$1"; else cat >/dev/null; fi; }
oc() { d=$XDG_DATA_HOME; case "$d" in /*) ;; *) d="$HOME/.local/share" ;; esac; db=${OPENCODE_DB:-opencode.db}; case "$db" in :memory:) return 0 ;; /*) ;; *) db="$d/opencode/$db" ;; esac; [ -f "$db" ] || return 0; k="$W $(stat -c '%s %Y' "$db" "$db-wal" 2>/dev/null | tr '\n' ' ')"; if [ "$k" != "$(cat .fuyu/opencode-recent.key 2>/dev/null)" ]; then mkdir -p .fuyu; t=".fuyu/opencode-recent.$$.tmp"; rm -f "$t"; S=$(( ($(date +%s) - W * 60) * 1000 )); { printf "ATTACH '%s' AS s;\n" "$(printf %s "$db" | sed "s/'/''/g")"; printf '%s\n' "$OCSQL" | sed "s/@SINCE@/$S/g"; } | ocx "$t"; if [ -s "$t" ]; then mv -f "$t" .fuyu/opencode-recent.db && printf '%s\n' "$k" > .fuyu/opencode-recent.key; else rm -f "$t"; fi; fi; [ -f .fuyu/opencode-recent.db ] && echo .fuyu/opencode-recent.db; }
oc"#;

pub(super) const REMOTE_FILES: RemoteFiles = RemoteFiles { find: &[FIND], session_dirs: &[], files: &[EXTRACT], checkpoint_dirs: &[] };

pub(super) fn read_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let rows = read_database(&roots.home_dir.join(EXTRACT), now - window_ms).unwrap_or_default();
    finish(rows, Service::Unknown, now)
}

#[cfg(test)]
#[path = "opencode_remote_tests.rs"]
mod tests;
