use std::path::Path;

use super::hooks_state::HookInstallState;
use super::sessions::AgentSessionSummary;
use super::notifications::{is_waiting, saved_notifications, NOTIFICATIONS_DIR};
use super::{antigravity, claude_code, codex, dsh, dsh_hooks, opencode, workbuddy};

pub(super) const HARNESSES: &[Harness] = &[
    codex::HARNESS,
    claude_code::HARNESS,
    workbuddy::HARNESS,
    antigravity::HARNESS,
    DSH,
    opencode::HARNESS,
];

const DSH: Harness = Harness {
    id: dsh::PROVIDER,
    hooks: Some(Hooks {
        install: dsh_hooks::install_hooks,
        check: dsh_hooks::hooks_state,
    }),
    status_light: Some(StatusLight {
        running_marker: "agent-dsh-running.flag",
        running_hold: "agent-dsh-running-hold.flag",
        saved_inputs: &[],
    }),
    sessions: Some(dsh_sessions),
    remote: None,
};

fn dsh_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    if roots.local_app_dir.is_none() {
        return Vec::new();
    }
    dsh::sessions(roots.home_dir, now, window_ms)
}

pub(super) struct Harness {
    pub(super) id: &'static str,
    pub(super) hooks: Option<Hooks>,
    pub(super) status_light: Option<StatusLight>,
    pub(super) sessions: Option<SessionReader>,
    pub(super) remote: Option<RemoteFiles>,
}

pub(super) type SessionReader = fn(&ScanRoots, i64, i64) -> Vec<AgentSessionSummary>;

pub(super) struct ScanRoots<'a> {
    pub(super) home_dir: &'a Path,
    pub(super) local_app_dir: Option<&'a Path>,
}

pub(super) struct HookEnv<'a> {
    pub(super) home_dir: &'a Path,
    pub(super) running_script: &'a Path,
    pub(super) status_script: &'a Path,
}

pub(super) struct Hooks {
    pub(super) install: fn(&HookEnv) -> Result<(), String>,
    pub(super) check: fn(&HookEnv) -> HookInstallState,
}

pub(super) struct StatusLight {
    pub(super) running_marker: &'static str,
    pub(super) running_hold: &'static str,
    pub(super) saved_inputs: &'static [&'static str],
}

pub(super) struct RemoteFiles {
    pub(super) find: &'static [&'static str],
    pub(super) session_dirs: &'static [&'static str],
    pub(super) files: &'static [&'static str],
    pub(super) checkpoint_dirs: &'static [&'static str],
}

pub(super) fn with_status_light() -> impl Iterator<Item = (&'static str, &'static StatusLight)> {
    HARNESSES
        .iter()
        .filter_map(|harness| harness.status_light.as_ref().map(|light| (harness.id, light)))
}

pub(super) fn with_hooks() -> impl Iterator<Item = (&'static str, &'static Hooks)> {
    HARNESSES
        .iter()
        .filter_map(|harness| harness.hooks.as_ref().map(|hooks| (harness.id, hooks)))
}

fn with_remote() -> impl Iterator<Item = (&'static str, &'static RemoteFiles)> {
    HARNESSES
        .iter()
        .filter_map(|harness| harness.remote.as_ref().map(|remote| (harness.id, remote)))
}

pub(super) fn reports_remotely(id: &str) -> bool {
    with_remote().any(|(remote_id, _)| remote_id == id)
}

pub(super) fn remote_ids() -> Vec<&'static str> {
    with_remote().map(|(id, _)| id).collect()
}

pub(super) fn remote_find_lines() -> String {
    with_remote()
        .flat_map(|(_, remote)| remote.find.iter())
        .map(|line| format!("  {line}"))
        .collect::<Vec<_>>()
        .join("\n")
}

pub(super) fn is_mirrored_file(remote: &str) -> bool {
    with_remote().any(|(_, files)| {
        files.files.contains(&remote)
            || (files.session_dirs.iter().any(|dir| remote.starts_with(dir)) && remote.ends_with(".jsonl"))
            || (files.checkpoint_dirs.iter().any(|dir| remote.starts_with(dir)) && remote.ends_with(".json"))
    })
}

