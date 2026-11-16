use super::*;
use serde_json::json;

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-v2-builtins-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(dir.join("plugins-v3")).unwrap();
    dir
}

fn timer() -> &'static Migration {
    &MIGRATIONS[0]
}

#[test]
fn the_timer_carries_its_switch_sound_and_shortcut() {
    let on = grants_of(json!({ "focusd.timer": { "enabled": true, "settings": { "sound": false }, "keybindings": { "new": "Ctrl+Shift+T" } } }));
    assert_eq!(plan(timer(), &on), Some(Plan { id: "timer", disable: false, config: vec![("sound", json!(false)), ("shortcut", json!("Ctrl+Shift+T"))] }));
    let off = grants_of(json!({ "focusd.timer": { "enabled": false } }));
    assert_eq!(plan(timer(), &off), Some(Plan { id: "timer", disable: true, config: vec![] }));
    let cleared = grants_of(json!({ "focusd.timer": { "enabled": true, "keybindings": { "new": "" } } }));
    assert_eq!(plan(timer(), &cleared).unwrap().config, vec![("shortcut", json!(""))]);
    assert_eq!(plan(timer(), &grants_of(json!({ "focusd.local-api": { "enabled": true } }))), None);
    assert!(grants("not json").is_empty());
}

fn grants_of(plugins: Value) -> Map<String, Value> {
    grants(&json!({ "plugins": plugins }).to_string())
}

#[test]
fn migrates_once_into_plugins_yml() {
    let home = scratch("once");
    let file = home.join("plugins-v3").join("plugins.yml");
    std::fs::write(home.join(V2_STATE), json!({ "plugins": { "focusd.timer": { "enabled": false, "settings": { "sound": false } } } }).to_string()).unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n  config:\n    sound: false\n- id: claude-usage\n  disabled: true\n");
    std::fs::write(&file, "[]\n").unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "[]\n");
    let marker: Value = serde_json::from_str(&std::fs::read_to_string(home.join("plugins-v3").join(MARKER)).unwrap()).unwrap();
    assert_eq!(marker, json!({ "format": 1, "migrated": ["focusd.claude-usage", "focusd.timer"] }));
}

#[test]
fn without_old_settings_only_the_usage_rings_start_off() {
    let home = scratch("fresh");
    let file = home.join("plugins-v3").join("plugins.yml");
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: claude-usage\n  disabled: true\n");
    assert!(home.join("plugins-v3").join(MARKER).exists());
}

fn claude_usage() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "claude-usage").unwrap()
}

#[test]
fn the_usage_rings_carry_their_switch_and_settings() {
    let on = grants_of(json!({ "focusd.claude-usage": { "enabled": true, "settings": { "codex": true, "claudeCode": false, "show": "remaining", "askAnthropic": true, "proxy": "http://127.0.0.1:7890", "intervalMinutes": 15, "glm": "yes", "other": 1 } } }));
    assert_eq!(
        plan(claude_usage(), &on),
        Some(Plan {
            id: "claude-usage",
            disable: false,
            config: vec![("claudeCode", json!(false)), ("codex", json!(true)), ("askAnthropic", json!(true)), ("show", json!("remaining")), ("proxy", json!("http://127.0.0.1:7890")), ("intervalMinutes", json!(15))],
        })
    );
    let off = grants_of(json!({ "focusd.claude-usage": { "enabled": false, "settings": { "kimi": true } } }));
    assert_eq!(plan(claude_usage(), &off), Some(Plan { id: "claude-usage", disable: true, config: vec![("kimi", json!(true))] }));
}

#[test]
fn the_usage_rings_stay_off_when_they_were_never_switched_on() {
    let none = grants_of(json!({ "focusd.timer": { "enabled": true } }));
    assert_eq!(plan(claude_usage(), &none), Some(Plan { id: "claude-usage", disable: true, config: vec![] }));
    assert_eq!(plan(timer(), &grants_of(json!({}))), None);
}
