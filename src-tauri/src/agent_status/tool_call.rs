use serde::Serialize;
use serde_json::Value;

use super::title::shorten;

const DETAIL_MAX_CHARS: usize = 80;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub(super) name: String,
    pub(super) detail: Option<String>,
}

pub(super) fn claude_tool_call(content: &Value) -> Option<ToolCall> {
    let block = content
        .as_array()?
        .iter()
        .rev()
        .find(|block| block["type"] == "tool_use")?;
    let name = tool_name(block["name"].as_str()?)?;
    let input = &block["input"];
    let text = |key: &str| input[key].as_str().map(str::to_string);
    let detail = match name.as_str() {
        "Bash" | "PowerShell" | "bash" | "shell" => text("command"),
        "Read" | "Edit" | "Write" | "MultiEdit" | "read" | "edit" | "write" => {
            text("file_path").or_else(|| text("path")).or_else(|| text("filePath")).map(|path| file_name(&path))
        }
        "NotebookEdit" => text("notebook_path").map(|path| file_name(&path)),
        "Grep" | "Glob" => text("pattern"),
        "WebFetch" | "browser_navigate" => text("url"),
        "WebSearch" => text("query"),
        "Agent" | "Task" => text("description"),
        "Skill" => text("skill"),
        "SendMessage" => text("to"),
        _ => None,
    };
    Some(ToolCall { name, detail: detail.and_then(|text| shorten(&text, DETAIL_MAX_CHARS)) })
}

pub(super) fn codex_tool_call(payload: &Value) -> Option<ToolCall> {
    let (name, detail) = match payload["type"].as_str()? {
        "function_call" => {
            let arguments = payload["arguments"]
                .as_str()
                .and_then(|arguments| serde_json::from_str::<Value>(arguments).ok())
                .unwrap_or(Value::Null);
            let detail = command_text(&arguments["command"])
                .or_else(|| command_text(&arguments["cmd"]))
                .or_else(|| arguments["path"].as_str().map(file_name));
            (tool_name(payload["name"].as_str()?)?, detail)
        }
        "local_shell_call" => ("shell".to_string(), command_text(&payload["action"]["command"])),
        "custom_tool_call" => (tool_name(payload["name"].as_str()?)?, None),
        _ => return None,
    };
    Some(ToolCall { name, detail: detail.and_then(|text| shorten(&text, DETAIL_MAX_CHARS)) })
}

pub(super) fn antigravity_tool_call(call: &Value) -> Option<ToolCall> {
    let name = tool_name(call["name"].as_str()?)?;
    let args = &call["args"];
    let path = ["AbsolutePath", "Path", "TargetFile"].iter().find_map(|key| args[*key].as_str()).map(file_name);
    let detail = args["CommandLine"].as_str().map(str::to_string).or(path).or_else(|| args["query"].as_str().map(str::to_string));
    Some(ToolCall { name, detail: detail.and_then(|text| shorten(&text, DETAIL_MAX_CHARS)) })
}

pub(super) fn opencode_tool_call(tool: &Value) -> Option<ToolCall> {
    let name = tool_name(tool["name"].as_str().or_else(|| tool["tool"].as_str())?)?;
    let input = &tool["state"]["input"];
    let text = |key: &str| input[key].as_str().map(str::to_string);
    let detail = text("command")
        .or_else(|| text("filePath").map(|path| file_name(&path)))
        .or_else(|| text("pattern"))
        .or_else(|| text("url"))
        .or_else(|| text("description"))
        .or_else(|| text("query"));
    Some(ToolCall { name, detail: detail.and_then(|text| shorten(&text, DETAIL_MAX_CHARS)) })
}

fn tool_name(raw: &str) -> Option<String> {
    let name = raw.rsplit("__").next().unwrap_or(raw).trim();
    (!name.is_empty()).then(|| name.to_string())
}

fn command_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Array(parts) => {
            let parts: Vec<&str> = parts.iter().filter_map(Value::as_str).collect();
            match parts.as_slice() {
                [_, flag, script] if matches!(*flag, "-c" | "-lc" | "-Command" | "/c") => Some((*script).to_string()),
                [] => None,
                _ => Some(parts.join(" ")),
            }
        }
        _ => None,
    }
}

fn file_name(path: &str) -> String {
    path.trim_end_matches(['\\', '/'])
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(path)
        .to_string()
}
