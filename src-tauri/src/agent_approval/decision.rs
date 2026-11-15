use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Agent {
    ClaudeCode,
    Codex,
    Workbuddy,
    Antigravity,
    Dsh,
    Opencode,
    Qoder,
    Codebuddy,
    Qwen,
    Trae,
    TraeCn,
    Zcode,
    Mimo,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Permission,
    Question,
}

pub(super) const QUESTION_PATH: &str = "/claude/ask-user-question";
pub(super) const ACTIVITY_PATH: &str = "/claude/activity";

const AGENTS: [Agent; 13] = [
    Agent::ClaudeCode,
    Agent::Codex,
    Agent::Workbuddy,
    Agent::Antigravity,
    Agent::Dsh,
    Agent::Opencode,
    Agent::Qoder,
    Agent::Codebuddy,
    Agent::Qwen,
    Agent::Trae,
    Agent::TraeCn,
    Agent::Zcode,
    Agent::Mimo,
];

pub(super) fn route(path: &str) -> Option<(Agent, Kind)> {
    if path == QUESTION_PATH {
        return Some((Agent::ClaudeCode, Kind::Question));
    }
    AGENTS
        .into_iter()
        .find(|agent| agent.path() == path)
        .map(|agent| (agent, Kind::Permission))
}

impl Agent {
    pub(super) fn path(self) -> &'static str {
        match self {
            Self::ClaudeCode => "/claude/permission-request",
            Self::Codex => "/codex/permission-request",
            Self::Workbuddy => "/workbuddy/permission-request",
            Self::Antigravity => "/antigravity/pre-tool-use",
            Self::Dsh => "/dsh/pre-tool-use",
            Self::Opencode => "/opencode/permission",
            Self::Mimo => "/mimo/permission",
            Self::Qoder => "/qoder/permission-request",
            Self::Zcode => "/zcode/permission-request",
            Self::Codebuddy => "/codebuddy/permission-request",
            Self::Qwen => "/qwen/permission-request",
            Self::Trae => "/trae/pre-tool-use",
            Self::TraeCn => "/traeCn/pre-tool-use",
        }
    }

    pub(super) fn id(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claudeCode",
            Self::Codex => "codex",
            Self::Workbuddy => "workbuddy",
            Self::Antigravity => "antigravity",
            Self::Dsh => "dsh",
            Self::Opencode => "opencode",
            Self::Mimo => "mimo",
            Self::Qoder => "qoder",
            Self::Zcode => "zcode",
            Self::Codebuddy => "codebuddy",
            Self::Qwen => "qwen",
            Self::Trae => "trae",
            Self::TraeCn => "traeCn",
        }
    }

    pub(super) fn lacks_waiting_event(self) -> bool {
        matches!(self, Self::Antigravity | Self::Dsh | Self::Trae | Self::TraeCn)
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

    pub(super) fn parse_for(agent: Agent, body: &[u8]) -> Result<Self, &'static str> {
        match agent {
            Agent::Antigravity => {}
            Agent::Opencode | Agent::Mimo => return super::opencode::plugin_input(body),
            _ => return Self::parse(body),
        }
        let input: Value = serde_json::from_slice(body).map_err(|_| "The body is not JSON.")?;
        let cwd = text_field(&input, "cwd").or_else(|| {
            input["workspacePaths"].as_array().and_then(|paths| paths.iter().find_map(|path| path.as_str().map(str::to_string)))
        });
        Ok(Self {
            session_id: text_field(&input, "conversationId").ok_or("No conversationId.")?,
            cwd,
            tool_name: text_field(&input["toolCall"], "name").ok_or("No toolCall.name.")?,
            tool_input: input["toolCall"]["args"].clone(),
            permission_suggestions: None,
            agent_id: None,
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

pub(super) fn permission_response(
    agent: Agent,
    decision: Option<Decision>,
    message: Option<&str>,
    suggestions: Option<&Value>,
) -> String {
    let reason = || message.map(str::trim).filter(|text| !text.is_empty()).unwrap_or(DEFAULT_DENY_MESSAGE);
    match agent {
        Agent::ClaudeCode | Agent::Codex | Agent::Workbuddy | Agent::Qoder | Agent::Codebuddy | Agent::Qwen | Agent::Zcode => {
            hook_response(decision, message, suggestions)
        }
        Agent::Antigravity => match decision {
            None | Some(Decision::Answer) => "{}".to_string(),
            Some(Decision::Allow | Decision::AllowAlways) => json!({ "decision": "allow" }).to_string(),
            Some(Decision::Deny) => json!({ "decision": "deny", "reason": reason() }).to_string(),
            Some(Decision::Terminal) => json!({ "decision": "ask" }).to_string(),
        },
        Agent::Dsh => match decision {
            Some(Decision::Deny) => json!({
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason(),
                }
            })
            .to_string(),
            _ => "{}".to_string(),
        },
        Agent::Trae | Agent::TraeCn => {
            let (decision, reason) = match decision {
                Some(Decision::Allow | Decision::AllowAlways) => ("allow", None),
                Some(Decision::Deny) => ("deny", Some(reason())),
                Some(Decision::Terminal) => ("ask", None),
                None | Some(Decision::Answer) => return "{}".to_string(),
            };
            let mut output = json!({ "hookEventName": "PreToolUse", "permissionDecision": decision });
            if let Some(reason) = reason {
                output["permissionDecisionReason"] = json!(reason);
            }
            json!({ "hookSpecificOutput": output }).to_string()
        }
        Agent::Opencode | Agent::Mimo => super::opencode::plugin_response(decision, message),
    }
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
