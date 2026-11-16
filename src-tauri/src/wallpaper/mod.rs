mod thumbnail;

use std::{path::PathBuf, sync::OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::win32::wallpaper::{desktop_wallpapers, watch_changes, DesktopWallpapers};

const WALLPAPER_CHANGED_EVENT: &str = "wallpaper-changed";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorWallpaper {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    image: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Wallpapers {
    fit: &'static str,
    color: String,
    monitors: Vec<MonitorWallpaper>,
}

fn fit_name(position: i32) -> &'static str {
    match position {
        0 => "center",
        1 => "tile",
        2 => "stretch",
        3 => "fit",
        5 => "span",
        _ => "fill",
    }
}

fn color_hex(colorref: u32) -> String {
    let [red, green, blue, _] = colorref.to_le_bytes();
    format!("#{red:02x}{green:02x}{blue:02x}")
}

fn transcoded_wallpaper() -> Option<PathBuf> {
    let app_data = std::env::var_os("APPDATA")?;
    Some(PathBuf::from(app_data).join(r"Microsoft\Windows\Themes\TranscodedWallpaper"))
}

fn assemble(desktop: DesktopWallpapers, fallback: Option<PathBuf>) -> Wallpapers {
    let mut paths: Vec<PathBuf> = Vec::new();
    for path in desktop.monitors.iter().filter(|monitor| !monitor.path.is_empty()) {
        let path = PathBuf::from(&path.path);
        if !paths.contains(&path) {
            paths.push(path);
        }
    }
    let fallback = fallback.filter(|_| !paths.is_empty());
    if let Some(fallback) = fallback.as_ref().filter(|fallback| !paths.contains(fallback)) {
        paths.push(fallback.clone());
    }
    let urls = thumbnail::data_urls(&paths);
    let url_of = |path: &PathBuf| paths.iter().position(|known| known == path).and_then(|index| urls[index].clone());
    let fallback_url = fallback.as_ref().and_then(url_of);
    let monitors = desktop
        .monitors
        .iter()
        .map(|monitor| MonitorWallpaper {
            x: monitor.left,
            y: monitor.top,
            width: monitor.right - monitor.left,
            height: monitor.bottom - monitor.top,
            image: (!monitor.path.is_empty())
                .then(|| url_of(&PathBuf::from(&monitor.path)).or_else(|| fallback_url.clone()))
                .flatten(),
        })
        .collect();
    Wallpapers { fit: fit_name(desktop.position), color: color_hex(desktop.background), monitors }
}

static APP: OnceLock<AppHandle> = OnceLock::new();

fn announce_change() {
    if let Some(app) = APP.get() {
        let _ = app.emit(WALLPAPER_CHANGED_EVENT, ());
    }
}

#[tauri::command]
pub async fn get_wallpapers(app: AppHandle) -> Option<Wallpapers> {
    if APP.set(app).is_ok() {
        let _ = watch_changes(announce_change);
    }
    tauri::async_runtime::spawn_blocking(|| desktop_wallpapers().ok().map(|desktop| assemble(desktop, transcoded_wallpaper())))
        .await
        .ok()
        .flatten()
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)* crate::wallpaper::get_wallpapers,] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests;
