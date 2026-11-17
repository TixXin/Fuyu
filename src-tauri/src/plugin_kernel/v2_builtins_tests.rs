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
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n  config:\n    sound: false\n- id: claude-usage\n  disabled: true\n- id: cc-connect\n  disabled: true\n- id: session-ring\n  disabled: true\n- id: local-api\n  disabled: true\n- id: ssh-tunnel\n  disabled: true\n");
    std::fs::write(&file, "[]\n").unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "[]\n");
    let marker: Value = serde_json::from_str(&std::fs::read_to_string(home.join("plugins-v3").join(MARKER)).unwrap()).unwrap();
    assert_eq!(marker, json!({ "format": 1, "migrated": ["focusd.cc-connect", "focusd.claude-usage", "focusd.local-api", "focusd.session-ring", "focusd.ssh-proxy-tunnel", "focusd.timer"] }));
}

#[test]
fn without_old_settings_only_the_plugins_that_were_off_unless_granted_start_off() {
    let home = scratch("fresh");
    let file = home.join("plugins-v3").join("plugins.yml");
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: claude-usage\n  disabled: true\n- id: cc-connect\n  disabled: true\n- id: session-ring\n  disabled: true\n- id: local-api\n  disabled: true\n- id: ssh-tunnel\n  disabled: true\n");
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

fn cc_connect() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "cc-connect").unwrap()
}

#[test]
fn cc_connect_carries_its_switch_program_and_runner() {
    let on = grants_of(json!({ "focusd.cc-connect": { "enabled": true, "settings": { "path": "D:\\tools\\cc-connect.exe", "run": true, "other": 1 } } }));
    assert_eq!(plan(cc_connect(), &on), Some(Plan { id: "cc-connect", disable: false, config: vec![("path", json!("D:\\tools\\cc-connect.exe")), ("run", json!(true))] }));
    let blank = grants_of(json!({ "focusd.cc-connect": { "enabled": false, "settings": { "path": "  ", "run": "yes" } } }));
    assert_eq!(plan(cc_connect(), &blank), Some(Plan { id: "cc-connect", disable: true, config: vec![] }));
    assert_eq!(plan(cc_connect(), &grants_of(json!({}))), Some(Plan { id: "cc-connect", disable: true, config: vec![] }));
}

fn session_ring() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "session-ring").unwrap()
}

#[test]
fn the_session_ring_carries_its_switch_style_and_count() {
    let on = grants_of(json!({ "focusd.session-ring": { "enabled": true, "settings": { "style": "signal", "showCount": false, "other": 1 } } }));
    assert_eq!(plan(session_ring(), &on), Some(Plan { id: "session-ring", disable: false, config: vec![("style", json!("signal")), ("showCount", json!(false))] }));
    let odd = grants_of(json!({ "focusd.session-ring": { "enabled": false, "settings": { "style": 3, "showCount": "no" } } }));
    assert_eq!(plan(session_ring(), &odd), Some(Plan { id: "session-ring", disable: true, config: vec![] }));
    assert_eq!(plan(session_ring(), &grants_of(json!({}))), Some(Plan { id: "session-ring", disable: true, config: vec![] }));
}

fn local_api() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "local-api").unwrap()
}

#[test]
fn the_local_api_carries_its_switch_and_allow_write() {
    let on = grants_of(json!({ "focusd.local-api": { "enabled": true, "settings": { "allowWrite": true, "other": 1 } } }));
    assert_eq!(plan(local_api(), &on), Some(Plan { id: "local-api", disable: false, config: vec![("allowWrite", json!(true))] }));
    let odd = grants_of(json!({ "focusd.local-api": { "enabled": true, "settings": { "allowWrite": "yes" } } }));
    assert_eq!(plan(local_api(), &odd).unwrap().config, vec![]);
    assert_eq!(plan(local_api(), &Map::new()), Some(Plan { id: "local-api", disable: true, config: vec![] }));
}

#[test]
fn a_local_api_switched_on_before_the_v2_plugins_is_carried_from_local_api_json() {
    let old = with_old_local_api(Map::new(), Some(r#"{ "enabled": true, "allowWrite": true, "port": 39271, "token": "x" }"#));
    assert_eq!(plan(local_api(), &old), Some(Plan { id: "local-api", disable: false, config: vec![("allowWrite", json!(true))] }));
    let read_only = with_old_local_api(Map::new(), Some(r#"{ "enabled": false, "allowWrite": true }"#));
    assert_eq!(plan(local_api(), &read_only), Some(Plan { id: "local-api", disable: true, config: vec![("allowWrite", json!(true))] }));
    assert!(with_old_local_api(Map::new(), Some(r#"{ "enabled": false, "allowWrite": false }"#)).is_empty());
    assert!(with_old_local_api(Map::new(), Some("not json")).is_empty());
    let granted = grants_of(json!({ "focusd.local-api": { "enabled": false } }));
    assert_eq!(with_old_local_api(granted.clone(), Some(r#"{ "enabled": true }"#)), granted);
}

fn ssh_tunnel() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "ssh-tunnel").unwrap()
}

#[test]
fn the_ssh_tunnel_carries_its_switch_and_local_proxy() {
    let on = grants_of(json!({ "focusd.ssh-proxy-tunnel": { "enabled": true, "settings": { "localProxy": "custom", "customPort": 8118, "other": 1 } } }));
    assert_eq!(plan(ssh_tunnel(), &on), Some(Plan { id: "ssh-tunnel", disable: false, config: vec![("localProxy", json!("custom")), ("customPort", json!(8118))] }));
    let odd = grants_of(json!({ "focusd.ssh-proxy-tunnel": { "enabled": false, "settings": { "localProxy": 3, "customPort": "8118" } } }));
    assert_eq!(plan(ssh_tunnel(), &odd), Some(Plan { id: "ssh-tunnel", disable: true, config: vec![] }));
    assert_eq!(plan(ssh_tunnel(), &Map::new()), Some(Plan { id: "ssh-tunnel", disable: true, config: vec![] }));
}
