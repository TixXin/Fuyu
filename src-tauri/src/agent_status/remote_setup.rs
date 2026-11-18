use std::path::Path;

use serde::Serialize;
use serde_json::{json, Value};

use super::claude_hooks::{
    install_claude_code_hook_events, ACTIVITY_EVENTS, APPROVAL_HOOK_MARKER_HEADER, APPROVAL_HOOK_TIMEOUT_SECONDS,
    CLAUDE_CODE_WAITING_NOTIFICATIONS,
};
use crate::agent_approval::{self, Agent};
use super::AGENT_HOOK_SIGNATURE;
use super::remote_fetch::{run_ssh, APPROVAL_PORT_FILE};
use super::remote_hosts::{self, SshTarget};
use remote_reply_marker::Change;

pub(super) const REMOTE_NOTIFICATIONS_DIR: &str = ".fuyu/agent-notifications";
pub(super) const LEGACY_REMOTE_NOTIFICATIONS_DIR: &str = ".focusd-island/agent-notifications";
const SETTINGS_PATH: &str = ".claude/settings.json";
const END_OF_TEXT: &str = "FUYU_ISLAND_END_OF_TEXT";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteResult {
    pub(super) host: String,
    pub(super) error: Option<String>,
}

fn remote_hook_entries() -> Vec<(&'static str, Value)> {
    let hook = json!({
        "type": "command",
        "command": format!(
            "umask 077; d=\"$HOME/{REMOTE_NOTIFICATIONS_DIR}\"; mkdir -p \"$d\" && f=\"$d/fuyu-agent-$$-$(date +%s%N)\" && cat > \"$f.tmp\" && mv \"$f.tmp\" \"$f.json\""
        ),
        "timeout": 5
    });
    vec![
        ("PermissionRequest", json!({ "hooks": [hook.clone()] })),
        ("Notification", json!({ "matcher": CLAUDE_CODE_WAITING_NOTIFICATIONS, "hooks": [hook.clone()] })),
        ("PreCompact", json!({ "hooks": [hook.clone()] })),
        ("PostCompact", json!({ "hooks": [hook] })),
    ]
}

pub(super) struct RemoteApproval {
    pub(super) host: String,
    pub(super) path: String,
    pub(super) question_path: String,
    pub(super) activity_path: String,
    pub(super) antigravity_path: String,
}

pub(super) fn path_of(url: Option<String>) -> Option<String> {
    Some(url?.split_once("//")?.1.split_once('/')?.1.to_string())
}

impl RemoteApproval {
    pub(super) fn of(host: &str) -> Option<Self> {
        Some(Self {
            host: host.to_string(),
            path: path_of(agent_approval::hook_url(Agent::ClaudeCode))?,
            question_path: path_of(agent_approval::question_hook_url())?,
            activity_path: path_of(agent_approval::activity_hook_url())?,
            antigravity_path: path_of(agent_approval::hook_url(Agent::Antigravity))?,
        })
    }

    pub(super) fn curl(&self, path: &str, marker: &str, wait: &str, fallback: &str) -> String {
        let header = |text: String| format!(" -H '{text}'");
        format!(
            "read N P H K 2>/dev/null < \"$HOME/{APPROVAL_PORT_FILE}\" && [ \"$H\" = \"$(uname -n)\" ] && [ -n \"$K\" ] && \
             curl -s --noproxy '*' {wait} -H \"Host: 127.0.0.1:$P\" -H \"Authorization: Bearer $K\"{}{}{} --data-binary @- \"http://127.0.0.1:$N/{path}\" || {fallback}",
            header("Content-Type: application/json".into()),
            header(format!("X-Fuyu-Remote: {}", self.host)),
            header(format!("{APPROVAL_HOOK_MARKER_HEADER}: {AGENT_HOOK_SIGNATURE}{marker}")),
        )
    }

    fn entries(&self) -> Vec<(&'static str, Value)> {
        let waiting = format!("-f -m {}", APPROVAL_HOOK_TIMEOUT_SECONDS - 5);
        let hook = |command: String, timeout: i64| json!({ "hooks": [{ "type": "command", "command": command, "timeout": timeout }] });
        let mut entries = vec![
            ("PermissionRequest", hook(self.curl(&self.path, "approval", &waiting, "exit 1"), APPROVAL_HOOK_TIMEOUT_SECONDS)),
            ("PreToolUse", hook(self.curl(&self.question_path, "question", &waiting, "exit 1"), APPROVAL_HOOK_TIMEOUT_SECONDS)),
        ];
        entries[1].1["matcher"] = json!("AskUserQuestion");
        let mut activity = hook(self.curl(&self.activity_path, "activity", "-o /dev/null --connect-timeout 1 -m 5", "exit 1"), 10);
        activity["hooks"][0]["async"] = json!(true);
        entries.extend(ACTIVITY_EVENTS.iter().map(|event| (*event, activity.clone())));
        entries
    }
}

