use serde_json::Value;

const STARTED: [&str; 2] = ["running in background with ID: ", "moved to the background (ID: "];
const SUBAGENT_LAUNCHED: &str = "Async agent launched";
const SUBAGENT_ID: &str = "agentId: ";

fn leading_id(text: &str) -> Option<&str> {
    let end = text.find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == '_')).unwrap_or(text.len());
    (end > 0).then(|| &text[..end])
}

pub(super) fn started_tasks(content: &Value) -> Vec<String> {
    let mut ids = Vec::new();
    for block in content.as_array().into_iter().flatten().filter(|block| block["type"] == "tool_result") {
        let texts: Vec<&str> = match &block["content"] {
            Value::String(text) => vec![text.as_str()],
            Value::Array(parts) => parts.iter().filter_map(|part| part["text"].as_str()).collect(),
            _ => Vec::new(),
        };
        for text in texts {
            if text.contains(SUBAGENT_LAUNCHED) {
                if let Some(id) = text.find(SUBAGENT_ID).and_then(|at| leading_id(&text[at + SUBAGENT_ID.len()..])) {
                    ids.push(id.to_string());
                }
            }
            for marker in STARTED {
                if let Some(id) = text.find(marker).and_then(|at| leading_id(&text[at + marker.len()..])) {
                    ids.push(id.to_string());
                }
            }
        }
    }
    ids
}

pub(super) fn ended_tasks(line: &str) -> Vec<&str> {
    let mut ids = Vec::new();
    for (marker, needs) in [("<task-id>", "<status>"), ("stopped task: ", "")] {
        if !line.contains(needs) {
            continue;
        }
        let mut rest = line;
        while let Some(at) = rest.find(marker) {
            rest = &rest[at + marker.len()..];
            if let Some(id) = leading_id(rest) {
                ids.push(id);
            }
        }
    }
    ids
}

#[cfg(test)]
mod tests {
    use super::{ended_tasks, started_tasks};
    use serde_json::json;

    #[test]
    fn starts_and_ends_are_read_from_their_records() {
        let started = json!([
            {"type": "tool_result", "tool_use_id": "t1", "content": "Command running in background with ID: bb33es241. Output is being written to: x"},
            {"type": "tool_result", "tool_use_id": "t2", "content": [{"type": "text", "text": "Command did not complete within its 600s timeout and was moved to the background (ID: b08souj39)."}]},
            {"type": "tool_result", "tool_use_id": "t3", "content": "ok"},
        ]);
        assert_eq!(started_tasks(&started), ["bb33es241", "b08souj39"]);
        let subagents = json!([
            {"type": "tool_result", "tool_use_id": "t4", "content": [{"type": "text", "text": "Async agent launched successfully. (internal metadata)\nagentId: a21b612aff73df8b0 (internal ID)"}]},
            {"type": "tool_result", "tool_use_id": "t5", "content": [{"type": "text", "text": "Done: three findings.\nagentId: a0f1e2d3c4b5a6978 (use SendMessage to continue)"}]},
        ]);
        assert_eq!(started_tasks(&subagents), ["a21b612aff73df8b0"]);
        let finished = r#"{"type":"attachment","attachment":{"type":"queued_command","prompt":"<task-notification>\n<task-id>a21b612aff73df8b0</task-id>\n<tool-use-id>t4</tool-use-id>\n<status>completed</status>"}}"#;
        assert_eq!(ended_tasks(finished), ["a21b612aff73df8b0"]);
        let notified = r#"{"type":"queue-operation","content":"<task-notification>\n<task-id>bggwywldd</task-id>\n<status>completed</status>"}"#;
        assert_eq!(ended_tasks(notified), ["bggwywldd"]);
        assert_eq!(ended_tasks(r#"{"content":"{\"message\":\"Successfully stopped task: b08souj39 (f=...)\"}"}"#), ["b08souj39"]);
        assert!(ended_tasks(r#"{"content":"what is <task-id>?"}"#).is_empty());
    }
}
