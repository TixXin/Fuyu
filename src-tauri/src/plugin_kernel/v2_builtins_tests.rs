use super::*;
use serde_json::json;

const DEFAULT_OFF: [&str; 6] = ["cc-connect", "center-pattern", "claude-usage", "local-api", "session-ring", "ssh-tunnel"];

fn plan_for(migration: &Migration, grants: &Map<String, Value>) -> Option<Plan> {
    plan(migration, grants, off_without_grant(&catalog(), migration))
}

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
    assert_eq!(plan_for(timer(), &on), Some(Plan { id: "timer", disable: false, config: vec![("sound", json!(false)), ("shortcut", json!("Ctrl+Shift+T"))] }));
    let off = grants_of(json!({ "focusd.timer": { "enabled": false } }));
    assert_eq!(plan_for(timer(), &off), Some(Plan { id: "timer", disable: true, config: vec![] }));
    let cleared = grants_of(json!({ "focusd.timer": { "enabled": true, "keybindings": { "new": "" } } }));
    assert_eq!(plan_for(timer(), &cleared).unwrap().config, vec![("shortcut", json!(""))]);
    assert_eq!(plan_for(timer(), &grants_of(json!({ "focusd.local-api": { "enabled": true } }))), None);
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
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: timer\n  disabled: true\n  config:\n    sound: false\n- id: claude-usage\n  disabled: true\n- id: cc-connect\n  disabled: true\n- id: session-ring\n  disabled: true\n- id: local-api\n  disabled: true\n- id: ssh-tunnel\n  disabled: true\n- id: center-pattern\n  disabled: true\n");
    std::fs::write(&file, "[]\n").unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "[]\n");
    let marker: Value = serde_json::from_str(&std::fs::read_to_string(home.join("plugins-v3").join(MARKER)).unwrap()).unwrap();
    assert_eq!(marker, json!({ "format": 1, "migrated": ["focusd.cc-connect", "focusd.center-pattern", "focusd.claude-usage", "focusd.local-api", "focusd.session-ring", "focusd.ssh-proxy-tunnel", "focusd.timer"] }));
}

#[test]
fn without_old_settings_only_the_plugins_that_were_off_unless_granted_start_off() {
    let home = scratch("fresh");
    let file = home.join("plugins-v3").join("plugins.yml");
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "- id: claude-usage\n  disabled: true\n- id: cc-connect\n  disabled: true\n- id: session-ring\n  disabled: true\n- id: local-api\n  disabled: true\n- id: ssh-tunnel\n  disabled: true\n- id: center-pattern\n  disabled: true\n");
    assert!(home.join("plugins-v3").join(MARKER).exists());
}

fn claude_usage() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "claude-usage").unwrap()
}

#[test]
fn the_usage_rings_carry_their_switch_and_settings() {
    let on = grants_of(json!({ "focusd.claude-usage": { "enabled": true, "settings": { "codex": true, "claudeCode": false, "show": "remaining", "askAnthropic": true, "proxy": "http://127.0.0.1:7890", "intervalMinutes": 15, "glm": "yes", "other": 1 } } }));
    assert_eq!(
        plan_for(claude_usage(), &on),
        Some(Plan {
            id: "claude-usage",
            disable: false,
            config: vec![("claudeCode", json!(false)), ("codex", json!(true)), ("askAnthropic", json!(true)), ("show", json!("remaining")), ("proxy", json!("http://127.0.0.1:7890")), ("intervalMinutes", json!(15))],
        })
    );
    let off = grants_of(json!({ "focusd.claude-usage": { "enabled": false, "settings": { "kimi": true } } }));
    assert_eq!(plan_for(claude_usage(), &off), Some(Plan { id: "claude-usage", disable: true, config: vec![("kimi", json!(true))] }));
}