pub(super) fn extra_sessions(roots: &ScanRoots, now: i64, window_ms: i64) -> Vec<AgentSessionSummary> {
    let waiting = roots
        .local_app_dir
        .map(|app_dir| saved_notifications(&app_dir.join(NOTIFICATIONS_DIR), now, false).waiting)
        .unwrap_or_default();
    HARNESSES
        .iter()
        .filter_map(|harness| harness.sessions)
        .flat_map(|read| read(roots, now, window_ms))
        .map(|mut summary| {
            if summary.phase == "running" && is_waiting(&waiting, &summary.session_id, summary.updated_at) {
                summary.phase = "waiting";
            }
            summary
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent_status::hooks_state::AgentHooksState;
    use crate::agent_status::snapshot::{agent_status_snapshot_from_persisted, PersistedAgentStatus};
    use serde_json::json;

    #[test]
    fn every_harness_is_listed_once() {
        let mut ids: Vec<_> = HARNESSES.iter().map(|harness| harness.id).collect();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), HARNESSES.len());
        assert_eq!(
            with_status_light().map(|(id, _)| id).collect::<Vec<_>>(),
            ["codex", "claudeCode", "workbuddy", "antigravity", "dsh"]
        );
        assert_eq!(with_hooks().map(|(id, _)| id).collect::<Vec<_>>(), ["codex", "claudeCode", "workbuddy", "antigravity", "dsh"]);
        assert_eq!(remote_ids(), ["codex", "claudeCode"]);
    }

    #[test]
    fn the_status_file_keeps_its_shape() {
        let stored = json!({
            "codex": { "phase": "running", "taskId": "t-1", "updatedAt": 5 },
            "updatedAt": 9,
            "somethingElse": 1,
        });
        let persisted: PersistedAgentStatus = serde_json::from_value(stored).unwrap();
        assert_eq!(persisted.agents["codex"].phase, "running");
        assert_eq!(persisted.agents["claudeCode"].phase, "idle");
        let written = serde_json::to_value(&persisted).unwrap();
        assert_eq!(written["codex"]["taskId"], json!("t-1"));
        assert_eq!(written["claudeCode"]["phase"], json!("idle"));
        assert_eq!(written["updatedAt"], json!(9));
        assert!(serde_json::from_value::<PersistedAgentStatus>(json!({ "codex": "running" })).is_err());

        let snapshot = serde_json::to_value(agent_status_snapshot_from_persisted(persisted, "p".into())).unwrap();
        assert_eq!(snapshot["codex"]["phase"], json!("running"));
        assert_eq!(snapshot["claudeCode"]["phase"], json!("idle"));
        assert_eq!(snapshot["statusPath"], json!("p"));
    }

    #[test]
    fn hooks_state_keeps_its_shape() {
        let state = AgentHooksState {
            agents: [("codex", HookInstallState::Current), ("claudeCode", HookInstallState::NotInstalled)].into(),
            scripts_outdated: true,
        };
        assert_eq!(
            serde_json::to_value(state).unwrap(),
            json!({ "codex": "current", "claudeCode": "notInstalled", "scriptsOutdated": true })
        );
    }

    #[test]
    fn remote_files_come_from_the_list() {
        let lines = remote_find_lines();
        assert!(lines.contains("  find .claude/projects -mindepth 2"));
        assert!(lines.contains("  find .codex/sessions -mindepth 4"));
        assert!(lines.contains("echo .codex/session_index.jsonl"));
        assert!(is_mirrored_file(".claude/projects/p/a.jsonl"));
        assert!(is_mirrored_file(".codex/session_index.jsonl"));
        assert!(!is_mirrored_file(".claude/projects/p/a.json"));
        assert!(!is_mirrored_file(".workbuddy/projects/p/a.jsonl"));
    }
}
