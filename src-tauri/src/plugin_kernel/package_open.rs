use std::{
    ffi::OsStr,
    io::Read,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

pub(crate) const PLUGIN_PACKAGE_OPEN_EVENT: &str = "plugin-package-open";
pub(crate) const MAX_PACKAGE_BYTES: u64 = 20 * 1024 * 1024;
const COLD_START_DELAY: Duration = Duration::from_millis(1500);
#[cfg(target_os = "macos")]
const COLD_START_WINDOW: Duration = Duration::from_secs(5);

static PENDING_PACKAGE: Mutex<Option<PathBuf>> = Mutex::new(None);
#[cfg(target_os = "macos")]
static STARTED_AT: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingPluginPackage {
    pub file_name: String,
    pub base64: String,
}

pub(crate) fn mark_started() {
    #[cfg(target_os = "macos")]
    {
        let _ = STARTED_AT.get_or_init(std::time::Instant::now);
    }
}

pub(super) fn has_fuyu_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("fuyu"))
}

pub(super) fn validate_package_file(path: &Path) -> Option<PathBuf> {
    if !has_fuyu_extension(path) {
        return None;
    }
    let metadata = std::fs::metadata(path).ok()?;
    if !metadata.is_file() || metadata.len() > MAX_PACKAGE_BYTES {
        return None;
    }
    Some(path.to_path_buf())
}

pub(super) fn resolve_arg_path(raw: &OsStr, cwd: Option<&Path>) -> Option<PathBuf> {
    if raw.is_empty() {
        return None;
    }
    if let Some(text) = raw.to_str() {
        if let Ok(url) = tauri::Url::parse(text) {
            if url.scheme() == "file" {
                return url.to_file_path().ok().and_then(|path| validate_package_file(&path));
            }
        }
    }
    let candidate = Path::new(raw);
    if !has_fuyu_extension(candidate) {
        return None;
    }
    let resolved = if candidate.is_relative() {
        match cwd.filter(|dir| !dir.as_os_str().is_empty()) {
            Some(base) => base.join(candidate),
            None => std::env::current_dir()
                .ok()
                .map_or_else(|| candidate.to_path_buf(), |base| base.join(candidate)),
        }
    } else {
        candidate.to_path_buf()
    };
    validate_package_file(&resolved)
}

pub(crate) fn find_in_args<I, S>(args: I, cwd: Option<&Path>) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    args.into_iter().find_map(|arg| resolve_arg_path(arg.as_ref(), cwd))
}

#[cfg(any(target_os = "macos", test))]
pub(super) fn split_opened_urls(urls: &[tauri::Url]) -> (Option<PathBuf>, Vec<tauri::Url>) {
    let mut found: Option<PathBuf> = None;
    let mut rest: Vec<tauri::Url> = Vec::new();
    for url in urls {
        if url.scheme() == "file" {
            if let Ok(path) = url.to_file_path() {
                if has_fuyu_extension(&path) {
                    if found.is_none() {
                        found = validate_package_file(&path);
                    }
                    continue;
                }
            }
        }
        rest.push(url.clone());
    }
    (found, rest)
}

#[cfg(target_os = "macos")]
pub(crate) fn open_opened_urls(app: &AppHandle, urls: &[tauri::Url]) -> Vec<tauri::Url> {
    let (package, rest) = split_opened_urls(urls);
    if let Some(path) = package {
        let cold_start = STARTED_AT.get().is_some_and(|at| at.elapsed() < COLD_START_WINDOW);
        open(app, path, cold_start);
    }
    rest
}

pub(super) fn store_pending_path(path: PathBuf) {
    *PENDING_PACKAGE.lock().unwrap_or_else(PoisonError::into_inner) = Some(path);
}

pub(super) fn take_pending_path() -> Option<PathBuf> {
    PENDING_PACKAGE.lock().unwrap_or_else(PoisonError::into_inner).take()
}

pub(crate) fn open(app: &AppHandle, path: PathBuf, cold_start: bool) {
    store_pending_path(path);
    let app = app.clone();
    let spawned = thread::Builder::new().name("plugin-package-open".into()).spawn(move || {
        if cold_start {
            thread::sleep(COLD_START_DELAY);
        }
        let focus_script = r#"localStorage.setItem("fuyu-settings-focus", JSON.stringify({ section: "pluginsV3", requestedAt: Date.now() }))"#;
        if let Some(settings) = app.get_webview_window(crate::settings_window::WINDOW_LABEL) {
            let _ = settings.eval(focus_script);
        } else if let Ok(window) = crate::island::main_window(&app) {
            if let Err(error) = window.eval(focus_script) {
                eprintln!("failed to ask settings for the pluginsV3 page: {error}");
            }
        }
        if let Err(error) = crate::settings_window::open(&app) {
            eprintln!("could not open settings window for plugin package: {error}");
            return;
        }
        let _ = app.emit_to(crate::settings_window::WINDOW_LABEL, PLUGIN_PACKAGE_OPEN_EVENT, ());
    });
    if let Err(error) = spawned {
        eprintln!("could not open a plugin package: {error}");
    }
}

pub(super) fn encode_base64(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}

pub(super) fn read_package_file(path: &Path) -> Result<PendingPluginPackage, String> {
    if !has_fuyu_extension(path) {
        return Err("Only .fuyu plugin packages can be opened.".to_string());
    }
    let file = std::fs::File::open(path)
        .map_err(|error| format!("Could not open plugin package {}: {error}", path.display()))?;
    let metadata = file
        .metadata()
        .map_err(|error| format!("Could not inspect plugin package {}: {error}", path.display()))?;
    if !metadata.is_file() {
        return Err("Plugin package path is not a regular file.".to_string());
    }
    if metadata.len() > MAX_PACKAGE_BYTES {
        return Err("Plugin package exceeds the 20 MB size limit.".to_string());
    }
    let mut bytes = Vec::with_capacity(usize::try_from(metadata.len()).unwrap_or(0));
    file.take(MAX_PACKAGE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read plugin package {}: {error}", path.display()))?;
    if bytes.len() as u64 > MAX_PACKAGE_BYTES {
        return Err("Plugin package exceeds the 20 MB size limit.".to_string());
    }
    let file_name = path
        .file_name()
        .map_or_else(|| "package.fuyu".to_string(), |name| name.to_string_lossy().into_owned());
    Ok(PendingPluginPackage {
        file_name,
        base64: encode_base64(&bytes),
    })
}

#[tauri::command]
pub(crate) async fn take_pending_plugin_package() -> Result<Option<PendingPluginPackage>, String> {
    let Some(path) = take_pending_path() else {
        return Ok(None);
    };
    tauri::async_runtime::spawn_blocking(move || read_package_file(&path))
        .await
        .map_err(|error| error.to_string())?
        .map(Some)
}

#[cfg(test)]
#[path = "package_open_tests.rs"]
mod tests;
