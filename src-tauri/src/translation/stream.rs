use tauri::ipc::Channel;

use super::provider::Provider;
use crate::user_error::UserError;

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Event {
    Text(String),
    Done,
    CutOff,
    Nothing,
}

pub(super) fn parse_line(line: &str) -> Event {
    let Some(data) = line.trim().strip_prefix("data:") else { return Event::Nothing };
    let data = data.trim();
    if data == "[DONE]" {
        return Event::Done;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(data) else { return Event::Nothing };
    let choice = &value["choices"][0];
    if choice["finish_reason"].as_str() == Some("length") {
        return Event::CutOff;
    }
    match choice["delta"]["content"].as_str() {
        Some(text) if !text.is_empty() => Event::Text(text.to_string()),
        _ => Event::Nothing,
    }
}

pub(super) async fn read(mut response: reqwest::Response, provider: &Provider, on_chunk: &Channel<String>) -> Result<String, UserError> {
    let name = provider.name;
    let unreadable = |error: reqwest::Error| UserError::new("net.unreadable", format!("Could not read {name}'s answer.")).arg("service", name).detail(error);
    let mut pending: Vec<u8> = Vec::new();
    let mut output = String::new();
    'body: while let Some(chunk) = response.chunk().await.map_err(unreadable)? {
        pending.extend_from_slice(&chunk);
        while let Some(end) = pending.iter().position(|&byte| byte == b'\n') {
            let line: Vec<u8> = pending.drain(..=end).collect();
            match parse_line(&String::from_utf8_lossy(&line)) {
                Event::Text(text) => {
                    let _ = on_chunk.send(text.clone());
                    output.push_str(&text);
                }
                Event::Done => break 'body,
                Event::CutOff => {
                    return Err(UserError::new("translation.cutOff", format!("{name} did not finish the translation; try again or shorten the text.")).arg("service", name));
                }
                Event::Nothing => {}
            }
        }
    }
    let output = output.trim().to_string();
    if output.is_empty() {
        return Err(UserError::new("translation.noResult", format!("{name} returned no translation.")).arg("service", name));
    }
    Ok(output)
}

#[cfg(test)]
#[test]
fn event_lines_give_their_text_and_the_end() {
    assert_eq!(parse_line(r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#), Event::Text("你好".into()));
    assert_eq!(parse_line(r#"data: {"choices":[{"delta":{"role":"assistant"}}]}"#), Event::Nothing);
    assert_eq!(parse_line(r#"data: {"choices":[{"delta":{},"finish_reason":"length"}]}"#), Event::CutOff);
    assert_eq!(parse_line("data: [DONE]"), Event::Done);
    assert_eq!(parse_line(": keep-alive"), Event::Nothing);
}