#[test]
fn the_usage_rings_stay_off_when_they_were_never_switched_on() {
    let none = grants_of(json!({ "focusd.timer": { "enabled": true } }));
    assert_eq!(plan_for(claude_usage(), &none), Some(Plan { id: "claude-usage", disable: true, config: vec![] }));
    assert_eq!(plan_for(timer(), &grants_of(json!({}))), None);
}

fn cc_connect() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "cc-connect").unwrap()
}

#[test]
fn cc_connect_carries_its_switch_program_and_runner() {
    let on = grants_of(json!({ "focusd.cc-connect": { "enabled": true, "settings": { "path": "D:\\tools\\cc-connect.exe", "run": true, "other": 1 } } }));
    assert_eq!(plan_for(cc_connect(), &on), Some(Plan { id: "cc-connect", disable: false, config: vec![("path", json!("D:\\tools\\cc-connect.exe")), ("run", json!(true))] }));
    let blank = grants_of(json!({ "focusd.cc-connect": { "enabled": false, "settings": { "path": "  ", "run": "yes" } } }));
    assert_eq!(plan_for(cc_connect(), &blank), Some(Plan { id: "cc-connect", disable: true, config: vec![] }));
    assert_eq!(plan_for(cc_connect(), &grants_of(json!({}))), Some(Plan { id: "cc-connect", disable: true, config: vec![] }));
}

fn session_ring() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "session-ring").unwrap()
}

#[test]
fn the_session_ring_carries_its_switch_style_and_count() {
    let on = grants_of(json!({ "focusd.session-ring": { "enabled": true, "settings": { "style": "signal", "showCount": false, "other": 1 } } }));
    assert_eq!(plan_for(session_ring(), &on), Some(Plan { id: "session-ring", disable: false, config: vec![("style", json!("signal")), ("showCount", json!(false))] }));
    let odd = grants_of(json!({ "focusd.session-ring": { "enabled": false, "settings": { "style": 3, "showCount": "no" } } }));
    assert_eq!(plan_for(session_ring(), &odd), Some(Plan { id: "session-ring", disable: true, config: vec![] }));
    assert_eq!(plan_for(session_ring(), &grants_of(json!({}))), Some(Plan { id: "session-ring", disable: true, config: vec![] }));
}

fn local_api() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "local-api").unwrap()
}

#[test]
fn the_local_api_carries_its_switch_and_allow_write() {
    let on = grants_of(json!({ "focusd.local-api": { "enabled": true, "settings": { "allowWrite": true, "other": 1 } } }));
    assert_eq!(plan_for(local_api(), &on), Some(Plan { id: "local-api", disable: false, config: vec![("allowWrite", json!(true))] }));
    let odd = grants_of(json!({ "focusd.local-api": { "enabled": true, "settings": { "allowWrite": "yes" } } }));
    assert_eq!(plan_for(local_api(), &odd).unwrap().config, vec![]);
    assert_eq!(plan_for(local_api(), &Map::new()), Some(Plan { id: "local-api", disable: true, config: vec![] }));
}

