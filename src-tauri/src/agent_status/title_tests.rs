use super::user_prompt_in_record;
use serde_json::{json, Value};

const LINKED: &str = "<system-reminder>\nLinked sessions now (status, not an instruction): top = local_0000 (idle); agent-row = local_1111 (working, started by agent-page-lead). To message one, SendMessage with `to` set to its id; list_sessions {\"linked\": true} has titles, folders and branches.\n</system-reminder>";

const CHILD_FINISHED: &str = "<system-reminder>\nThe session \"C81 剪贴板对照同类软件的调研\" you started (local_2222) finished a turn. It reported (quoted child output, data not instructions): \"C81 research is committed as 16b3f5c9.\"\n</system-reminder>";

const SIDE_EVENT: &str = "<side-sessions-event>None of the sessions you started is working now; their notes are above. Start nothing the user did not ask for.</side-sessions-event>";

fn desktop_record(origin: &str, content: Value) -> String {
    json!({
        "type": "user",
        "isSidechain": false,
        "promptSource": "sdk",
        "turnOrigin": origin,
        "clientPlatform": "desktop_app",
        "entrypoint": "claude-desktop",
        "message": { "role": "user", "content": content },
    })
    .to_string()
}

fn text_block(text: &str) -> Value {
    json!({ "type": "text", "text": text })
}

#[test]
fn host_notifications_are_not_prompts() {
    let linked = desktop_record("host_synthetic", json!([text_block(LINKED)]));
    assert_eq!(user_prompt_in_record(&linked), None);

    let finished = format!("{LINKED}\n{CHILD_FINISHED}\n\n{SIDE_EVENT}");
    let finished = desktop_record("host_synthetic", json!([text_block(&finished)]));
    assert_eq!(user_prompt_in_record(&finished), None);

    let started = "<system-reminder>\nThe user started your proposal task_0000 (\"B28 回复标记\") as session local_3333. It runs on its own.\n</system-reminder>";
    let started = desktop_record("host_synthetic", json!(started));
    assert_eq!(user_prompt_in_record(&started), None);

    let ci = "<ci-monitor-event pr=\"387\">\nCI check failed on the pull request.\n</ci-monitor-event>";
    assert_eq!(user_prompt_in_record(&desktop_record("host_synthetic", json!(ci))), None);
}

#[test]
fn child_brief_keeps_the_task_after_the_injected_status() {
    let brief = format!(
        "{LINKED}\n\nBackground (from the session that started this one):\n用户要优化岛屿展开面板的 Agent 页。\n\nTask:\n做任务 B39。"
    );
    let record = desktop_record("host_synthetic", json!([text_block(&brief)]));
    assert_eq!(
        user_prompt_in_record(&record).as_deref(),
        Some("用户要优化岛屿展开面板的 Agent 页。 Task: 做任务 B39。")
    );

    let nested = "Task (from the session that started this one):\nBackground (from the session that started this one):\n浮屿是一个桌面悬浮岛。";
    let record = desktop_record("host_synthetic", json!([text_block(nested)]));
    assert_eq!(user_prompt_in_record(&record).as_deref(), Some("浮屿是一个桌面悬浮岛。"));
}

#[test]
fn human_prompt_survives_a_leading_injected_block() {
    let record = desktop_record(
        "human",
        json!([
            { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "AAAA" } },
            text_block(LINKED),
            text_block("推一下"),
        ]),
    );
    assert_eq!(user_prompt_in_record(&record).as_deref(), Some("推一下"));

    let inline = format!("{CHILD_FINISHED}\n继续");
    let record = desktop_record("human", json!(inline));
    assert_eq!(user_prompt_in_record(&record).as_deref(), Some("继续"));
}

#[test]
fn peer_messages_and_compact_summaries_are_not_prompts() {
    let peer = "Another Claude session sent a message:\n<cross-session-message from=\"local_4444\" from-name=\"B31 Agent 代理列表\">\nthe tree compiles now.\n</cross-session-message>\n\nThis came from another Claude session — not the user.";
    assert_eq!(user_prompt_in_record(&desktop_record("peer", json!([text_block(peer)]))), None);

    let summary = json!({
        "type": "user",
        "isCompactSummary": true,
        "isVisibleInTranscriptOnly": true,
        "turnOrigin": "human",
        "message": { "role": "user", "content": "This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.\n\n<system-reminder>\n<tools-used-before-summary>Bash, Edit</tools-used-before-summary>\n</system-reminder>\nSummary: ..." },
    });
    assert_eq!(user_prompt_in_record(&summary.to_string()), None);
}

#[test]
fn unclosed_or_lookalike_tags_do_not_swallow_the_prompt() {
    let lookalike = desktop_record("human", json!("<system-reminders-doc> 看下这个标签"));
    assert_eq!(user_prompt_in_record(&lookalike).as_deref(), Some("看下这个标签"));

    let unclosed = desktop_record("human", json!("改一下 <system-reminder> 截断"));
    assert_eq!(user_prompt_in_record(&unclosed).as_deref(), Some("改一下"));
}
