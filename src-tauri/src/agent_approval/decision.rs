use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Agent {
    ClaudeCode,
    Codex,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Permission,
    Question,
}

pub(super) const QUESTION_PATH: &str = "/claude/ask-user-question";
pub(super) const ACTIVITY_PATH: &str = "/claude/activity";

pub(super) fn route(path: &str) -> Option<(Agent, Kind)> {
    match path {
        "/claude/permission-request" => Some((Agent::ClaudeCode, Kind::Permission)),
        "/codex/permission-request" => Some((Agent::Codex, Kind::Permission)),
        QUESTION_PATH => Some((Agent::ClaudeCode, Kind::Question)),
        _ => None,
    }
}

impl Agent {
    pub(super) fn path(self) -> &'static str {
        match self {
            Self::ClaudeCode => "/claude/permission-request",
            Self::Codex => "/codex/permission-request",
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct HookInput {
    pub session_id: String,
    pub cwd: Option<String>,
    pub tool_name: String,
    pub tool_input: Value,
    pub permission_suggestions: Option<Value>,
    pub agent_id: Option<String>,
    pub remote_host: Option<String>,
}

impl HookInput {
    pub(super) fn parse(body: &[u8]) -> Result<Self, &'static str> {
        let input: Value = serde_json::from_slice(body).map_err(|_| "The body is not JSON.")?;
        let text = |key: &str| text_field(&input, key);
        Ok(Self {
            session_id: text("session_id").ok_or("No session_id.")?,
            cwd: text("cwd"),
            tool_name: text("tool_name").ok_or("No tool_name.")?,
            tool_input: input["tool_input"].clone(),
            permission_suggestions: Some(input["permission_suggestions"].clone()).filter(|value| !value.is_null()),
            agent_id: text("agent_id"),
            remote_host: None,
        })
    }

    pub(super) fn is_question(&self) -> bool {
        self.tool_name == "AskUserQuestion"
    }
}

fn text_field(input: &Value, key: &str) -> Option<String> {
    input[key].as_str().filter(|value| !value.is_empty()).map(str::to_string)
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Activity {
    pub session_id: String,
    pub agent_id: Option<String>,
    pub settled: Settled,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) enum Settled {
    ToolCall { tool_name: String, tool_input: Value },
    Turn,
}

impl Activity {
    pub(super) fn parse(body: &[u8]) -> Result<Option<Self>, &'static str> {
        let input: Value = serde_json::from_slice(body).map_err(|_| "The body is not JSON.")?;
        let session_id = text_field(&input, "session_id").ok_or("No session_id.")?;
        let agent_id = text_field(&input, "agent_id");
        let settled = match input["hook_event_name"].as_str().unwrap_or_default() {
            "PostToolUse" | "PostToolUseFailure" | "PermissionDenied" => Settled::ToolCall {
                tool_name: text_field(&input, "tool_name").ok_or("No tool_name.")?,
                tool_input: input["tool_input"].clone(),
            },
            "Stop" | "UserPromptSubmit" => return Ok(Some(Self { session_id, agent_id: None, settled: Settled::Turn })),
            "SubagentStop" if agent_id.is_some() => Settled::Turn,
            _ => return Ok(None),
        };
        Ok(Some(Self { session_id, agent_id, settled }))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Decision {
    Allow,
    Deny,
    AllowAlways,
    Terminal,
    Answer,
}

impl Decision {
    pub(super) fn fits(self, kind: Kind) -> bool {
        match kind {
            Kind::Permission => self != Self::Answer,
            Kind::Question => matches!(self, Self::Answer | Self::Terminal),
        }
    }
}

pub type Answers = std::collections::BTreeMap<String, String>;

const DEFAULT_DENY_MESSAGE: &str = "Denied in Fuyu";

pub(super) fn hook_response(decision: Option<Decision>, message: Option<&str>, suggestions: Option<&Value>) -> String {
    let decision = match decision {
        None | Some(Decision::Terminal | Decision::Answer) => return "{}".to_string(),
        Some(Decision::Allow) => json!({ "behavior": "allow" }),
        Some(Decision::AllowAlways) => match suggestions.and_then(session_only) {
            Some(rules) => json!({ "behavior": "allow", "updatedPermissions": rules }),
            None => json!({ "behavior": "allow" }),
        },
        Some(Decision::Deny) => json!({
            "behavior": "deny",
            "message": message.map(str::trim).filter(|text| !text.is_empty()).unwrap_or(DEFAULT_DENY_MESSAGE),
        }),
    };
    json!({ "hookSpecificOutput": { "hookEventName": "PermissionRequest", "decision": decision } }).to_string()
}

pub(super) fn question_response(answers: Option<&Answers>, tool_input: &Value) -> String {
    let Some(answers) = answers.filter(|answers| !answers.is_empty()) else {
        return "{}".to_string();
    };
    let mut input = tool_input.as_object().cloned().unwrap_or_default();
    input.insert("answers".into(), json!(answers));
    json!({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "updatedInput": input,
        }
    })
    .to_string()
}

fn session_only(suggestions: &Value) -> Option<Value> {
    let rules: Vec<Value> = suggestions
        .as_array()?
        .iter()
        .filter_map(Value::as_object)
        .map(|rule| {
            let mut rule: Map<String, Value> = rule.clone();
            rule.insert("destination".into(), Value::from("session"));
            Value::Object(rule)
        })
        .collect();
    (!rules.is_empty()).then_some(Value::Array(rules))
}
