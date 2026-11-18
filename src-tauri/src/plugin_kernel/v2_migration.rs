use std::{
    collections::{BTreeMap, BTreeSet},
    path::Path,
    sync::{Mutex, OnceLock, PoisonError},
};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter};

use super::{builtins_file, v2_builtins};
use crate::user_error::UserError;

pub(crate) const CHANGED_EVENT: &str = "v2-plugin-migration-changed";

const V2_STATE_FILE: &str = "plugins.json";
const V2_PLUGINS_DIR: &str = "plugins";
const V2_MANIFEST_LEGACY: &str = "focusd-plugin.json";
const V2_MANIFEST_CURRENT: &str = "fuyu-plugin.json";
const V3_DIR: &str = "plugins-v3";
const V3_CONFIG_FILE: &str = "plugins.yml";
const V3_PACKAGES_DIR: &str = "packages";
const V3_DATA_DIR: &str = "data";
const PLUGIN_CONFIG_FILE: &str = "config.json";
const RECORD_FILE: &str = "v2-plugins-migration.json";
const RECORD_FORMAT: u32 = 1;

static WRITE_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn write_lock() -> &'static Mutex<()> {
    WRITE_LOCK.get_or_init(|| Mutex::new(()))
}

type ConfigBuilder = fn(&Map<String, Value>) -> Option<Value>;

struct OfficialMapping {
    v2_id: &'static str,
    v3_id: &'static str,
    slug: &'static str,
    zh_cn: &'static str,
    en: &'static str,
    build_config: Option<ConfigBuilder>,
}

