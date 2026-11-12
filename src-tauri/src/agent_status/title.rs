use serde_json::Value;
use std::path::Path;

pub(super) const TITLE_MAX_CHARS: usize = 40;

pub(super) fn user_prompt_in_record(line: &str) -> Option<String> {
    if !line.contains("\"user\"") {
        return None;
    }
    let record = serde_json::from_str::<Value>(line).ok()?;
    if record["type"] != "user" || record["isMeta"] == Value::Bool(true) {
        return None;
    }
    if record["origin"]["kind"] == "task-notification" {
        return None;
    }
    user_message_text(&record["message"]["content"]).and_then(|text| prompt_title(&text))
}

fn user_message_text(content: &Value) -> Option<String> {
    let text = match content {
        Value::String(text) => text.clone(),
        Value::Array(blocks) => {
            if blocks.iter().any(|block| block["type"] == "tool_result") {
                return None;
            }
            blocks
                .iter()
                .filter(|block| block["type"] == "text")
                .filter_map(|block| block["text"].as_str())
                .collect::<Vec<_>>()
                .join(" ")
        }
        _ => return None,
    };

    let trimmed = text.trim_start();
    if trimmed.starts_with("<command-name>") {
        return tag_content(trimmed, "command-args")
            .filter(|args| !args.trim().is_empty())
            .map(str::to_string);
    }
    let is_command_output = ["<local-command", "Caveat:", "<task-notification>"]
        .iter()
        .any(|prefix| trimmed.starts_with(prefix));
    (!is_command_output).then_some(text)
}

fn tag_content<'a>(text: &'a str, tag: &str) -> Option<&'a str> {
    let open = format!("<{tag}>");
    let start = text.find(&open)? + open.len();
    let end = text[start..].find(&format!("</{tag}>"))?;
    Some(&text[start..start + end])
}

pub(super) fn prompt_title(prompt: &str) -> Option<String> {
    let text = strip_image_placeholders(&strip_tags(prompt));
    display_title(text.trim_start().trim_start_matches('#'))
}

fn strip_tags(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find('<') {
        result.push_str(&rest[..start]);
        let candidate = &rest[start..];
        let tag_end = candidate
            .find('>')
            .filter(|&end| is_tag(&candidate[1..end]));
        match tag_end {
            Some(end) => {
                result.push(' ');
                rest = &candidate[end + 1..];
            }
            None => {
                result.push('<');
                rest = &candidate[1..];
            }
        }
    }
    result.push_str(rest);
    result
}

fn is_tag(inner: &str) -> bool {
    let name = inner.strip_prefix('/').unwrap_or(inner);
    name.starts_with(|character: char| character.is_ascii_alphabetic())
        && name.len() <= 200
        && !name.contains('\n')
}

fn strip_image_placeholders(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("[Image #") {
        result.push_str(&rest[..start]);
        let after = &rest[start + "[Image #".len()..];
        let digits = after.len() - after.trim_start_matches(|c: char| c.is_ascii_digit()).len();
        if digits > 0 && after[digits..].starts_with(']') {
            result.push(' ');
            rest = &after[digits + 1..];
        } else {
            result.push('[');
            rest = &rest[start + 1..];
        }
    }
    result.push_str(rest);
    result
}

pub(super) fn codex_thread_name(index: &str, session_id: &str) -> Option<String> {
    index
        .lines()
        .rev()
        .filter(|line| line.contains(session_id))
        .filter_map(|line| serde_json::from_str::<Value>(line).ok())
        .filter(|record| record["id"].as_str() == Some(session_id))
        .find_map(|record| record["thread_name"].as_str().and_then(display_title))
}

pub(super) fn folder_title(cwd: &str) -> Option<String> {
    let folder = Path::new(cwd.trim_end_matches(['\\', '/'])).file_name()?;
    display_title(&folder.to_string_lossy())
}

pub(super) fn display_title(text: &str) -> Option<String> {
    shorten(text, TITLE_MAX_CHARS)
}

pub(super) fn shorten(text: &str, max_chars: usize) -> Option<String> {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return None;
    }
    if collapsed.chars().count() <= max_chars {
        return Some(collapsed);
    }
    let mut title = collapsed
        .chars()
        .take(max_chars.max(2) - 1)
        .collect::<String>()
        .trim_end()
        .to_string();
    title.push('…');
    Some(title)
}

fn bare_title(title: &str) -> String {
    title
        .trim_start_matches(|c: char| !c.is_alphanumeric())
        .trim()
        .trim_end_matches('…')
        .trim()
        .to_lowercase()
}

pub(super) fn tab_shows_title(tab: &str, title: &str) -> bool {
    let wanted = bare_title(title);
    if wanted.chars().count() < 2 {
        return false;
    }
    let tab = bare_title(tab);
    tab == wanted || (title.trim_end().ends_with('…') && tab.starts_with(&wanted))
}

pub(super) fn only_tab_titled(tabs: &[String], title: &str) -> Option<usize> {
    let mut matches = tabs.iter().enumerate().filter(|(_, tab)| tab_shows_title(tab, title));
    let (index, _) = matches.next()?;
    matches.next().is_none().then_some(index)
}