pub(super) fn with_remote_hooks(text: &str, approval: Option<&RemoteApproval>) -> Result<String, String> {
    let mut config = match text.trim() {
        "" => json!({}),
        text => serde_json::from_str::<Value>(text)
            .map_err(|error| format!("Failed to parse ~/{SETTINGS_PATH}: {error}"))?,
    };
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("~/{SETTINGS_PATH} must contain a JSON object"))?;
    let hooks = root.entry("hooks").or_insert_with(|| json!({}));
    if !hooks.is_object() {
        *hooks = json!({});
    }
    if let Some(hooks) = hooks.as_object_mut() {
        let mut entries = remote_hook_entries();
        entries.extend(approval.map(RemoteApproval::entries).unwrap_or_default());
        install_claude_code_hook_events(hooks, entries);
    }
    serde_json::to_string_pretty(&config).map_err(|error| error.to_string())
}

pub(super) fn write_script(path: &str, text: &str) -> Result<String, String> {
    write_script_at(&format!("\"$HOME/{path}\""), &format!("~/{path}"), text)
}

pub(super) fn write_script_at(file: &str, shown: &str, text: &str) -> Result<String, String> {
    if text.lines().any(|line| line == END_OF_TEXT) {
        return Err(format!("{shown} holds the line {END_OF_TEXT}"));
    }
    let body = text.strip_suffix('\n').unwrap_or(text);
    Ok(format!(
        "set -e\numask 077\nf={file}\nif [ -L \"$f\" ]; then echo \"{shown} is a symlink to $(readlink \"$f\"); the island does not change it\" >&2; exit 4; fi\nmkdir -p \"$(dirname \"$f\")\"\n\
         cat > \"$f.fuyu-tmp\" <<'{END_OF_TEXT}'\n{body}\n{END_OF_TEXT}\n\
         cat \"$f.fuyu-tmp\" > \"$f\"\nrm -f \"$f.fuyu-tmp\"\n"
    ))
}

pub(super) fn edit(target: &SshTarget, path: &str, change: &dyn Fn(&str) -> Result<String, String>) -> Result<(), String> {
    let text = run_ssh(target, &format!("cat \"$HOME/{path}\" 2>/dev/null; exit 0\n"))?;
    let text = String::from_utf8(text).map_err(|_| format!("~/{path} is not UTF-8"))?;
    let next = change(&text)?;
    if next.trim_end() == text.trim_end() {
        return Ok(());
    }
    run_ssh(target, &write_script(path, &next)?).map(|_| ())
}

fn for_each_remote(app_dir: &Path, job: &(dyn Fn(&str, &SshTarget) -> Result<(), String> + Sync)) -> Vec<RemoteResult> {
    let targets = remote_hosts::chosen_targets(app_dir);
    std::thread::scope(|scope| {
        let runs: Vec<_> = targets
            .iter()
            .map(|(host, target)| (host, scope.spawn(move || job(host, target))))
            .collect();
        runs.into_iter()
            .map(|(host, run)| RemoteResult {
                host: host.clone(),
                error: run.join().unwrap_or_else(|_| Err("The SSH task failed".to_string())).err(),
            })
            .collect()
    })
}

pub(super) fn install_hooks(app_dir: &Path) -> Vec<RemoteResult> {
    for_each_remote(app_dir, &|host, target| {
        let approval = RemoteApproval::of(host);
        let claude = edit(target, SETTINGS_PATH, &|text| with_remote_hooks(text, approval.as_ref()));
        let antigravity = super::antigravity_remote::install(target, approval.as_ref()).map_err(|error| format!("Antigravity: {error}"));
        let marker = remote_reply_marker::sync(target, Change::Repair).map_err(|error| format!("Reply marker: {error}"));
        let errors: Vec<String> = [claude, antigravity, marker].into_iter().filter_map(Result::err).collect();
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("; "))
        }
    })
}

