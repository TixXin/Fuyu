use std::fs;

use super::{answer, bundled, request};
use crate::claude_usage::{
    cached,
    fallback::pick,
    source::{FetchError, Limits},
    UsageErrorKind, UsageWindow,
};

fn success(rate_limits: &str) -> String {
    format!(
        r#"{{"type":"control_response","response":{{"subtype":"success","request_id":"fuyu-usage","response":{{"session":null,"subscription_type":"max","rate_limits_available":true,"rate_limits":{rate_limits},"behaviors":null}}}}}}"#
    )
}

const LIMITS: &str = r#"{"five_hour":{"utilization":12,"resets_at":"2026-11-26T06:40:00.293953+00:00"},"seven_day":{"utilization":0,"resets_at":"2026-12-03T04:00:00.293974+00:00"},"limits":[{"kind":"session","percent":12,"resets_at":"2026-11-26T06:39:59+00:00"},{"kind":"weekly_all","percent":0,"resets_at":"2026-12-03T03:59:59+00:00"}]}"#;

#[test]
fn the_request_asks_for_usage_without_behaviors() {
    let value: serde_json::Value = serde_json::from_str(&request()).unwrap();
    assert_eq!(value["type"], "control_request");
    assert_eq!(value["request"]["subtype"], "get_usage");
    assert_eq!(value["request"]["skip_behaviors"], true);
}

#[test]
fn the_usage_answer_gives_the_five_hour_and_seven_day_windows() {
    let limits = answer(&success(LIMITS)).unwrap().unwrap();
    assert_eq!(limits.five_hour.map(|window| window.percent), Some(12.0));
    assert_eq!(limits.seven_day.map(|window| window.percent), Some(0.0));
}

#[test]
fn other_lines_and_other_requests_are_skipped() {
    assert!(answer(r#"{"type":"system","subtype":"hook_started","hook_event":"SessionStart"}"#).is_none());
    assert!(answer(&success(LIMITS).replace("fuyu-usage", "someone-else")).is_none());
    assert!(answer("not json").is_none());
}

#[test]
fn a_refusal_or_missing_limits_is_an_error_not_an_empty_reading() {
    let refused = r#"{"type":"control_response","response":{"subtype":"error","request_id":"fuyu-usage","error":"Unknown request subtype: get_usage"}}"#;
    let error = answer(refused).unwrap().unwrap_err();
    assert_eq!(error.kind, UsageErrorKind::InvalidResponse);
    assert!(error.message.contains("Unknown request subtype"));
    assert_eq!(answer(&success("null")).unwrap().unwrap_err().kind, UsageErrorKind::LoginRequired);
}

#[test]
fn the_newest_bundled_claude_code_of_the_desktop_app_is_found() {
    let root = std::env::temp_dir().join(format!("fuyu-claude-bundled-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    let name = if cfg!(windows) { "claude.exe" } else { "claude" };
    let old = root.join("2.1.99").join("aaa");
    let new = root.join("2.1.331").join("5cdc5c10ac5c").join("claude.app").join("Contents").join("MacOS");
    fs::create_dir_all(&old).unwrap();
    fs::create_dir_all(&new).unwrap();
    fs::create_dir_all(root.join("staging")).unwrap();
    fs::write(old.join(name), "").unwrap();
    fs::write(new.join(name), "").unwrap();
    assert_eq!(bundled(&root), Some(new.join(name)));
    fs::remove_file(new.join(name)).unwrap();
    assert_eq!(bundled(&root), Some(old.join(name)));
    let _ = fs::remove_dir_all(&root);
    assert_eq!(bundled(&root), None);
}

#[test]
fn claude_codes_cached_usage_counts_only_for_the_signed_in_account() {
    let config = |owner: &str| {
        serde_json::json!({
            "oauthAccount": { "accountUuid": "me" },
            "cachedUsageUtilization": {
                "fetchedAtMs": 1_795_545_064_159_u64,
                "accountUuid": owner,
                "utilization": serde_json::from_str::<serde_json::Value>(LIMITS).unwrap(),
            }
        })
    };
    let usage = cached::parse(&config("me")).unwrap();
    assert_eq!(usage.updated_at, Some(1_795_545_064_159));
    assert_eq!(usage.five_hour.map(|window| window.percent), Some(12.0));
    assert!(cached::parse(&config("someone-else")).is_none());
    assert!(cached::parse(&serde_json::json!({ "oauthAccount": { "accountUuid": "me" } })).is_none());
}

#[test]
fn a_cli_failure_is_shown_when_the_api_could_not_even_try() {
    let limits = || Limits { five_hour: Some(UsageWindow { percent: 5.0, resets_at: None }), seven_day: None };
    let cli = || Some(FetchError::new(UsageErrorKind::Network, "cli timed out"));
    let local = FetchError::new(UsageErrorKind::NoCredentials, "keychain skipped");
    let remote = FetchError::new(UsageErrorKind::RateLimited, "429");
    assert_eq!(pick(cli(), Ok(limits())), Ok(limits()));
    assert_eq!(pick(cli(), Err(local)).unwrap_err().message, "cli timed out");
    assert_eq!(pick(cli(), Err(remote)).unwrap_err().kind, UsageErrorKind::RateLimited);
    assert_eq!(pick(None, Err(FetchError::new(UsageErrorKind::NoProxy, "no proxy"))).unwrap_err().kind, UsageErrorKind::NoProxy);
}

#[test]
#[ignore = "needs Claude Code installed and signed in with a Claude plan on this machine"]
fn the_installed_claude_code_answers_with_live_usage() {
    let home = crate::claude_usage::home_dir().unwrap();
    let limits = super::fetch(&home, None).expect("no Claude Code found").expect("Claude Code did not answer");
    assert!(limits.five_hour.is_some() || limits.seven_day.is_some());
}