const OFFICIAL_MAPPINGS: &[OfficialMapping] = &[
    OfficialMapping {
        v2_id: "dev.focusd.pomodoro",
        v3_id: "@fuyu/pomodoro",
        slug: "pomodoro",
        zh_cn: "番茄钟",
        en: "Pomodoro",
        build_config: None,
    },
    OfficialMapping {
        v2_id: "dev.focusd.todo-digest",
        v3_id: "@fuyu/todo-digest",
        slug: "todo-digest",
        zh_cn: "待办摘要",
        en: "Todo digest",
        build_config: None,
    },
    OfficialMapping {
        v2_id: "dev.focusd.todo-ring",
        v3_id: "@fuyu/todo-ring",
        slug: "todo-ring",
        zh_cn: "待办进度环",
        en: "Todo progress ring",
        build_config: None,
    },
    OfficialMapping {
        v2_id: "dev.focusd.now-playing",
        v3_id: "@fuyu/now-playing",
        slug: "now-playing",
        zh_cn: "正在播放",
        en: "Now playing",
        build_config: Some(map_now_playing_config),
    },
    OfficialMapping {
        v2_id: "dev.focusd.weather",
        v3_id: "@fuyu/weather",
        slug: "weather",
        zh_cn: "天气",
        en: "Weather",
        build_config: Some(map_weather_config),
    },
    OfficialMapping {
        v2_id: "dev.focusd.github-issues",
        v3_id: "@fuyu/github-issues",
        slug: "github-issues",
        zh_cn: "GitHub Issue",
        en: "GitHub issues",
        build_config: Some(map_github_issues_config),
    },
    OfficialMapping {
        v2_id: "dev.focusd.system-monitor",
        v3_id: "@fuyu/system-monitor",
        slug: "system-monitor",
        zh_cn: "系统监控",
        en: "System monitor",
        build_config: Some(map_system_monitor_config),
    },
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct LocalizedTitle {
    #[serde(rename = "zh-CN")]
    pub(crate) zh_cn: String,
    pub(crate) en: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OfficialPluginMigration {
    pub(crate) v2_id: String,
    pub(crate) v3_id: String,
    pub(crate) title: LocalizedTitle,
    pub(crate) enabled_in_v2: bool,
    pub(crate) config_migrated: bool,
    pub(crate) installed_in_v3: bool,
    pub(crate) registered_in_yml: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyV2Plugin {
    pub(crate) id: String,
    pub(crate) title: Option<LocalizedTitle>,
    pub(crate) enabled_in_v2: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct V2MigrationSnapshot {
    pub(crate) official: Vec<OfficialPluginMigration>,
    pub(crate) other: Vec<LegacyV2Plugin>,
    pub(crate) island_pending: bool,
    pub(crate) settings_pending: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MigrationRecord {
    format: u32,
    #[serde(default)]
    config_checked: BTreeSet<String>,
    #[serde(default)]
    config_written: BTreeSet<String>,
    #[serde(default)]
    yml_guided: BTreeSet<String>,
    #[serde(default)]
    island_dismissed: BTreeSet<String>,
    #[serde(default)]
    settings_dismissed: BTreeSet<String>,
}

#[derive(Debug, Default, Clone)]
struct DiscoveredV2 {
    enabled: bool,
    settings: Map<String, Value>,
    title: Option<LocalizedTitle>,
}

fn is_v2_builtin(id: &str) -> bool {
    v2_builtins::MIGRATIONS.iter().any(|item| item.v2 == id)
}

fn find_official(v2_id: &str) -> Option<&'static OfficialMapping> {
    OFFICIAL_MAPPINGS.iter().find(|item| item.v2_id == v2_id)
}

fn clamp_i64(value: Option<&Value>, default: i64, min: i64, max: i64) -> i64 {
    value
        .and_then(|raw| raw.as_i64().or_else(|| raw.as_f64().map(|num| num.round() as i64)))
        .unwrap_or(default)
        .clamp(min, max)
}

fn map_now_playing_config(settings: &Map<String, Value>) -> Option<Value> {
    let notify = settings.get("notifyOnChange").and_then(Value::as_bool)?;
    Some(json!({
        "autoNotify": notify,
        "locale": "zh-CN",
    }))
}

fn map_weather_config(settings: &Map<String, Value>) -> Option<Value> {
    if settings.is_empty() {
        return None;
    }
    let city = settings.get("city").and_then(Value::as_str).unwrap_or("").trim();
    let units = match settings.get("units").and_then(Value::as_str) {
        Some("fahrenheit") => "fahrenheit",
        _ => "celsius",
    };
    let show_on_bar = settings.get("showOnBar").and_then(Value::as_bool).unwrap_or(true);
    let rain_alert = settings.get("rainAlert").and_then(Value::as_bool).unwrap_or(true);
    let refresh_minutes = clamp_i64(settings.get("refreshMinutes"), 30, 30, 180);
    if city.is_empty()
        && !settings.contains_key("units")
        && !settings.contains_key("showOnBar")
        && !settings.contains_key("rainAlert")
        && !settings.contains_key("refreshMinutes")
    {
        return None;
    }
    Some(json!({
        "city": city,
        "units": units,
        "showOnBar": show_on_bar,
        "rainAlert": rain_alert,
        "refreshMinutes": refresh_minutes,
        "locale": "zh-CN",
    }))
}

fn normalize_repos(raw: &str) -> String {
    raw.split(',')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(|part| {
            if part.eq_ignore_ascii_case("TixXin/fly-island") {
                "TixXin/fuyu"
            } else {
                part
            }
        })
        .collect::<Vec<_>>()
        .join(", ")
}

fn map_github_issues_config(settings: &Map<String, Value>) -> Option<Value> {
    if settings.is_empty() {
        return None;
    }
    let repos = settings.get("repo").and_then(Value::as_str).map(normalize_repos).unwrap_or_default();
    let minutes = clamp_i64(settings.get("minutes"), 15, 5, 120);
    if repos.is_empty() && !settings.contains_key("minutes") {
        return None;
    }
    Some(json!({
        "reposText": repos,
        "refreshMinutes": minutes,
        "notifyNew": false,
        "locale": "zh-CN",
    }))
}

fn map_system_monitor_config(settings: &Map<String, Value>) -> Option<Value> {
    if !settings.contains_key("barCpu") && !settings.contains_key("barMemory") {
        return None;
    }
    let bar_cpu = settings.get("barCpu").and_then(Value::as_bool).unwrap_or(false);
    let bar_memory = settings.get("barMemory").and_then(Value::as_bool).unwrap_or(false);
    Some(json!({
        "intervalMs": 2000,
        "showOnBar": bar_cpu || bar_memory,
        "barCpu": bar_cpu,
        "barMemory": bar_memory,
        "locale": "zh-CN",
    }))
}

fn parse_localized_title(value: &Value) -> Option<LocalizedTitle> {
    if let Some(plain) = value.as_str().map(str::trim).filter(|text| !text.is_empty()) {
        return Some(LocalizedTitle { zh_cn: plain.to_owned(), en: plain.to_owned() });
    }
    let obj = value.as_object()?;
    let zh = obj.get("zh-CN").and_then(Value::as_str).map(str::trim).filter(|text| !text.is_empty());
    let en = obj.get("en").and_then(Value::as_str).map(str::trim).filter(|text| !text.is_empty());
    match (zh, en) {
        (Some(zh), Some(en)) => Some(LocalizedTitle { zh_cn: zh.to_owned(), en: en.to_owned() }),
        (Some(only), None) | (None, Some(only)) => Some(LocalizedTitle { zh_cn: only.to_owned(), en: only.to_owned() }),
        (None, None) => None,
    }
}

fn read_manifest_meta(dir: &Path) -> Option<(String, Option<LocalizedTitle>)> {
    for candidate in [V2_MANIFEST_CURRENT, V2_MANIFEST_LEGACY] {
        let path = dir.join(candidate);
        let Ok(text) = std::fs::read_to_string(&path) else { continue };
        let Ok(parsed) = serde_json::from_str::<Value>(&text) else { continue };
        let Some(id) = parsed.get("id").and_then(Value::as_str).map(str::trim).filter(|id| !id.is_empty()) else {
            continue;
        };
        let title = parsed.get("name").and_then(parse_localized_title);
        return Some((id.to_owned(), title));
    }
    None
}

fn discover_v2_plugins(home: &Path) -> BTreeMap<String, DiscoveredV2> {
    let mut found: BTreeMap<String, DiscoveredV2> = BTreeMap::new();
    if let Ok(text) = std::fs::read_to_string(home.join(V2_STATE_FILE)) {
        for (id, raw_grant) in v2_builtins::grants(&text) {
            let trimmed = id.trim();
            if trimmed.is_empty() || is_v2_builtin(trimmed) {
                continue;
            }
            if let Ok(grant) = serde_json::from_value::<v2_builtins::Grant>(raw_grant) {
                found.insert(
                    trimmed.to_owned(),
                    DiscoveredV2 { enabled: grant.enabled, settings: grant.settings, title: None },
                );
            }
        }
    }
    if let Ok(entries) = std::fs::read_dir(home.join(V2_PLUGINS_DIR)) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some((id, title)) = read_manifest_meta(&path) else { continue };
            if is_v2_builtin(&id) {
                continue;
            }
            let item = found.entry(id).or_default();
            if item.title.is_none() {
                item.title = title;
            }
        }
    }
    found
}

fn read_record(file: &Path) -> MigrationRecord {
    std::fs::read_to_string(file)
        .ok()
        .and_then(|text| serde_json::from_str::<MigrationRecord>(&text).ok())
        .filter(|record| record.format == RECORD_FORMAT)
        .unwrap_or_else(|| MigrationRecord { format: RECORD_FORMAT, ..MigrationRecord::default() })
}

fn save_record(file: &Path, record: &MigrationRecord) -> Result<(), String> {
    if let Some(parent) = file.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(record).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(file, &bytes).map_err(|error| error.to_string())
}

fn unquote_scalar(value: &str) -> &str {
    let trimmed = value.trim();
    for quote in ['"', '\''] {
        if let Some(inner) = trimmed.strip_prefix(quote).and_then(|rest| rest.strip_suffix(quote)) {
            return inner;
        }
    }
    trimmed
}

pub(crate) fn yml_contains_id(text: &str, target_id: &str) -> bool {
    if builtins_file::shape(text) != builtins_file::Shape::Block {
        return false;
    }
    for raw_line in text.lines() {
        let stripped = if let Some(rest) = raw_line.strip_prefix("- ") {
            Some(rest)
        } else {
            raw_line.strip_prefix("  ").filter(|rest| !rest.starts_with(' ') && !rest.starts_with('#'))
        };
        let Some(candidate) = stripped else { continue };
        let Some((field, rest)) = candidate.split_once(':') else { continue };
        if field.trim() != "id" {
            continue;
        }
        let value_part = match rest.find(" #") {
            Some(at) => &rest[..at],
            None => rest,
        };
        if unquote_scalar(value_part) == target_id {
            return true;
        }
    }
    false
}

pub(crate) fn append_market_entry(text: &str, v3_id: &str, disabled: bool) -> Result<String, String> {
    if yml_contains_id(text, v3_id) {
        return Ok(text.to_owned());
    }
    let eol = if text.contains("\r\n") { "\r\n" } else { "\n" };
    let mut entry_lines = vec![format!("- id: \"{v3_id}\""), "  source: market".to_owned()];
    if disabled {
        entry_lines.push("  disabled: true".to_owned());
    }
    match builtins_file::shape(text) {
        builtins_file::Shape::Other => {
            Err(format!("plugins.yml is not a plain list of entries, so Fuyu will not rewrite it for {v3_id}"))
        }
        builtins_file::Shape::Empty => {
            let mut kept: Vec<String> = text
                .split_inclusive('\n')
                .filter(|raw| raw.trim() != "[]")
                .map(str::to_owned)
                .collect();
            if let Some(last) = kept.last_mut().filter(|line| !line.ends_with('\n')) {
                last.push_str(eol);
            }
            for row in entry_lines {
                kept.push(format!("{row}{eol}"));
            }
            Ok(kept.concat())
        }
        builtins_file::Shape::Block => {
            let mut out = text.to_owned();
            if !out.is_empty() && !out.ends_with('\n') {
                out.push_str(eol);
            }
            for row in entry_lines {
                out.push_str(&row);
                out.push_str(eol);
            }
            Ok(out)
        }
    }
}

fn is_v3_package_installed(v3_dir: &Path, slug: &str, v3_id: &str) -> bool {
    let manifest_path = v3_dir.join(V3_PACKAGES_DIR).join("@fuyu").join(slug).join("package.json");
    let Ok(text) = std::fs::read_to_string(manifest_path) else { return false };
    serde_json::from_str::<Value>(&text)
        .ok()
        .and_then(|pkg| pkg.get("name").and_then(Value::as_str).map(|name| name == v3_id))
        .unwrap_or(false)
}

fn migrate_official_config(v3_dir: &Path, mapping: &OfficialMapping, settings: &Map<String, Value>) -> Result<bool, String> {
    let Some(builder) = mapping.build_config else { return Ok(false) };
    let Some(mapped) = builder(settings) else { return Ok(false) };
    let target_dir = v3_dir.join(V3_DATA_DIR).join("@fuyu").join(mapping.slug);
    let target_file = target_dir.join(PLUGIN_CONFIG_FILE);
    if target_file.exists() {
        return Ok(false);
    }
    std::fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
    let bytes = serde_json::to_vec_pretty(&mapped).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(&target_file, &bytes).map_err(|error| error.to_string())?;
    Ok(true)
}

fn guide_yml_entry(yml_file: &Path, v3_id: &str, disabled: bool) -> Result<bool, String> {
    let current = match std::fs::read_to_string(yml_file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error.to_string()),
    };
    if yml_contains_id(&current, v3_id) {
        return Ok(false);
    }
    let next = append_market_entry(&current, v3_id, disabled)?;
    if let Some(parent) = yml_file.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    crate::fs_write::replace_file(yml_file, next.as_bytes()).map_err(|error| error.to_string())?;
    Ok(true)
}

pub(crate) fn migrate_and_scan(home: &Path) -> V2MigrationSnapshot {
    let _guard = write_lock().lock().unwrap_or_else(PoisonError::into_inner);
    let discovered = discover_v2_plugins(home);
    if discovered.is_empty() {
        return V2MigrationSnapshot::default();
    }
    let v3_dir = home.join(V3_DIR);
    let yml_file = v3_dir.join(V3_CONFIG_FILE);
    let record_file = v3_dir.join(RECORD_FILE);
    let mut record = read_record(&record_file);
    let mut dirty = false;

    for (v2_id, info) in &discovered {
        let Some(mapping) = find_official(v2_id) else { continue };
        if !record.config_checked.contains(v2_id) {
            match migrate_official_config(&v3_dir, mapping, &info.settings) {
                Ok(written) => {
                    record.config_checked.insert(v2_id.clone());
                    if written {
                        record.config_written.insert(v2_id.clone());
                    }
                    dirty = true;
                }
                Err(error) => {
                    eprintln!("[plugins-v3] could not migrate config of {v2_id} to {}: {error}", mapping.v3_id);
                }
            }
        }
        let installed = is_v3_package_installed(&v3_dir, mapping.slug, mapping.v3_id);
        if installed && !record.yml_guided.contains(v2_id) {
            match guide_yml_entry(&yml_file, mapping.v3_id, !info.enabled) {
                Ok(_) => {
                    record.yml_guided.insert(v2_id.clone());
                    dirty = true;
                }
                Err(error) => {
                    eprintln!("[plugins-v3] could not register {} in {}: {error}", mapping.v3_id, yml_file.display());
                }
            }
        }
    }

    if dirty {
        if let Err(error) = save_record(&record_file, &record) {
            eprintln!("[plugins-v3] could not save {}: {error}", record_file.display());
        }
    }

    let yml_text = std::fs::read_to_string(&yml_file).unwrap_or_default();
    let mut official = Vec::new();
    let mut other = Vec::new();

    for (v2_id, info) in &discovered {
        if let Some(mapping) = find_official(v2_id) {
            let installed_in_v3 = is_v3_package_installed(&v3_dir, mapping.slug, mapping.v3_id);
            let registered_in_yml = yml_contains_id(&yml_text, mapping.v3_id);
            official.push(OfficialPluginMigration {
                v2_id: v2_id.clone(),
                v3_id: mapping.v3_id.to_owned(),
                title: LocalizedTitle { zh_cn: mapping.zh_cn.to_owned(), en: mapping.en.to_owned() },
                enabled_in_v2: info.enabled,
                config_migrated: record.config_written.contains(v2_id),
                installed_in_v3,
                registered_in_yml,
            });
        } else {
            other.push(LegacyV2Plugin {
                id: v2_id.clone(),
                title: info.title.clone(),
                enabled_in_v2: info.enabled,
            });
        }
    }

    let island_pending = discovered.keys().any(|id| !record.island_dismissed.contains(id));
    let settings_pending = discovered.keys().any(|id| !record.settings_dismissed.contains(id));

    V2MigrationSnapshot {
        official,
        other,
        island_pending,
        settings_pending,
    }
}

pub(crate) fn dismiss(home: &Path, target: &str) -> Result<V2MigrationSnapshot, UserError> {
    if !matches!(target, "island" | "settings" | "all") {
        return Err(UserError::new(
            "pluginsV3.invalidDismissTarget",
            format!("Unknown migration notice target: {target}."),
        ));
    }
    {
        let _guard = write_lock().lock().unwrap_or_else(PoisonError::into_inner);
        let discovered = discover_v2_plugins(home);
        if !discovered.is_empty() {
            let v3_dir = home.join(V3_DIR);
            let record_file = v3_dir.join(RECORD_FILE);
            let mut record = read_record(&record_file);
            for id in discovered.keys() {
                if target == "island" || target == "all" {
                    record.island_dismissed.insert(id.clone());
                }
                if target == "settings" || target == "all" {
                    record.settings_dismissed.insert(id.clone());
                }
            }
            save_record(&record_file, &record)
                .map_err(|detail| UserError::new("pluginsV3.migrationSave", "Could not save the plugin migration state.").detail(detail))?;
        }
    }
    Ok(migrate_and_scan(home))
}

#[tauri::command]
pub(crate) async fn get_v2_plugin_migration(app: AppHandle) -> V2MigrationSnapshot {
    let Ok(home) = crate::home_dir::fuyu_home(tauri::Manager::path(&app)) else {
        return V2MigrationSnapshot::default();
    };
    tauri::async_runtime::spawn_blocking(move || migrate_and_scan(&home))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) async fn dismiss_v2_plugin_migration(app: AppHandle, target: String) -> Result<V2MigrationSnapshot, UserError> {
    let home = crate::home_dir::fuyu_home(tauri::Manager::path(&app))
        .map_err(|detail| UserError::new("pluginsV3.migrationSave", "Could not locate the Fuyu data folder.").detail(detail.to_string()))?;
    let snapshot = tauri::async_runtime::spawn_blocking(move || dismiss(&home, &target))
        .await
        .map_err(|detail| UserError::new("pluginsV3.migrationSave", "Could not save the plugin migration state.").detail(detail.to_string()))??;
    let _ = app.emit(CHANGED_EVENT, &snapshot);
    Ok(snapshot)
}

#[cfg(test)]
#[path = "v2_migration_tests.rs"]
mod tests;
