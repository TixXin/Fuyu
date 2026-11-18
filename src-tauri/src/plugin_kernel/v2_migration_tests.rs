use std::path::PathBuf;

use serde_json::{json, Value};

use super::{append_market_entry, dismiss, migrate_and_scan, yml_contains_id};

struct TempHome(PathBuf);

impl TempHome {
    fn new(tag: &str) -> Self {
        let dir = std::env::temp_dir().join(format!(
            "fuyu-v2-migration-{tag}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TempHome {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn ignores_v2_builtins_and_stays_silent_for_clean_home() {
    let home = TempHome::new("clean-builtins");
    std::fs::write(
        home.path().join("plugins.json"),
        serde_json::to_string_pretty(&json!({
            "plugins": {
                "focusd.timer": { "enabled": true, "settings": { "sound": false } },
                "focusd.claude-usage": { "enabled": false }
            }
        }))
        .unwrap(),
    )
    .unwrap();

    let snapshot = migrate_and_scan(home.path());
    assert!(snapshot.official.is_empty());
    assert!(snapshot.other.is_empty());
    assert!(!snapshot.island_pending);
    assert!(!snapshot.settings_pending);
    assert!(!home.path().join("plugins-v3/v2-plugins-migration.json").exists());
}

#[test]
fn maps_official_plugin_configs_without_overwriting_existing_v3_configs() {
    let home = TempHome::new("official-configs");
    std::fs::write(
        home.path().join("plugins.json"),
        serde_json::to_string_pretty(&json!({
            "plugins": {
                "dev.focusd.weather": {
                    "enabled": true,
                    "settings": {
                        "city": "Hangzhou",
                        "units": "celsius",
                        "showOnBar": true,
                        "rainAlert": false,
                        "refreshMinutes": 60
                    }
                },
                "dev.focusd.github-issues": {
                    "enabled": true,
                    "settings": {
                        "repo": "TixXin/fly-island, vercel/next.js",
                        "minutes": 20
                    }
                },
                "dev.focusd.now-playing": {
                    "enabled": false,
                    "settings": {
                        "notifyOnChange": true
                    }
                },
                "dev.focusd.system-monitor": {
                    "enabled": true,
                    "settings": {
                        "barCpu": true,
                        "barMemory": false
                    }
                }
            }
        }))
        .unwrap(),
    )
    .unwrap();

    let snapshot = migrate_and_scan(home.path());
    assert_eq!(snapshot.official.len(), 4);
    assert!(snapshot.other.is_empty());
    assert!(snapshot.island_pending);
    assert!(snapshot.settings_pending);

    let weather_cfg: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("plugins-v3/data/@fuyu/weather/config.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(weather_cfg["city"], "Hangzhou");
    assert_eq!(weather_cfg["units"], "celsius");
    assert_eq!(weather_cfg["showOnBar"], true);
    assert_eq!(weather_cfg["rainAlert"], false);
    assert_eq!(weather_cfg["refreshMinutes"], 60);

    let issues_cfg: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("plugins-v3/data/@fuyu/github-issues/config.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(issues_cfg["reposText"], "TixXin/fuyu, vercel/next.js");
    assert_eq!(issues_cfg["refreshMinutes"], 20);

    let now_playing_cfg: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("plugins-v3/data/@fuyu/now-playing/config.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(now_playing_cfg["autoNotify"], true);

    let monitor_cfg: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("plugins-v3/data/@fuyu/system-monitor/config.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(monitor_cfg["showOnBar"], true);
    assert_eq!(monitor_cfg["barCpu"], true);
    assert_eq!(monitor_cfg["barMemory"], false);

    assert!(!home.path().join("plugins-v3/plugins.yml").exists());

    std::fs::write(
        home.path().join("plugins-v3/data/@fuyu/weather/config.json"),
        serde_json::to_string_pretty(&json!({ "city": "Tokyo" })).unwrap(),
    )
    .unwrap();
    let _ = migrate_and_scan(home.path());
    let preserved: Value = serde_json::from_str(
        &std::fs::read_to_string(home.path().join("plugins-v3/data/@fuyu/weather/config.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(preserved["city"], "Tokyo");
}

#[test]
fn guides_installed_v3_official_packages_into_plugins_yml_preserving_switch() {
    let home = TempHome::new("yml-guide");
    std::fs::write(
        home.path().join("plugins.json"),
        serde_json::to_string_pretty(&json!({
            "plugins": {
                "dev.focusd.pomodoro": { "enabled": true },
                "dev.focusd.todo-ring": { "enabled": false }
            }
        }))
        .unwrap(),
    )
    .unwrap();

    for slug in ["pomodoro", "todo-ring"] {
        let pkg_dir = home.path().join("plugins-v3/packages/@fuyu").join(slug);
        std::fs::create_dir_all(&pkg_dir).unwrap();
        std::fs::write(
            pkg_dir.join("package.json"),
            serde_json::to_string_pretty(&json!({ "name": format!("@fuyu/{slug}"), "version": "1.0.0" })).unwrap(),
        )
        .unwrap();
    }
    std::fs::create_dir_all(home.path().join("plugins-v3")).unwrap();
    std::fs::write(home.path().join("plugins-v3/plugins.yml"), "- id: clipboard\r\n  disabled: true\r\n").unwrap();

    let snapshot = migrate_and_scan(home.path());
    let yml = std::fs::read_to_string(home.path().join("plugins-v3/plugins.yml")).unwrap();
    assert!(yml.contains("\r\n"));
    assert!(yml_contains_id(&yml, "clipboard"));
    assert!(yml_contains_id(&yml, "@fuyu/pomodoro"));
    assert!(yml_contains_id(&yml, "@fuyu/todo-ring"));
    let normalized = yml.replace("\r\n", "\n");
    assert!(normalized.contains("- id: \"@fuyu/pomodoro\"\n  source: market\n"));
    assert!(normalized.contains("- id: \"@fuyu/todo-ring\"\n  source: market\n  disabled: true\n"));

    let pomo = snapshot.official.iter().find(|p| p.v2_id == "dev.focusd.pomodoro").unwrap();
    assert!(pomo.installed_in_v3);
    assert!(pomo.registered_in_yml);
}

#[test]
fn detects_third_party_folder_plugins_and_dismisses_once_per_target() {
    let home = TempHome::new("dismiss");
    let custom_dir = home.path().join("plugins/com.example.custom");
    std::fs::create_dir_all(&custom_dir).unwrap();
    std::fs::write(
        custom_dir.join("focusd-plugin.json"),
        serde_json::to_string_pretty(&json!({
            "id": "com.example.custom",
            "name": { "zh-CN": "自定义小插件", "en": "Custom gadget" }
        }))
        .unwrap(),
    )
    .unwrap();

    let first = migrate_and_scan(home.path());
    assert_eq!(first.other.len(), 1);
    assert_eq!(first.other[0].id, "com.example.custom");
    assert_eq!(first.other[0].title.as_ref().unwrap().zh_cn, "自定义小插件");
    assert!(first.island_pending);
    assert!(first.settings_pending);

    let after_island = dismiss(home.path(), "island").unwrap();
    assert!(!after_island.island_pending);
    assert!(after_island.settings_pending);

    let after_settings = dismiss(home.path(), "settings").unwrap();
    assert!(!after_settings.island_pending);
    assert!(!after_settings.settings_pending);

    let bad = dismiss(home.path(), "unknown").unwrap_err();
    assert_eq!(bad.code(), "pluginsV3.invalidDismissTarget");
}

#[test]
fn append_market_entry_handles_empty_and_idempotent_inputs() {
    let from_empty = append_market_entry("[]\n", "@fuyu/weather", false).unwrap();
    assert_eq!(from_empty, "- id: \"@fuyu/weather\"\n  source: market\n");
    let second = append_market_entry(&from_empty, "@fuyu/weather", false).unwrap();
    assert_eq!(second, from_empty);
}
