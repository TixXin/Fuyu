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
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n  config:\n    sound: false\n");
    std::fs::write(&file, "[]\n").unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "[]\n");
    let marker: Value = serde_json::from_str(&std::fs::read_to_string(home.join("plugins-v3").join(MARKER)).unwrap()).unwrap();
    assert_eq!(marker, json!({ "format": 1, "migrated": ["focusd.timer"] }));
}

#[test]
fn without_old_settings_the_default_stays() {
    let home = scratch("fresh");
    let file = home.join("plugins-v3").join("plugins.yml");
    migrate(&home, &file);
    assert!(!file.exists());
    assert!(home.join("plugins-v3").join(MARKER).exists());
}