pub(super) fn without_remote_hooks(text: &str) -> Result<String, String> {
    if text.trim().is_empty() {
        return Ok(text.to_string());
    }
    let original: Value = serde_json::from_str(text)
        .map_err(|error| format!("Failed to parse ~/{SETTINGS_PATH}: {error}"))?;
    let mut config = original.clone();
    let root = config
        .as_object_mut()
        .ok_or_else(|| format!("~/{SETTINGS_PATH} must contain a JSON object"))?;
    if let Some(Value::Object(hooks)) = root.get_mut("hooks") {
        install_claude_code_hook_events(hooks, Vec::new());
    }
    if Some(&*root) == original.as_object() {
        return Ok(text.to_string());
    }
    if root.get("hooks").and_then(Value::as_object).is_some_and(serde_json::Map::is_empty) {
        root.remove("hooks");
    }
    serde_json::to_string_pretty(&config).map_err(|error| error.to_string())
}

pub(super) fn uninstall_hooks(app_dir: &Path) -> Vec<RemoteResult> {
    for_each_remote(app_dir, &|_, target| {
        let claude = edit(target, SETTINGS_PATH, &without_remote_hooks);
        let antigravity = super::antigravity_remote::uninstall(target).map_err(|error| format!("Antigravity: {error}"));
        let cleanup = run_ssh(
            target,
            &format!(
                "rm -rf \"$HOME/{REMOTE_NOTIFICATIONS_DIR}\" \"$HOME/{LEGACY_REMOTE_NOTIFICATIONS_DIR}\" \"$HOME/{APPROVAL_PORT_FILE}\"\n"
            ),
        )
        .map(|_| ());
        let errors: Vec<String> = [claude, antigravity, cleanup].into_iter().filter_map(Result::err).collect();
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("; "))
        }
    })
}

pub(super) fn set_reply_marker(app_dir: &Path, enabled: bool) -> Vec<RemoteResult> {
    let change = if enabled { Change::Enable } else { Change::Disable };
    for_each_remote(app_dir, &|_, target| remote_reply_marker::sync(target, change))
}

