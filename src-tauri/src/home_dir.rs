pub(crate) mod commands;
mod lock;
mod migration;

use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
};
use tauri::{path::PathResolver, Runtime};

pub(crate) use migration::TODO_DIR;

pub(crate) const ENV: &str = "FUYU_HOME";
pub(crate) const POINTER_FILE: &str = "home.json";
const DEFAULT_DIR: &str = ".fuyu";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Env,
    Pointer,
    Default,
    AppData,
}

static HOME: OnceLock<(PathBuf, Source)> = OnceLock::new();

pub(crate) fn fuyu_home<R: Runtime>(paths: &PathResolver<R>) -> tauri::Result<PathBuf> {
    match HOME.get() {
        Some((home, _)) => Ok(home.clone()),
        None => paths.app_data_dir(),
    }
}

pub(crate) fn source() -> Source {
    HOME.get().map_or(Source::AppData, |(_, source)| *source)
}

#[derive(Deserialize)]
struct Pointer {
    home: String,
}

fn pointed_home(text: &str) -> Option<PathBuf> {
    let pointer: Pointer = serde_json::from_str(text.trim_start_matches('\u{feff}')).ok()?;
    let home = PathBuf::from(pointer.home.trim());
    home.is_absolute().then_some(home)
}

pub(crate) fn resolve(env: Option<&str>, pointer: Option<&str>, profile: Option<&Path>, app_data: &Path) -> (PathBuf, Source) {
    if let Some(home) = env.map(str::trim).filter(|value| !value.is_empty()).map(PathBuf::from).filter(|home| home.is_absolute()) {
        return (home, Source::Env);
    }
    if let Some(home) = pointer.and_then(pointed_home) {
        return (home, Source::Pointer);
    }
    match profile {
        Some(profile) => (profile.join(DEFAULT_DIR), Source::Default),
        None => (app_data.to_path_buf(), Source::AppData),
    }
}

fn profile() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

pub(crate) fn default_home() -> Option<PathBuf> {
    profile().map(|profile| profile.join(DEFAULT_DIR))
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|roaming| PathBuf::from(roaming).join(identifier))
}

#[cfg(target_os = "macos")]
pub(crate) fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    profile().map(|profile| profile.join("Library").join("Application Support").join(identifier))
}

pub(crate) fn init(identifier: &str) {
    let Some(app_data) = app_data_dir(identifier) else {
        return;
    };
    let (home, source) = if crate::dev_lane::lane().is_some() {
        (app_data.clone(), Source::AppData)
    } else {
        let env = std::env::var(ENV).ok();
        let pointer = std::fs::read_to_string(app_data.join(POINTER_FILE)).ok();
        resolve(env.as_deref(), pointer.as_deref(), profile().as_deref(), &app_data)
    };
    if source != Source::AppData {
        if let Some(holder) = lock::conflict(&home) {
            #[cfg(windows)]
            crate::win32::message_box::show_warning("浮屿 Fuyu", &lock::conflict_message(&home, &holder));
            #[cfg(not(windows))]
            eprintln!("{}", lock::conflict_message(&home, &holder));
            std::process::exit(0);
        }
    }
    let chosen = match migration::before_start(&app_data, &home) {
        Ok(()) => (home, source),
        Err(error) => {
            eprintln!("could not move the data to {} (staying in {} this time): {error}", home.display(), app_data.display());
            (app_data, Source::AppData)
        }
    };
    let _ = HOME.set(chosen);
}

pub(crate) fn current() -> Option<&'static Path> {
    HOME.get().map(|(home, _)| home.as_path())
}

pub(crate) fn after_start(app: tauri::AppHandle) {
    if let Some(home) = current().filter(|_| source() != Source::AppData) {
        lock::take(home);
    }
    migration::after_start(app);
}

pub(crate) fn before_exit() {
    lock::release();
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::home_dir::commands::get_data_home,
            crate::home_dir::commands::set_data_home,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    use super::pointed_home;
    use super::{resolve, Source};
    use std::path::Path;

    const APP_DATA: &str = r"C:\Users\me\AppData\Roaming\com.tixxin.fuyu";
    #[cfg(windows)]
    const PROFILE: &str = r"C:\Users\me";

    #[cfg(windows)]
    fn home(env: Option<&str>, pointer: Option<&str>) -> (String, Source) {
        let (home, source) = resolve(env, pointer, Some(Path::new(PROFILE)), Path::new(APP_DATA));
        (home.display().to_string(), source)
    }

    #[cfg(windows)]
    #[test]
    fn the_default_home_is_dot_fuyu_in_the_profile() {
        assert_eq!(home(None, None), (r"C:\Users\me\.fuyu".into(), Source::Default));
    }

    #[cfg(windows)]
    #[test]
    fn the_environment_comes_first_then_the_pointer() {
        let pointer = r#"{ "home": "D:\\Sync\\fuyu" }"#;
        assert_eq!(home(Some(r"E:\fuyu"), Some(pointer)), (r"E:\fuyu".into(), Source::Env));
        assert_eq!(home(None, Some(pointer)), (r"D:\Sync\fuyu".into(), Source::Pointer));
        assert_eq!(home(Some("  "), Some(pointer)).1, Source::Pointer);
    }

    #[cfg(windows)]
    #[test]
    fn relative_or_broken_paths_are_ignored() {
        assert_eq!(home(Some("fuyu"), None).1, Source::Default);
        assert_eq!(pointed_home(r#"{ "home": "relative" }"#), None);
        assert_eq!(pointed_home("not json"), None);
        assert_eq!(pointed_home("\u{feff}{ \"home\": \"D:\\\\x\" }").map(|path| path.display().to_string()), Some(r"D:\x".into()));
    }

    #[test]
    fn without_a_profile_the_app_data_folder_stays() {
        let (home, source) = resolve(None, None, None, Path::new(APP_DATA));
        assert_eq!((home.display().to_string(), source), (APP_DATA.into(), Source::AppData));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn on_macos_the_app_data_folder_is_tauris_application_support_folder() {
        let dir = super::app_data_dir("com.tixxin.fuyu").expect("HOME is set");
        assert!(dir.ends_with("Library/Application Support/com.tixxin.fuyu"));
        assert_eq!(super::default_home().expect("HOME is set").file_name().and_then(|name| name.to_str()), Some(".fuyu"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn on_macos_the_lock_names_this_computer() {
        assert!(!super::lock::this_computer().is_empty());
    }
}