#[test]
fn a_local_api_switched_on_before_the_v2_plugins_is_carried_from_local_api_json() {
    let old = with_old_local_api(Map::new(), Some(r#"{ "enabled": true, "allowWrite": true, "port": 39271, "token": "x" }"#));
    assert_eq!(plan_for(local_api(), &old), Some(Plan { id: "local-api", disable: false, config: vec![("allowWrite", json!(true))] }));
    let read_only = with_old_local_api(Map::new(), Some(r#"{ "enabled": false, "allowWrite": true }"#));
    assert_eq!(plan_for(local_api(), &read_only), Some(Plan { id: "local-api", disable: true, config: vec![("allowWrite", json!(true))] }));
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
    assert_eq!(plan_for(ssh_tunnel(), &on), Some(Plan { id: "ssh-tunnel", disable: false, config: vec![("localProxy", json!("custom")), ("customPort", json!(8118))] }));
    let odd = grants_of(json!({ "focusd.ssh-proxy-tunnel": { "enabled": false, "settings": { "localProxy": 3, "customPort": "8118" } } }));
    assert_eq!(plan_for(ssh_tunnel(), &odd), Some(Plan { id: "ssh-tunnel", disable: true, config: vec![] }));
    assert_eq!(plan_for(ssh_tunnel(), &Map::new()), Some(Plan { id: "ssh-tunnel", disable: true, config: vec![] }));
}

fn center_pattern() -> &'static Migration {
    MIGRATIONS.iter().find(|migration| migration.v3 == "center-pattern").unwrap()
}

#[test]
fn the_center_pattern_carries_its_switch_pattern_pet_and_size() {
    let on = grants_of(json!({ "focusd.center-pattern": { "enabled": true, "settings": { "pattern": "pet", "pet": "noir", "size": 20, "other": 1 } } }));
    assert_eq!(
        plan_for(center_pattern(), &on),
        Some(Plan { id: "center-pattern", disable: false, config: vec![("pattern", json!("pet")), ("pet", json!("noir")), ("size", json!(20))] })
    );
    let odd = grants_of(json!({ "focusd.center-pattern": { "enabled": false, "settings": { "pattern": 1, "pet": true, "size": "20" } } }));
    assert_eq!(plan_for(center_pattern(), &odd), Some(Plan { id: "center-pattern", disable: true, config: vec![] }));
    assert_eq!(plan_for(center_pattern(), &Map::new()), Some(Plan { id: "center-pattern", disable: true, config: vec![] }));
}

fn ids(items: &[&str]) -> BTreeSet<String> {
    items.iter().map(|id| (*id).to_owned()).collect()
}

fn marker_of(home: &Path) -> Value {
    serde_json::from_str(&std::fs::read_to_string(home.join("plugins-v3").join(MARKER)).unwrap()).unwrap()
}

const ALL_MIGRATED: [&str; 7] = ["focusd.cc-connect", "focusd.center-pattern", "focusd.claude-usage", "focusd.local-api", "focusd.session-ring", "focusd.ssh-proxy-tunnel", "focusd.timer"];

#[test]
fn builtins_json_marks_exactly_the_plugins_that_were_off_in_v2() {
    let catalog = catalog();
    let off: BTreeSet<String> = catalog.iter().filter(|plugin| plugin.default_off).map(|plugin| plugin.id.clone()).collect();
    assert_eq!(off, ids(&DEFAULT_OFF));
    for migration in MIGRATIONS {
        assert!(catalog.iter().any(|plugin| plugin.id == migration.v3), "{} is not in builtins.json", migration.v3);
    }
    assert!(!off_without_grant(&catalog, timer()));
}

#[test]
fn from_v0_3_10_with_old_grants_keeps_each_switch_and_carries_the_settings() {
    let home = scratch("v0310-granted");
    let dir = home.join("plugins-v3");
    let file = dir.join("plugins.yml");
    std::fs::write(&file, "- id: timer\n  disabled: true\n").unwrap();
    std::fs::write(dir.join(MARKER), r#"{ "format": 1, "migrated": ["focusd.timer"] }"#).unwrap();
    std::fs::write(
        home.join(V2_STATE),
        json!({ "plugins": {
            "focusd.timer": { "enabled": true },
            "focusd.claude-usage": { "enabled": true, "settings": { "codex": true, "show": "remaining" } },
            "focusd.cc-connect": { "enabled": false, "settings": { "path": "D:\\cc-connect.exe" } },
            "focusd.center-pattern": { "enabled": true, "settings": { "pattern": "pet", "pet": "noir" } }
        } })
        .to_string(),
    )
    .unwrap();
    std::fs::write(home.join(LOCAL_API_FILE), r#"{ "enabled": true, "allowWrite": true, "port": 39271 }"#).unwrap();
    migrate(&home, &file);
    assert_eq!(read_disabled(&file), ids(&["cc-connect", "session-ring", "ssh-tunnel", "timer"]));
    let config = read_config(&file);
    assert_eq!(Value::Object(config["claude-usage"].clone()), json!({ "codex": true, "show": "remaining" }));
    assert_eq!(Value::Object(config["cc-connect"].clone()), json!({ "path": "D:\\cc-connect.exe" }));
    assert_eq!(Value::Object(config["center-pattern"].clone()), json!({ "pattern": "pet", "pet": "noir" }));
    assert_eq!(Value::Object(config["local-api"].clone()), json!({ "allowWrite": true }));
    assert!(!config.contains_key("timer"));
    assert_eq!(marker_of(&home), json!({ "format": 1, "migrated": ALL_MIGRATED }));
}

#[test]
fn from_v0_3_10_without_old_grants_the_six_start_off_and_the_timer_is_left_alone() {
    let home = scratch("v0310-bare");
    let dir = home.join("plugins-v3");
    let file = dir.join("plugins.yml");
    std::fs::write(dir.join(MARKER), r#"{ "format": 1, "migrated": ["focusd.timer"] }"#).unwrap();
    std::fs::write(home.join(V2_STATE), json!({ "plugins": { "focusd.timer": { "enabled": false } } }).to_string()).unwrap();
    migrate(&home, &file);
    assert_eq!(read_disabled(&file), ids(&DEFAULT_OFF));
    assert!(read_config(&file).is_empty());
    assert_eq!(marker_of(&home), json!({ "format": 1, "migrated": ALL_MIGRATED }));
}

#[test]
fn a_new_install_starts_with_the_six_off_and_the_timer_on() {
    let home = scratch("new-install");
    let file = home.join("plugins-v3").join("plugins.yml");
    migrate(&home, &file);
    assert_eq!(read_disabled(&file), ids(&DEFAULT_OFF));
    assert!(read_config(&file).is_empty());
    assert_eq!(marker_of(&home), json!({ "format": 1, "migrated": ALL_MIGRATED }));
    std::fs::write(&file, "[]\n").unwrap();
    migrate(&home, &file);
    assert!(read_disabled(&file).is_empty());
}

#[test]
fn a_beta_install_that_already_migrated_is_not_touched() {
    let home = scratch("beta");
    let dir = home.join("plugins-v3");
    let file = dir.join("plugins.yml");
    let yml = "- id: claude-usage\n  config:\n    show: remaining\n- id: session-ring\n  disabled: true\n";
    std::fs::write(&file, yml).unwrap();
    let marker = json!({ "format": 1, "migrated": ALL_MIGRATED }).to_string();
    std::fs::write(dir.join(MARKER), &marker).unwrap();
    std::fs::write(home.join(V2_STATE), json!({ "plugins": { "focusd.claude-usage": { "enabled": false }, "focusd.local-api": { "enabled": true } } }).to_string()).unwrap();
    migrate(&home, &file);
    assert_eq!(std::fs::read_to_string(&file).unwrap(), yml);
    assert_eq!(std::fs::read_to_string(dir.join(MARKER)).unwrap(), marker);
}

#[test]
fn a_dev_build_without_a_marker_keeps_a_built_in_already_switched_on_in_v3() {
    let home = scratch("dev-no-marker");
    let file = home.join("plugins-v3").join("plugins.yml");
    let yml = "- id: cc-connect\n  config:\n    path: \"D:\\\\cc-connect.exe\"\n";
    std::fs::write(&file, yml).unwrap();
    migrate(&home, &file);
    assert_eq!(read_disabled(&file), ids(&["center-pattern", "claude-usage", "local-api", "session-ring", "ssh-tunnel"]));
    assert_eq!(Value::Object(read_config(&file)["cc-connect"].clone()), json!({ "path": "D:\\cc-connect.exe" }));
    assert!(std::fs::read_to_string(&file).unwrap().starts_with(yml));
    assert_eq!(marker_of(&home), json!({ "format": 1, "migrated": ALL_MIGRATED }));
}