#[path = "remote_reply_marker.rs"]
mod remote_reply_marker;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_hooks_go_in_once_beside_the_users_own() {
        let users = r#"{"model":"opus","hooks":{"Notification":[{"hooks":[{"type":"command","command":"notify-send hi"}]}]}}"#;
        let once = with_remote_hooks(users, None).unwrap();
        let twice = with_remote_hooks(&once, None).unwrap();
        assert_eq!(once, twice);
        let config: Value = serde_json::from_str(&twice).unwrap();
        assert_eq!(config["model"], "opus");
        let notification = config["hooks"]["Notification"].as_array().unwrap();
        assert_eq!(notification.len(), 2);
        assert_eq!(notification[0]["hooks"][0]["command"], "notify-send hi");
        assert_eq!(notification[1]["matcher"], CLAUDE_CODE_WAITING_NOTIFICATIONS);
        assert!(config["hooks"]["PermissionRequest"][0]["hooks"][0]["command"]
            .as_str()
            .unwrap()
            .ends_with("mv \"$f.tmp\" \"$f.json\""));
        assert!(config["hooks"]["PostCompact"][0]["hooks"][0]["command"].as_str().unwrap().contains("fuyu-agent-"));
        assert!(with_remote_hooks("", None).is_ok());
        assert!(with_remote_hooks("[1]", None).is_err());
        assert!(with_remote_hooks("{not json", None).is_err());
    }

    #[test]
    #[ignore]
    fn a_forwarded_approval_hook_reaches_the_island_and_the_port_file_goes_with_the_connection() {
        use super::super::remote_fetch::{write_island_config, Connection, Forward};
        use std::io::{Read, Write};
        let Ok(host) = std::env::var("FUYU_SSH_TEST_HOST") else { return };
        let target = SshTarget { destination: host, port: None };
        let listener = std::net::TcpListener::bind("127.0.0.1:47839").unwrap();
        let seen = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(std::time::Duration::from_secs(10))).unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 4096];
            while !request.ends_with(b"{}") {
                let read = stream.read(&mut buffer).unwrap();
                assert!(read > 0, "the request ended early");
                request.extend_from_slice(&buffer[..read]);
            }
            stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\nConnection: close\r\n\r\n{\"ok\":\"yes\"}").unwrap();
            String::from_utf8_lossy(&request).to_string()
        });
        let approval = RemoteApproval {
            host: "test".into(),
            path: "claude/permission-request".into(),
            question_path: String::new(),
            activity_path: String::new(),
            antigravity_path: String::new(),
        };
        let hook = format!("printf '{{}}' | ( {} ); echo \" exit=$?\"\n", approval.curl(&approval.path, "approval", "-f -m 20", "exit 1"));
        let port_file = format!("cat \"$HOME/{APPROVAL_PORT_FILE}\" 2>/dev/null; echo end\n");
        let run = |script: &str| String::from_utf8(run_ssh(&target, script).unwrap()).unwrap().trim().to_string();

        let app_dir = std::env::temp_dir().join(format!("fuyu-ssh-config-{}", std::process::id()));
        let config = write_island_config(&app_dir, "test", &target, Some(47_839)).unwrap();
        let forward = Forward { port: 47_839, token: "ab12".into() };
        let mut connection = Connection::open(&target, Some(&config), Some(forward)).unwrap();
        connection.fetch(1, &std::collections::HashMap::new()).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        connection.fetch(1, &std::collections::HashMap::new()).unwrap();
        let written = run(&port_file);
        println!("port file: {written:?}");
        assert!(written.contains(" 47839 ") && written.ends_with(" ab12"), "{written}");
        let mode = run(&format!("stat -c %a \"$HOME/{APPROVAL_PORT_FILE}\"\n"));
        assert_eq!(mode, "600", "only the user may read the token");
        assert_eq!(run(&hook), "{\"ok\":\"yes\"} exit=0");
        let request = seen.join().unwrap();
        assert!(request.contains("Host: 127.0.0.1:47839\r\n") && request.contains("X-Fuyu-Remote: test\r\n"), "{request}");
        assert!(request.contains("Authorization: Bearer ab12\r\n"), "{request}");

        drop(connection);
        std::thread::sleep(std::time::Duration::from_secs(2));
        assert_eq!(run(&port_file), "end");
        assert_eq!(run(&hook), "exit=1");
    }

    #[test]
    fn approval_hooks_post_with_curl_past_any_proxy_and_go_again_without_the_endpoint() {
        let approval = RemoteApproval {
            host: "zcm6".into(),
            path: "claude/permission-request".into(),
            question_path: "claude/ask-user-question".into(),
            activity_path: "claude/activity".into(),
            antigravity_path: "antigravity/pre-tool-use".into(),
        };
        let with = with_remote_hooks("{}", Some(&approval)).unwrap();
        assert_eq!(with_remote_hooks(&with, Some(&approval)).unwrap(), with);
        let config: Value = serde_json::from_str(&with).unwrap();
        let permission = config["hooks"]["PermissionRequest"].as_array().unwrap();
        assert_eq!(permission.len(), 2);
        let curl = permission[1]["hooks"][0]["command"].as_str().unwrap();
        assert!(curl.starts_with("read N P H K 2>/dev/null < \"$HOME/.fuyu/approval-port\" && [ \"$H\" = \"$(uname -n)\" ] && [ -n \"$K\" ] && curl -s --noproxy '*' -f -m 145 -H \"Host: 127.0.0.1:$P\" -H \"Authorization: Bearer $K\" "));
        assert!(curl.contains("-H 'X-Fuyu-Remote: zcm6'"));
        assert!(curl.ends_with("--data-binary @- \"http://127.0.0.1:$N/claude/permission-request\" || exit 1"));
        assert_eq!(path_of(Some("http://127.0.0.1:47830/claude/activity".into())).as_deref(), Some("claude/activity"));
        assert_eq!(config["hooks"]["PreToolUse"][0]["matcher"], "AskUserQuestion");
        assert_eq!(config["hooks"]["Stop"][0]["hooks"][0]["async"], true);
        let without: Value = serde_json::from_str(&with_remote_hooks(&with, None).unwrap()).unwrap();
        assert_eq!(without["hooks"]["PermissionRequest"].as_array().unwrap().len(), 1);
        assert!(without["hooks"].get("Stop").is_none() && without["hooks"].get("PreToolUse").is_none());
    }

    #[test]
    fn the_write_script_carries_the_text_whole_and_refuses_its_own_end_line() {
        let script = write_script(".claude/CLAUDE.md", "# Rules\n\n$HOME and `ticks` stay\n").unwrap();
        assert!(script.contains("<<'FUYU_ISLAND_END_OF_TEXT'\n# Rules\n\n$HOME and `ticks` stay\nFUYU_ISLAND_END_OF_TEXT\n"));
        assert!(script.contains("cat \"$f.fuyu-tmp\" > \"$f\""));
        assert!(script.starts_with("set -e\numask 077\n"));
        assert!(write_script(".claude/CLAUDE.md", "a\nFUYU_ISLAND_END_OF_TEXT\nb").is_err());
    }
}
