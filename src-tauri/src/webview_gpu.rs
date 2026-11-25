use std::{
    ffi::OsStr,
    fs,
    path::Path,
    sync::OnceLock,
};
#[cfg(any(windows, test))]
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

pub(crate) const FILE_NAME: &str = "webview-gpu.json";
const ENV_GPU_MODE: &str = "FUYU_GPU_MODE";
#[cfg(windows)]
const WEBVIEW2_ARGS_ENV: &str = "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS";
#[cfg(any(windows, test))]
const WARP_ARG: &str = "--use-angle=warp";

#[cfg(any(windows, test))]
const GPU_CACHE_DIRS: &[&[&str]] = &[
    &["ShaderCache"],
    &["GrShaderCache"],
    &["GraphiteDawnCache"],
    &["Default", "GPUCache"],
    &["Default", "GrShaderCache"],
    &["Default", "ShaderCache"],
    &["Default", "GraphiteDawnCache"],
];

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GpuMode {
    #[default]
    Auto,
    Warp,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GpuConfig {
    #[serde(default)]
    mode: GpuMode,
    #[serde(default)]
    auto_enabled: bool,
    #[serde(default)]
    auto_reason: Option<String>,
    #[serde(default)]
    clear_cache_once: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum StartupSource {
    Default,
    Config,
    Env,
    Cli,
}

#[derive(Clone, Copy, Debug)]
struct ActiveStartup {
    mode: GpuMode,
    #[allow(dead_code)]
    source: StartupSource,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewGpuState {
    supported: bool,
    configured_mode: GpuMode,
    active_mode: GpuMode,
    auto_enabled: bool,
    auto_reason: Option<String>,
    restart_required: bool,
    gpu_unstable: bool,
}

static ACTIVE: OnceLock<ActiveStartup> = OnceLock::new();

fn parse_mode_value(raw: &str) -> Option<GpuMode> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "warp" | "software" | "compat" | "1" | "true" => Some(GpuMode::Warp),
        "auto" | "hardware" | "default" | "0" | "false" => Some(GpuMode::Auto),
        _ => None,
    }
}

fn parse_cli_mode<I, S>(args: I) -> Option<GpuMode>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let mut matched = None;
    for arg in args.into_iter().skip(1) {
        let Some(text) = arg.as_ref().to_str() else { continue };
        if text == "--software-rendering" || text == "--disable-gpu" {
            matched = Some(GpuMode::Warp);
        } else if let Some(value) = text.strip_prefix("--gpu-mode=") {
            if let Some(mode) = parse_mode_value(value) {
                matched = Some(mode);
            }
        }
    }
    matched
}

fn resolve_startup_mode<I, S>(saved: GpuMode, env_value: Option<&str>, args: I) -> (GpuMode, StartupSource)
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    if let Some(mode) = parse_cli_mode(args) {
        return (mode, StartupSource::Cli);
    }
    if let Some(mode) = env_value.and_then(parse_mode_value) {
        return (mode, StartupSource::Env);
    }
    match saved {
        GpuMode::Warp => (GpuMode::Warp, StartupSource::Config),
        GpuMode::Auto => (GpuMode::Auto, StartupSource::Default),
    }
}

#[cfg(any(windows, test))]
fn merge_browser_args(existing: Option<&str>, flag: &str) -> String {
    let trimmed = existing.unwrap_or("").trim();
    if trimmed.is_empty() {
        return flag.to_string();
    }
    let has_override = trimmed.split_whitespace().any(|token| {
        let lower = token.to_ascii_lowercase();
        lower == flag || lower.starts_with("--use-angle=") || lower == "--disable-gpu"
    });
    if has_override {
        trimmed.to_string()
    } else {
        format!("{trimmed} {flag}")
    }
}

fn load_config(home: &Path) -> GpuConfig {
    fs::read_to_string(home.join(FILE_NAME))
        .ok()
        .and_then(|text| serde_json::from_str(text.trim_start_matches('\u{feff}')).ok())
        .unwrap_or_default()
}

fn save_config(home: &Path, config: &GpuConfig) -> Result<(), String> {
    fs::create_dir_all(home).map_err(|error| error.to_string())?;
    let bytes = serde_json::to_vec_pretty(config).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(&home.join(FILE_NAME), &bytes).map_err(|error| error.to_string())
}

