use std::path::{Path, PathBuf};

use plugin_base::{host_service, ServeError};
use serde::Serialize;

use super::{
    background, codex_usage, external, focus, magpie, notifications, remote_sessions, session_host, session_scan, sessions::AgentSessionSummary, usage,
};
use crate::system::windows_home_dir;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessionEntry {
    key: String,
    provider: String,
    session_id: String,
    title: Option<String>,
    cwd: Option<String>,
    phase: String,
    light: String,
    #[cfg_attr(test, ts(type = "number"))]
    updated_at: i64,
    remote_host: Option<String>,
    listed: bool,
    unseen: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentReportEntry {
    id: String,
    name: String,
    phase: String,
    #[cfg_attr(test, ts(type = "number"))]
    updated_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentSessions {
    sessions: Vec<AgentSessionEntry>,
    others: Vec<AgentReportEntry>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentUsageWindow {
    name: String,
    used: f64,
    #[cfg_attr(test, ts(type = "number | null"))]
    resets_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentUsageReport {
    #[cfg_attr(test, ts(type = "number | null"))]
    updated_at: Option<i64>,
    five_hour: Option<AgentUsageWindow>,
    seven_day: Option<AgentUsageWindow>,
    models: Vec<AgentUsageWindow>,
    plan: Option<String>,
    source: String,
    error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentUsages {
    claude: Option<AgentUsageReport>,
    codex: Option<AgentUsageReport>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentFocus {
    found: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentRemoteHosts {
    hosts: Vec<remote_sessions::RemoteHostStatus>,
}

pub(super) fn local_and_remote(home_dir: &Path, app_dir: &Path, agent_dir: &Path, window_ms: i64) -> Vec<AgentSessionSummary> {
    let waiting = notifications::waiting_notifications(agent_dir);
    let mut sessions = session_scan::list_sessions(home_dir, Some(agent_dir), &waiting, window_ms);
    session_host::attach_hosts(home_dir, Some(agent_dir), &mut sessions);
    sessions.extend(remote_sessions::sessions(app_dir, window_ms));
    let is_active = |phase: &str| matches!(phase, "running" | "waiting");
    sessions.sort_by_key(|session| (!is_active(session.phase), -session.updated_at));
    sessions
}

fn switched_on() -> Result<(), ServeError> {
    if background::switched_on() {
        Ok(())
    } else {
        Err(ServeError::new("inactive", "The agents plugin is switched off."))
    }
}

fn dirs() -> Result<(PathBuf, PathBuf), ServeError> {
    let app_dir = crate::home_dir::current().ok_or_else(|| ServeError::new("failed", "The data folder is not ready yet."))?.to_path_buf();
    let agent_dir = crate::home_dir::real_home().filter(|_| crate::dev_lane::lane().is_some()).unwrap_or_else(|| app_dir.clone());
    Ok((app_dir, agent_dir))
}

fn light(session: &AgentSessionSummary) -> &'static str {
    match session.phase {
        "waiting" => "needs",
        "running" => "working",
        "stale" => "stale",
        "failed" => "failed",
        _ => match session.reply_marker {
            Some("yourTurn") => "yourTurn",
            Some("background") => "working",
            Some(_) => "done",
            None if session.reply_asks => "yourTurn",
            None if session.background_tasks > 0 => "working",
            None => "done",
        },
    }
}

fn entry(session: AgentSessionSummary) -> AgentSessionEntry {
    let light = light(&session).to_owned();
    AgentSessionEntry {
        key: format!("{}:{}", session.provider, session.session_id),
        provider: session.provider.to_owned(),
        session_id: session.session_id,
        title: session.title,
        cwd: session.cwd,
        phase: session.phase.to_owned(),
        light,
        updated_at: session.updated_at,
        remote_host: session.remote_host,
        listed: !session.closed,
        unseen: false,
    }
}

fn label<T: Serialize>(value: &T) -> String {
    serde_json::to_value(value).ok().and_then(|value| value.as_str().map(str::to_owned)).unwrap_or_default()
}

fn window(window: usage::UsageWindow) -> AgentUsageWindow {
    AgentUsageWindow { name: window.name, used: window.used, resets_at: window.resets_at }
}

fn report(usage: usage::AgentUsage) -> AgentUsageReport {
    AgentUsageReport {
        updated_at: usage.updated_at,
        five_hour: usage.five_hour.map(window),
        seven_day: usage.seven_day.map(window),
        models: usage.models.into_iter().map(window).collect(),
        plan: usage.plan,
        source: label(&usage.source),
        error: usage.error.map(|error| label(&error.kind)),
    }
}

#[host_service("agents.sessions")]
fn sessions_for_host() -> Result<AgentSessions, ServeError> {
    switched_on()?;
    let (app_dir, agent_dir) = dirs()?;
    let home_dir = windows_home_dir().map_err(|error| ServeError::new("failed", error))?;
    let sessions = local_and_remote(&home_dir, &app_dir, &agent_dir, session_scan::ACTIVE_WINDOW_MS).into_iter().map(entry).collect();
    let others = external::current()
        .into_iter()
        .map(|other| AgentReportEntry { id: other.id, name: other.name, phase: other.phase, updated_at: other.updated_at })
        .collect();
    Ok(AgentSessions { sessions, others })
}

#[host_service("agents.usage", timeout_ms = 60000)]
async fn usage_for_host() -> Result<AgentUsages, ServeError> {
    switched_on()?;
    let home_dir = windows_home_dir().map_err(|error| ServeError::new("failed", error))?;
    let magpie = magpie::read_usage(&usage::claude_dir(&home_dir)).await;
    let local = magpie.or_else(|| usage::read_usage(&home_dir));
    let claude = usage::merge(local, crate::claude_usage::current()).map(report);
    let codex = codex_usage::read_usage(&home_dir).map(report);
    Ok(AgentUsages { claude, codex })
}

#[host_service("agents.focus")]
fn focus_for_host(provider: String, session_id: Option<String>, cwd: Option<String>, title: Option<String>) -> Result<AgentFocus, ServeError> {
    if provider.is_empty() {
        return Err(ServeError::bad_params("agents.focus", "provider names the agent, for example claudeCode"));
    }
    switched_on()?;
    let (_, agent_dir) = dirs()?;
    let focused = focus::focus_session(Some(&agent_dir), &provider, cwd.as_deref(), title.as_deref(), session_id.as_deref());
    Ok(AgentFocus { found: focused.found })
}

#[host_service("agents.remoteHosts")]
fn remote_hosts_for_host() -> Result<AgentRemoteHosts, ServeError> {
    switched_on()?;
    let (app_dir, _) = dirs()?;
    Ok(AgentRemoteHosts { hosts: remote_sessions::statuses(&app_dir) })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn summary(phase: &'static str) -> AgentSessionSummary {
        AgentSessionSummary {
            provider: "claudeCode",
            session_id: "abc".into(),
            cwd: None,
            title: Some("Fix the build".into()),
            title_source: None,
            model: None,
            effort: None,
            phase,
            last_message: None,
            reply_marker: None,
            reply_asks: false,
            updated_at: 42,
            host: None,
            turn_started_at: None,
            last_prompt: None,
            current_tool: None,
            permission_mode: None,
            subagents: 0,
            background_tasks: 0,
            compacting: false,
            todos: None,
            closed: true,
            remote_host: None,
            parent_id: None,
            context_tokens: None,
        }
    }

    #[test]
    fn a_session_entry_keeps_the_key_the_island_uses() {
        let entry = entry(summary("running"));
        assert_eq!(entry.key, "claudeCode:abc");
        assert_eq!((entry.phase.as_str(), entry.light.as_str()), ("running", "working"));
        assert!(!entry.listed);
        assert!(!entry.unseen);
    }

    #[test]
    fn the_light_matches_the_agent_page() {
        let lit = |phase, marker, asks, background| light(&AgentSessionSummary { reply_marker: marker, reply_asks: asks, background_tasks: background, ..summary(phase) });
        assert_eq!(lit("waiting", None, false, 0), "needs");
        assert_eq!(lit("failed", None, false, 0), "failed");
        assert_eq!(lit("stale", None, false, 0), "stale");
        assert_eq!(lit("running", Some("done"), false, 0), "working");
        assert_eq!(lit("completed", None, true, 0), "yourTurn");
        assert_eq!(lit("completed", Some("done"), true, 0), "done");
        assert_eq!(lit("completed", Some("background"), false, 0), "working");
        assert_eq!(lit("completed", None, false, 2), "working");
        assert_eq!(lit("completed", None, false, 0), "done");
    }

    #[test]
    fn usage_labels_are_the_names_the_window_already_reads() {
        assert_eq!(label(&usage::UsageSource::Codex), "codex");
        assert_eq!(label(&crate::claude_usage::UsageErrorKind::TokenExpired), "tokenExpired");
    }
}
