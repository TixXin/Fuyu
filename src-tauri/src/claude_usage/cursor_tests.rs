use serde_json::json;

use super::*;

#[test]
fn checksum_matches_the_upstream_algorithm_and_ends_with_the_machine_id() {
    let id = uuid_text([0u8; 16]);
    assert_eq!(id, "00000000-0000-4000-8000-000000000000");
    let value = checksum(&id, 1_700_000_000_000);
    assert!(value.ends_with(&id));
    assert_eq!(value.len(), 8 + id.len());
    assert_eq!(checksum("m", 1_700_000_000_000), checksum("m", 1_700_000_999_999));
    assert_ne!(checksum("m", 1_700_000_000_000), checksum("m", 1_700_001_000_000));
}

#[test]
fn current_period_usage_gives_a_month_ring_and_auto_and_api_windows() {
    let answer = json!({
        "billingCycleStart": "1762000000000",
        "billingCycleEnd": "1764600000000",
        "planUsage": { "totalSpend": 1200, "includedSpend": 1200, "limit": 2000, "autoPercentUsed": 12.5, "apiPercentUsed": 47.5, "totalPercentUsed": 60 },
        "enabled": true
    });
    let windows = parse_usage(&answer).expect("usage");
    assert_eq!(windows.len(), 3);
    assert_eq!(windows[0], UsageWindow { name: "month".into(), used: 60.0, resets_at: Some(1_764_600_000_000) });
    assert_eq!(windows[1].name, "cursorAuto");
    assert_eq!(windows[2].used, 47.5);
}

#[test]
fn spend_over_limit_is_used_when_the_percent_is_missing() {
    let answer = json!({ "billingCycleEnd": 1_764_600_000, "planUsage": { "includedSpend": 500, "limit": 2000 } });
    let windows = parse_usage(&answer).expect("usage");
    assert_eq!(windows, vec![UsageWindow { name: "month".into(), used: 25.0, resets_at: Some(1_764_600_000_000) }]);
}

#[test]
fn sand_status_shape_is_understood_too() {
    let answer = json!({ "usagePercent": 142.0, "nextResetTimestampUtc": "1750000000" });
    let windows = parse_usage(&answer).expect("usage");
    assert_eq!(windows, vec![UsageWindow { name: "month".into(), used: 100.0, resets_at: Some(1_750_000_000_000) }]);
}

#[test]
fn pooled_disabled_or_unknown_answers_give_nothing() {
    assert_eq!(parse_usage(&json!({ "usesPooledEnterpriseAllowance": true, "usagePercent": 3 })), None);
    assert_eq!(parse_usage(&json!({ "enabled": false, "planUsage": { "totalPercentUsed": 3 } })), None);
    assert_eq!(parse_usage(&json!({ "planUsage": { "limit": 0, "includedSpend": 3 } })), None);
    assert_eq!(parse_usage(&json!({})), None);
}

#[test]
fn saved_tokens_are_unwrapped() {
    assert_eq!(clean_token("aaa.bbb.ccc").as_deref(), Some("aaa.bbb.ccc"));
    assert_eq!(clean_token("\"aaa.bbb.ccc\"").as_deref(), Some("aaa.bbb.ccc"));
    assert_eq!(clean_token("scoped:v1:user:aaa.bbb.ccc").as_deref(), Some("aaa.bbb.ccc"));
    assert_eq!(clean_token(&STANDARD.encode("aaa.bbb.ccc")).as_deref(), Some("aaa.bbb.ccc"));
    assert_eq!(clean_token("  "), None);
    assert_eq!(clean_token("has space"), None);
}

#[test]
fn membership_becomes_a_plan_label() {
    assert_eq!(plan_label("pro").as_deref(), Some("Pro"));
    assert_eq!(plan_label("\"free_trial\"").as_deref(), Some("Free Trial"));
    assert_eq!(plan_label(""), None);
}

#[test]
fn statuses_map_to_error_kinds() {
    assert_eq!(status_error(200), None);
    assert_eq!(status_error(401).map(|failure| failure.kind), Some(UsageErrorKind::LoginRequired));
    assert_eq!(status_error(404).map(|failure| failure.kind), Some(UsageErrorKind::EndpointChanged));
    assert_eq!(status_error(429).map(|failure| failure.kind), Some(UsageErrorKind::RateLimited));
    assert_eq!(status_error(500).map(|failure| failure.kind), Some(UsageErrorKind::Http));
}
