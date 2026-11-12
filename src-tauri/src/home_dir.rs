mod migration;

use serde::Deserialize;
use std::{
    path::{Path, PathBuf},
    sync::OnceLock,
};
use tauri::{path::PathResolver, Runtime};

pub(crate) use migration::{after_start, TODO_DIR};

pub(crate) const ENV: &str = "FUYU_HOME";
pub(crate) const POINTER_FILE: &str = "home.json";
const DEFAULT_DIR: &str = ".fuyu";

static HOME: OnceLock<PathBuf> = OnceLock::new();

pub(crate) fn fuyu_home<R: Runtime>(paths: &PathResolver<R>) -> tauri::Result<PathBuf> {
    match HOME.get() {
        Some(home) => Ok(home.clone()),
        None => paths.app_data_dir(),
    }
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

pub(crate) fn resolve(env: Option<&str>, pointer: Option<&str>, profile: Option<&Path>, app_data: &Path) -> PathBuf {
    env.map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|home| home.is_absolute())
        .or_else(|| pointer.and_then(pointed_home))
        .or_else(|| profile.map(|profile| profile.join(DEFAULT_DIR)))
        .unwrap_or_else(|| app_data.to_path_buf())
}

pub(crate) fn app_data_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|roaming| PathBuf::from(roaming).join(identifier))
}

pub(crate) fn init(identifier: &str) {
    let Some(app_data) = app_data_dir(identifier) else {
        return;
    };
    let home = if crate::dev_lane::lane().is_some() {
        app_data.clone()
    } else {
        let env = std::env::var(ENV).ok();
        let pointer = std::fs::read_to_string(app_data.join(POINTER_FILE)).ok();
        let profile = std::env::var_os("USERPROFILE").map(PathBuf::from);
        resolve(env.as_deref(), pointer.as_deref(), profile.as_deref(), &app_data)
    };
    let home = match migration::before_start(&app_data, &home) {
        Ok(()) => home,
        Err(error) => {
            eprintln!("could not move the data to {} (staying in {} this time): {error}", home.display(), app_data.display());
            app_data
        }
    };
    let _ = HOME.set(home);
}

pub(crate) fn current() -> Option<&'static Path> {
    HOME.get().map(PathBuf::as_path)
}

#[cfg(test)]
mod tests {
    use super::{pointed_home, resolve};
    use std::path::Path;

    const APP_DATA: &str = r"C:\Users\me\AppData\Roaming\com.tixxin.fuyu";
    const PROFILE: &str = r"C:\Users\me";

    fn home(env: Option<&str>, pointer: Option<&str>) -> String {
        resolve(env, pointer, Some(Path::new(PROFILE)), Path::new(APP_DATA)).display().to_string()
    }

    #[test]
    fn the_default_home_is_dot_fuyu_in_the_profile() {
        assert_eq!(home(None, None), r"C:\Users\me\.fuyu");
    }

    #[test]
    fn the_environment_comes_first_then_the_pointer() {
        let pointer = r#"{ "home": "D:\\Sync\\fuyu" }"#;
        assert_eq!(home(Some(r"E:\fuyu"), Some(pointer)), r"E:\fuyu");
        assert_eq!(home(None, Some(pointer)), r"D:\Sync\fuyu");
        assert_eq!(home(Some("  "), Some(pointer)), r"D:\Sync\fuyu");
    }

    #[test]
    fn relative_or_broken_paths_are_ignored() {
        assert_eq!(home(Some("fuyu"), None), r"C:\Users\me\.fuyu");
        assert_eq!(pointed_home(r#"{ "home": "relative" }"#), None);
        assert_eq!(pointed_home("not json"), None);
        assert_eq!(pointed_home("\u{feff}{ \"home\": \"D:\\\\x\" }").map(|path| path.display().to_string()), Some(r"D:\x".into()));
    }

    #[test]
    fn without_a_profile_the_app_data_folder_stays() {
        assert_eq!(resolve(None, None, None, Path::new(APP_DATA)).display().to_string(), APP_DATA);
    }
}
