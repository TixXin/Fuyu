use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

use super::harness;
use super::third_party::{is_third_party_id, ThirdPartyAgentStatus};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct AgentTaskStatus {
    #[serde(default = "default_agent_phase")]
    pub(super) phase: String,
    #[serde(default)]
    pub(super) task_id: Option<String>,
    #[serde(default)]
    pub(super) updated_at: i64,
}

impl Default for AgentTaskStatus {
    fn default() -> Self {
        Self {
            phase: default_agent_phase(),
            task_id: None,
            updated_at: 0,
        }
    }
}

pub(super) type AgentStatuses = BTreeMap<&'static str, AgentTaskStatus>;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", try_from = "StoredAgentStatus")]
pub(super) struct PersistedAgentStatus {
    #[serde(flatten)]
    pub(super) agents: AgentStatuses,
    #[serde(flatten, skip_serializing_if = "BTreeMap::is_empty")]
    pub(super) third_party: BTreeMap<String, ThirdPartyAgentStatus>,
    pub(super) updated_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredAgentStatus {
    #[serde(flatten)]
    agents: Map<String, Value>,
    #[serde(default)]
    updated_at: i64,
}

impl TryFrom<StoredAgentStatus> for PersistedAgentStatus {
    type Error = serde_json::Error;

    fn try_from(mut stored: StoredAgentStatus) -> Result<Self, Self::Error> {
        let mut agents = AgentStatuses::new();
        for (id, _) in harness::with_status_light() {
            let status = match stored.agents.remove(id) {
                Some(value) => serde_json::from_value(value)?,
                None => AgentTaskStatus::default(),
            };
            agents.insert(id, status);
        }
        let mut third_party = BTreeMap::new();
        for (id, value) in stored.agents {
            if is_third_party_id(&id) && value.is_object() {
                if let Ok(status) = serde_json::from_value::<ThirdPartyAgentStatus>(value) {
                    third_party.insert(id, status);
                }
            }
        }
        Ok(Self {
            agents,
            third_party,
            updated_at: stored.updated_at,
        })
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusSnapshot {
    #[serde(flatten)]
    pub(super) agents: AgentStatuses,
    pub(super) updated_at: i64,
    pub(super) status_path: String,
    pub(super) others: Vec<super::external::ExternalAgentStatus>,
}

pub(super) fn default_agent_phase() -> String {
    "idle".to_string()
}

pub(super) fn default_agent_status_snapshot(status_path: String) -> AgentStatusSnapshot {
    AgentStatusSnapshot {
        agents: default_agent_statuses(),
        updated_at: current_unix_millis(),
        status_path,
        others: super::external::current(),
    }
}

fn default_agent_statuses() -> AgentStatuses {
    harness::with_status_light()
        .map(|(id, _)| (id, AgentTaskStatus::default()))
        .collect()
}

pub(super) fn default_persisted_agent_status() -> PersistedAgentStatus {
    PersistedAgentStatus {
        agents: default_agent_statuses(),
        third_party: BTreeMap::new(),
        updated_at: current_unix_millis(),
    }
}

pub(super) fn agent_status_snapshot_from_persisted(
    persisted: PersistedAgentStatus,
    status_path: String,
) -> AgentStatusSnapshot {
    let updated_at = if persisted.updated_at > 0 {
        persisted.updated_at
    } else {
        current_unix_millis()
    };
    let mut others: Vec<_> = persisted
        .third_party
        .into_iter()
        .map(|(id, status)| status.to_external(&id, updated_at))
        .collect();
    others.extend(super::external::current());
    AgentStatusSnapshot {
        agents: persisted
            .agents
            .into_iter()
            .map(|(id, status)| (id, normalize_agent_task_status(status)))
            .collect(),
        updated_at,
        status_path,
        others,
    }
}

pub(super) fn normalize_agent_task_status(mut status: AgentTaskStatus) -> AgentTaskStatus {
    if !matches!(
        status.phase.as_str(),
        "idle" | "running" | "completed" | "failed" | "stale"
    ) {
        status.phase = default_agent_phase();
    }

    status
}

pub(super) fn current_unix_millis() -> i64 {
    system_time_to_unix_millis(SystemTime::now()).unwrap_or_default()
}

pub(super) fn system_time_to_unix_millis(time: SystemTime) -> Option<i64> {
    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .ok()
}
