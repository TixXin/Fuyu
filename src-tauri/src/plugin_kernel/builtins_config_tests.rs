use super::*;
use serde_json::json;

fn config(text: &str, id: &str) -> Value {
    Value::Object(configs(text).remove(id).unwrap_or_default())
}

#[test]
fn reads_plain_scalars_from_a_config_block() {
    let text = "- id: timer\n  disabled: true\n  config:\n    sound: false\n    shortcut: \"Ctrl+Alt+K\"\n    plain: Ctrl+Alt+J # mine\n    single: 'a b'\n    count: 3\n    ratio: 0.5\n    nested:\n      deep: 1\n    list: [1, 2]\n    empty: ~\n- id: other\n  config: { sound: true }\n";
    assert_eq!(config(text, "timer"), json!({ "sound": false, "shortcut": "Ctrl+Alt+K", "plain": "Ctrl+Alt+J", "single": "a b", "count": 3, "ratio": 0.5 }));
    assert_eq!(config(text, "other"), json!({}));
    assert!(configs("[{ id: timer }]").is_empty());
    assert!(configs("").is_empty());
}

#[test]
fn writes_a_new_entry_or_a_new_block() {
    assert_eq!(set_config("[]\n", "timer", "sound", Some(&json!(false))).unwrap(), "- id: timer\n  config:\n    sound: false\n");
    assert_eq!(set_config("", "timer", "shortcut", Some(&json!("Ctrl+Alt+K"))).unwrap(), "- id: timer\n  config:\n    shortcut: \"Ctrl+Alt+K\"\n");
    assert_eq!(set_config("- id: hello", "timer", "sound", Some(&json!(true))).unwrap(), "- id: hello\n- id: timer\n  config:\n    sound: true\n");
    assert_eq!(set_config("- id: timer\n  disabled: true\n- id: hello\n", "timer", "sound", Some(&json!(false))).unwrap(), "- id: timer\n  disabled: true\n  config:\n    sound: false\n- id: hello\n");
    assert_eq!(set_config("- id: timer\n  config: {}\n", "timer", "sound", Some(&json!(false))).unwrap(), "- id: timer\n  config:\n    sound: false\n");
}

#[test]
fn replaces_or_adds_a_key_in_the_block() {
    let text = "- id: timer\n  config:\n    sound: false\n  disabled: true\n";
    assert_eq!(set_config(text, "timer", "sound", Some(&json!(true))).unwrap(), "- id: timer\n  config:\n    sound: true\n  disabled: true\n");
    assert_eq!(set_config(text, "timer", "shortcut", Some(&json!(""))).unwrap(), "- id: timer\n  config:\n    sound: false\n    shortcut: \"\"\n  disabled: true\n");
}

#[test]
fn removing_the_last_key_drops_the_block_and_a_bare_entry() {
    let text = "- id: hello\n- id: timer\n  config:\n    sound: false\n    shortcut: \"Ctrl+Alt+K\"\n";
    let one = set_config(text, "timer", "sound", None).unwrap();
    assert_eq!(one, "- id: hello\n- id: timer\n  config:\n    shortcut: \"Ctrl+Alt+K\"\n");
    assert_eq!(set_config(&one, "timer", "shortcut", None).unwrap(), "- id: hello\n");
    assert_eq!(set_config("- id: timer\n  disabled: true\n  config:\n    sound: false\n", "timer", "sound", None).unwrap(), "- id: timer\n  disabled: true\n");
    assert_eq!(set_config("- id: timer\n  config:\n    sound: false\n", "timer", "sound", None).unwrap(), "[]\n");
    assert_eq!(set_config("- id: hello\n", "timer", "sound", None).unwrap(), "- id: hello\n");
}

#[test]
fn round_trips_with_the_switch_and_keeps_line_endings() {
    let text = "# mine\r\n- id: hello\r\n";
    let on = set_config(text, "timer", "sound", Some(&json!(false))).unwrap();
    assert_eq!(on, "# mine\r\n- id: hello\r\n- id: timer\r\n  config:\r\n    sound: false\r\n");
    let off = super::super::set_disabled(&on, "timer", true).unwrap();
    assert_eq!(super::super::disabled_ids(&off).into_iter().collect::<Vec<_>>(), ["timer"]);
    assert_eq!(config(&off, "timer"), json!({ "sound": false }));
    let back = super::super::set_disabled(&off, "timer", false).unwrap();
    assert_eq!(set_config(&back, "timer", "sound", None).unwrap(), text);
}

#[test]
fn refuses_what_it_cannot_edit_safely() {
    assert!(set_config("[{ id: timer }]\n", "timer", "sound", Some(&json!(true))).is_err());
    assert!(set_config("- id: timer\n  config: { sound: true }\n", "timer", "sound", Some(&json!(false))).is_err());
    assert!(set_config("- id: timer\n  config:\n    nested:\n      deep: 1\n", "timer", "nested", Some(&json!(1))).is_err());
    assert!(set_config("- id: timer\n", "timer", "bad key", Some(&json!(1))).is_err());
    assert!(set_config("- id: timer\n", "timer", "list", Some(&json!([1]))).is_err());
}

#[test]
fn strings_with_quotes_and_hashes_survive() {
    let text = set_config("[]\n", "timer", "label", Some(&json!("a \"b\" # c"))).unwrap();
    assert_eq!(config(&text, "timer"), json!({ "label": "a \"b\" # c" }));
}
