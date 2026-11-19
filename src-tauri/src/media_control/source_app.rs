use serde::Serialize;

use crate::agent_status::host_icon;

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSourceApp {
    icon: Option<String>,
    name: Option<String>,
}

#[cfg(any(windows, test))]
pub(super) fn process_needle(source: &str) -> Option<String> {
    let app = source.rsplit('!').next().unwrap_or(source);
    let file = app.rsplit(['\\', '/']).next().unwrap_or(app).trim().to_lowercase();
    let stem = file.strip_suffix(".exe").unwrap_or(&file);
    let name = stem.rsplit('.').next().unwrap_or(stem);
    let plain = name.chars().all(|unit| unit.is_alphanumeric() || matches!(unit, '-' | '_' | ' '));
    (name.chars().count() >= 3 && plain).then(|| name.to_string())
}

#[cfg(target_os = "macos")]
fn app_path(source: &str) -> Option<String> {
    use crate::macos::apps;
    apps::path_for_bundle_id(source).or_else(|| {
        apps::regular_apps().into_iter().find_map(|(pid, _)| {
            let pid = i32::try_from(pid).ok()?;
            (apps::display_name(pid)? == source).then(|| apps::path(pid))?
        })
    })
}

#[cfg(target_os = "macos")]
pub(super) fn is_frontmost(source: &str) -> bool {
    let Some(front) = crate::macos::apps::frontmost_path() else {
        return false;
    };
    app_path(source).is_some_and(|path| path == front)
}

#[cfg(windows)]
fn app_path(source: &str) -> Option<String> {
    use crate::win32::process;
    let needle = process_needle(source)?;
    process::pids_matching_name(&needle).into_iter().find_map(process::image_path)
}

#[cfg(windows)]
pub(super) fn is_frontmost(source: &str) -> bool {
    use crate::win32::{process, window};
    let Some(needle) = process_needle(source) else {
        return false;
    };
    let front = process::window_process_id(window::foreground_window());
    process::image_path(front).is_some_and(|path| {
        let file = path.rsplit(['\\', '/']).next().unwrap_or(&path).to_lowercase();
        file.contains(&needle)
    })
}

#[cfg(target_os = "macos")]
fn app_name(path: &str) -> Option<String> {
    crate::macos::apps::outer_app_name(path)
}

#[cfg(windows)]
fn app_name(_path: &str) -> Option<String> {
    None
}

pub(super) fn describe(source: &str) -> MediaSourceApp {
    let source = source.trim();
    if source.is_empty() {
        return MediaSourceApp::default();
    }
    let Some(path) = app_path(source) else {
        return MediaSourceApp::default();
    };
    MediaSourceApp { icon: host_icon::icon_data_url(&path), name: app_name(&path) }
}

#[cfg(test)]
mod tests {
    use super::process_needle;

    #[test]
    fn a_session_id_gives_the_process_name_to_look_for() {
        assert_eq!(process_needle("Spotify.exe").as_deref(), Some("spotify"));
        assert_eq!(process_needle("cloudmusic.exe").as_deref(), Some("cloudmusic"));
        assert_eq!(process_needle("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify").as_deref(), Some("spotify"));
        assert_eq!(process_needle("Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic").as_deref(), Some("zunemusic"));
        assert_eq!(process_needle("C:\\Program Files\\QQMusic\\QQMusic.exe").as_deref(), Some("qqmusic"));
        assert_eq!(process_needle("Chrome").as_deref(), Some("chrome"));
    }

    #[test]
    fn a_session_id_that_names_no_process_gives_nothing() {
        assert_eq!(process_needle(""), None);
        assert_eq!(process_needle("ab"), None);
        assert_eq!(process_needle("a*b?c"), None);
    }
}
