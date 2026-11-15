use super::{cap_text, secret_expired, should_forget, PrivacySettings, FORGET_WINDOW_MS};
use crate::clipboard_history::ClipboardHistoryItem;

fn item(hash: &str, created_at: i64, favorite: bool, masked: bool) -> ClipboardHistoryItem {
    serde_json::from_value(serde_json::json!({
        "id": hash,
        "kind": "text",
        "hash": hash,
        "createdAt": created_at,
        "copiedAt": created_at,
        "favorite": favorite,
        "preview": "x",
        "text": "x",
        "image": null,
        "masked": masked,
    }))
    .unwrap()
}

#[test]
fn only_the_entry_just_recorded_is_forgotten_when_the_clipboard_is_cleared() {
    let now = 1_000_000;
    assert!(should_forget(&item("a", now - 5_000, false, false), Some("a"), now));
    assert!(!should_forget(&item("a", now - FORGET_WINDOW_MS - 1, false, false), Some("a"), now));
    assert!(!should_forget(&item("a", now - 5_000, true, false), Some("a"), now));
    assert!(!should_forget(&item("a", now - 5_000, false, false), Some("b"), now));
    assert!(!should_forget(&item("a", now - 5_000, false, false), None, now));
    assert!(!should_forget(&item("a", now + 5_000, false, false), Some("a"), now));
}

#[test]
fn masked_entries_expire_after_the_chosen_minutes_unless_kept() {
    let now = 10 * 60 * 1000;
    assert!(secret_expired(&item("a", 0, false, true), 10, now));
    assert!(!secret_expired(&item("a", 1, false, true), 10, now));
    assert!(!secret_expired(&item("a", 0, true, true), 10, now));
    assert!(!secret_expired(&item("a", 0, false, false), 10, now));
    assert!(!secret_expired(&item("a", 0, false, true), 0, now));
}

#[test]
fn long_text_is_cut_on_a_character_boundary_and_loses_its_html() {
    let (text, html, truncated) = cap_text("ab浮屿cd".to_string(), Some("<b>x</b>".to_string()), 4);
    assert_eq!((text.as_str(), html, truncated), ("ab", None, true));
    let (text, html, truncated) = cap_text("abc".to_string(), Some("<b>abc</b>".to_string()), 4);
    assert_eq!((text.as_str(), html, truncated), ("abc", None, false));
    let (text, html, truncated) = cap_text("abc".to_string(), Some("<b>".to_string()), 4);
    assert_eq!((text.as_str(), html.as_deref(), truncated), ("abc", Some("<b>"), false));
    let (text, _, truncated) = cap_text("abcdef".to_string(), None, 0);
    assert_eq!((text.as_str(), truncated), ("abcdef", false));
}

#[test]
fn settings_default_to_forgetting_cleared_entries_and_a_one_megabyte_cap() {
    let settings: PrivacySettings = serde_json::from_str("{}").unwrap();
    assert!(settings.forget_cleared());
    assert_eq!(settings.max_text_bytes(), 1024 * 1024);
    let odd: PrivacySettings = serde_json::from_str(r#"{"secretExpiryMinutes":45,"maxTextKb":3000}"#).unwrap();
    let odd = odd.normalized();
    assert_eq!((odd.secret_expiry_minutes, odd.max_text_kb), (60, 4096));
    let off: PrivacySettings = serde_json::from_str(r#"{"maxTextKb":0}"#).unwrap();
    assert_eq!(off.normalized().max_text_bytes(), 0);
}
