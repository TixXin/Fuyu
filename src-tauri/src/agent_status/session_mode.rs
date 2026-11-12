use serde_json::Value;

pub(super) fn claude_permission_mode(raw: &str) -> &'static str {
    match raw {
        "bypassPermissions" => "bypass",
        "auto" => "auto",
        "acceptEdits" => "acceptEdits",
        "plan" => "plan",
        _ => "default",
    }
}

pub(super) fn codex_permission_mode(payload: &Value) -> Option<&'static str> {
    let approval = payload["approval_policy"].as_str()?;
    let full_access = payload["sandbox_policy"]["type"] == "danger-full-access";
    Some(match (approval, full_access) {
        ("never", true) => "bypass",
        ("never", false) => "auto",
        _ => "default",
    })
}

pub(super) fn claude_subagent_calls(content: &Value) -> impl Iterator<Item = &str> {
    content
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"] == "tool_use" && matches!(block["name"].as_str(), Some("Agent" | "Task")))
        .filter_map(|block| block["id"].as_str())
}

pub(super) fn claude_tool_results(content: &Value) -> impl Iterator<Item = &str> {
    content
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"] == "tool_result")
        .filter_map(|block| block["tool_use_id"].as_str())
}
