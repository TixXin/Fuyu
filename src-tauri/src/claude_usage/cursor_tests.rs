use serde_json::json;

use super::*;

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
fn usage_summary_cents_and_iso_cycle_end_are_understood() {
    let answer = json!({ "billingCycleEnd": "2026-12-01T00:00:00.000Z", "planUsage": { "used": 900, "limit": 2000, "autoPercentUsed": 0.36 } });
    let windows = parse_usage(&answer).expect("usage");
    assert_eq!(windows[0], UsageWindow { name: "month".into(), used: 45.0, resets_at: Some(1_796_083_200_000) });
    assert_eq!(windows[1].used, 0.36);
    let remaining = json!({ "planUsage": { "remaining": 1500, "limit": 2000 } });
    assert_eq!(parse_usage(&remaining).expect("usage")[0].used, 25.0);
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
fn saved_tokens_are_unwrapped_or_marked_encrypted() {
    use crate::claude_usage::cursor_token::{classify, Stored};
    use base64::{engine::general_purpose::STANDARD, Engine};
    assert_eq!(classify("aaa.bbb.ccc"), Some(Stored::Plain("aaa.bbb.ccc".into())));
    assert_eq!(classify("\"aaa.bbb.ccc\""), Some(Stored::Plain("aaa.bbb.ccc".into())));
    assert_eq!(classify("scoped:v1:user:aaa.bbb.ccc"), Some(Stored::Plain("aaa.bbb.ccc".into())));
    let blob = [b"v10".as_slice(), &[7u8; 16]].concat();
    assert_eq!(classify(&format!("cursor-safe-storage:v1:{}", STANDARD.encode(&blob))), Some(Stored::Encrypted(blob)));
    assert_eq!(classify("cursor-safe-storage:v1:not base64!"), None);
    assert_eq!(classify(&format!("cursor-safe-storage:v1:{}", STANDARD.encode(b"v11xxxx"))), None);
    assert_eq!(classify("  "), None);
    assert_eq!(classify("has space"), None);
}

#[cfg(target_os = "macos")]
#[test]
fn safe_storage_tokens_decrypt_with_the_keychain_password() {
    use cbc::cipher::{block_padding::Pkcs7, BlockModeEncrypt, KeyIvInit};
    let mut key = [0u8; 16];
    pbkdf2::pbkdf2_hmac::<sha1::Sha1>(b"peanuts", b"saltysalt", 1003, &mut key);
    let mut buf = [0u8; 16];
    buf[..11].copy_from_slice(b"aaa.bbb.ccc");
    let sealed = cbc::Encryptor::<aes::Aes128>::new(&key.into(), &[b' '; 16].into())
        .encrypt_padded::<Pkcs7>(&mut buf, 11)
        .expect("fits");
    let blob = [b"v10".as_slice(), sealed].concat();
    assert_eq!(crate::claude_usage::cursor_token::decrypt(&blob, "peanuts").as_deref(), Some("aaa.bbb.ccc"));
    assert_eq!(crate::claude_usage::cursor_token::decrypt(&blob, "wrong"), None);
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

#[test]
#[ignore = "reads this computer's Cursor login and calls api2.cursor.sh"]
fn live_cursor_usage() {
    let usage = tauri::async_runtime::block_on(read(true));
    let windows: Vec<(String, f64)> = usage.models.iter().map(|window| (window.name.clone(), window.used)).collect();
    println!("plan={:?} windows={windows:?} error={:?}", usage.plan, usage.error.as_ref().map(|failure| (failure.kind, failure.message.clone())));
    assert!(usage.error.is_none());
    assert!(!usage.models.is_empty());
}