#[cfg(any(windows, test))]
fn clear_gpu_caches_in(eb_webview_dir: &Path) -> usize {
    let mut removed = 0;
    for segments in GPU_CACHE_DIRS {
        let mut target = eb_webview_dir.to_path_buf();
        for segment in *segments {
            target.push(segment);
        }
        if target.is_dir() && fs::remove_dir_all(&target).is_ok() {
            removed += 1;
        }
    }
    removed
}

#[cfg(windows)]
fn webview_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|dir| PathBuf::from(dir).join(identifier).join("EBWebView"))
}

pub(crate) fn apply_startup_args(identifier: &str) {
    let home = crate::home_dir::current().map(Path::to_path_buf);
    let mut config = home.as_deref().map(load_config).unwrap_or_default();
    let env_mode = std::env::var(ENV_GPU_MODE).ok();
    let (mode, source) = resolve_startup_mode(config.mode, env_mode.as_deref(), std::env::args_os());
    let _ = ACTIVE.set(ActiveStartup { mode, source });

    #[cfg(windows)]
    {
        if config.clear_cache_once {
            if let Some(webview_dir) = webview_data_dir(identifier) {
                let _ = clear_gpu_caches_in(&webview_dir);
            }
            config.clear_cache_once = false;
            if let Some(home) = home.as_deref() {
                let _ = save_config(home, &config);
            }
        }
        if mode == GpuMode::Warp {
            let existing = std::env::var(WEBVIEW2_ARGS_ENV).ok();
            let merged = merge_browser_args(existing.as_deref(), WARP_ARG);
            std::env::set_var(WEBVIEW2_ARGS_ENV, merged);
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (identifier, &mut config);
    }
}

pub(crate) fn active_mode() -> GpuMode {
    ACTIVE.get().map_or(GpuMode::Auto, |active| active.mode)
}

#[cfg(any(windows, test))]
pub(crate) fn enable_auto_warp_in(home: &Path, active: GpuMode, reason: &str) -> Result<bool, String> {
    if active == GpuMode::Warp {
        return Ok(false);
    }
    let mut config = load_config(home);
    config.mode = GpuMode::Warp;
    config.auto_enabled = true;
    config.auto_reason = Some(reason.to_string());
    config.clear_cache_once = true;
    save_config(home, &config)?;
    Ok(true)
}

#[cfg(windows)]
pub(crate) fn enable_auto_warp(home: &Path, reason: &str) -> Result<bool, String> {
    enable_auto_warp_in(home, active_mode(), reason)
}

#[cfg(windows)]
pub(crate) fn enable_manual_warp_and_restart(app: &AppHandle) {
    if let Ok(home) = crate::home_dir::fuyu_home(app.path()) {
        let config = GpuConfig {
            mode: GpuMode::Warp,
            auto_enabled: false,
            auto_reason: None,
            clear_cache_once: true,
        };
        let _ = save_config(&home, &config);
    }
    app.restart();
}

fn build_state(home: &Path) -> WebviewGpuState {
    let config = load_config(home);
    let active = active_mode();
    WebviewGpuState {
        supported: cfg!(windows),
        configured_mode: config.mode,
        active_mode: active,
        auto_enabled: config.auto_enabled,
        auto_reason: config.auto_reason,
        restart_required: cfg!(windows) && config.mode != active,
        gpu_unstable: crate::webview_recovery::gpu_unstable(),
    }
}

#[tauri::command]
pub fn get_webview_gpu_state(app: AppHandle) -> Result<WebviewGpuState, String> {
    let home = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?;
    Ok(build_state(&home))
}

#[tauri::command]
pub fn set_webview_gpu_mode(app: AppHandle, mode: GpuMode) -> Result<WebviewGpuState, String> {
    let home = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?;
    let mut config = load_config(&home);
    config.mode = mode;
    config.auto_enabled = false;
    config.auto_reason = None;
    if mode == GpuMode::Warp {
        config.clear_cache_once = true;
    }
    save_config(&home, &config)?;
    Ok(build_state(&home))
}

#[tauri::command]
pub fn clear_webview_gpu_cache_and_restart(app: AppHandle) -> Result<(), String> {
    let home = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?;
    let mut config = load_config(&home);
    config.clear_cache_once = true;
    save_config(&home, &config)?;
    app.restart();
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::webview_gpu::get_webview_gpu_state,
            crate::webview_gpu::set_webview_gpu_mode,
            crate::webview_gpu::clear_webview_gpu_cache_and_restart,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fuyu-webview-gpu-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn startup_mode_prefers_cli_then_env_then_saved_config() {
        assert_eq!(resolve_startup_mode(GpuMode::Auto, None, ["fuyu.exe"]), (GpuMode::Auto, StartupSource::Default));
        assert_eq!(resolve_startup_mode(GpuMode::Warp, None, ["fuyu.exe"]), (GpuMode::Warp, StartupSource::Config));
        assert_eq!(resolve_startup_mode(GpuMode::Auto, Some("warp"), ["fuyu.exe"]), (GpuMode::Warp, StartupSource::Env));
        assert_eq!(resolve_startup_mode(GpuMode::Warp, Some("auto"), ["fuyu.exe"]), (GpuMode::Auto, StartupSource::Env));
        assert_eq!(resolve_startup_mode(GpuMode::Auto, Some("auto"), ["fuyu.exe", "--software-rendering"]), (GpuMode::Warp, StartupSource::Cli));
        assert_eq!(resolve_startup_mode(GpuMode::Warp, Some("warp"), ["fuyu.exe", "--gpu-mode=auto"]), (GpuMode::Auto, StartupSource::Cli));
    }

    #[test]
    fn merges_warp_browser_arg_without_duplicating_or_overriding_existing_gpu_flags() {
        assert_eq!(merge_browser_args(None, WARP_ARG), "--use-angle=warp");
        assert_eq!(merge_browser_args(Some("  "), WARP_ARG), "--use-angle=warp");
        assert_eq!(merge_browser_args(Some("--lang=zh-CN"), WARP_ARG), "--lang=zh-CN --use-angle=warp");
        assert_eq!(merge_browser_args(Some("--use-angle=warp --lang=zh-CN"), WARP_ARG), "--use-angle=warp --lang=zh-CN");
        assert_eq!(merge_browser_args(Some("--use-angle=d3d11"), WARP_ARG), "--use-angle=d3d11");
        assert_eq!(merge_browser_args(Some("--disable-gpu"), WARP_ARG), "--disable-gpu");
    }

    #[test]
    fn clear_gpu_caches_only_removes_shader_caches_and_preserves_local_storage() {
        let root = temp_dir("caches");
        let eb = root.join("EBWebView");
        fs::create_dir_all(eb.join("ShaderCache")).unwrap();
        fs::write(eb.join("ShaderCache").join("data"), "x").unwrap();
        fs::create_dir_all(eb.join("Default").join("GPUCache")).unwrap();
        fs::write(eb.join("Default").join("GPUCache").join("index"), "y").unwrap();
        fs::create_dir_all(eb.join("Default").join("Local Storage").join("leveldb")).unwrap();
        fs::write(eb.join("Default").join("Local Storage").join("leveldb").join("000001.log"), "keep").unwrap();

        assert_eq!(clear_gpu_caches_in(&eb), 2);
        assert!(!eb.join("ShaderCache").exists());
        assert!(!eb.join("Default").join("GPUCache").exists());
        assert_eq!(fs::read_to_string(eb.join("Default").join("Local Storage").join("leveldb").join("000001.log")).unwrap(), "keep");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn auto_warp_persists_once_and_refuses_when_already_in_warp() {
        let home = temp_dir("auto");
        assert!(!enable_auto_warp_in(&home, GpuMode::Warp, "gpu-process-exited").unwrap());
        assert!(!home.join(FILE_NAME).exists());

        assert!(enable_auto_warp_in(&home, GpuMode::Auto, "gpu-process-exited (0x80000003)").unwrap());
        let saved = load_config(&home);
        assert_eq!(saved.mode, GpuMode::Warp);
        assert!(saved.auto_enabled);
        assert!(saved.clear_cache_once);
        assert_eq!(saved.auto_reason.as_deref(), Some("gpu-process-exited (0x80000003)"));
        let _ = fs::remove_dir_all(&home);
    }
}
