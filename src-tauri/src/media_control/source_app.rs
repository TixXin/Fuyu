use serde::Serialize;

use crate::agent_status::host_icon;

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSourceApp {
    icon: Option<String>,
    name: Option<String>,
}

#[cfg(any(windows, test))]
const GENERIC_APP_IDS: &[&str] = &["app", "application", "main", "client", "desktop", "player", "music", "windows"];
#[cfg(any(windows, test))]
const LOOSE_MATCH_CHARS: usize = 5;

#[cfg(any(windows, test))]
fn last_word(text: &str) -> Option<String> {
    let file = text.rsplit(['\\', '/']).next().unwrap_or(text).trim().to_lowercase();
    let stem = file.strip_suffix(".exe").unwrap_or(&file);
    let name = stem.rsplit('.').next().unwrap_or(stem);
    let plain = name.chars().all(|unit| unit.is_alphanumeric() || matches!(unit, '-' | '_' | ' '));
    (name.chars().count() >= 3 && plain && !GENERIC_APP_IDS.contains(&name)).then(|| name.to_string())
}

#[cfg(any(windows, test))]
pub(super) fn process_needle(source: &str) -> Option<String> {
    let Some((package, app)) = source.rsplit_once('!') else {
        return last_word(source);
    };
    last_word(app).or_else(|| last_word(package.split('_').next().unwrap_or(package)))
}

#[cfg(any(windows, test))]
pub(super) fn names_process(needle: &str, image: &str) -> bool {
    let file = image.rsplit(['\\', '/']).next().unwrap_or(image).trim().to_lowercase();
    let stem = file.strip_suffix(".exe").unwrap_or(&file);
    let long = |text: &str| text.chars().count() >= LOOSE_MATCH_CHARS;
    stem == needle || (long(stem) && needle.starts_with(stem)) || (long(needle) && stem.starts_with(needle))
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
    let lead: String = needle.chars().take(LOOSE_MATCH_CHARS).collect();
    process::pids_matching_name(&lead)
        .into_iter()
        .filter_map(process::image_path)
        .find(|path| names_process(&needle, path))
}

#[cfg(windows)]
pub(super) fn is_frontmost(source: &str) -> bool {
    use crate::win32::{process, window};
    let Some(needle) = process_needle(source) else {
        return false;
    };
    let front = process::window_process_id(window::foreground_window());
    process::image_path(front).is_some_and(|path| names_process(&needle, &path))
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
    use super::{names_process, process_needle};

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
    fn a_store_app_with_a_generic_app_id_is_looked_up_by_its_package_name() {
        assert_eq!(process_needle("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App").as_deref(), Some("applemusicwin"));
        assert_eq!(process_needle("AppleInc.iTunes_nzyj5cx40ttqa!iTunes").as_deref(), Some("itunes"));
        assert_eq!(process_needle("Vendor.Thing_abc!App"), Some("thing".to_string()));
        assert_eq!(process_needle("Vendor.Music_abc!App"), None);
    }

    #[test]
    fn a_process_is_the_player_only_when_the_names_agree() {
        assert!(names_process("spotify", r"C:\Users\me\AppData\Roaming\Spotify\Spotify.exe"));
        assert!(names_process("cloudmusic", "cloudmusic.exe"));
        assert!(names_process("applemusicwin", r"C:\Program Files\WindowsApps\AppleMusic.exe"));
        assert!(names_process("qqmusic", "QQMusicExternal.exe"));
        assert!(names_process("vlc", "vlc.exe"));
        assert!(!names_process("applemusicwin", "ApplicationFrameHost.exe"));
        assert!(!names_process("applemusicwin", "WhatsApp.exe"));
        assert!(!names_process("vlc", "nvlc.exe"));
        assert!(names_process("chrome", "chrome.exe"));
        assert!(!names_process("zunemusic", "Microsoft.Media.Player.exe"));
    }

    #[test]
    fn a_session_id_that_names_no_process_gives_nothing() {
        assert_eq!(process_needle("Some.App_abc!App"), None);
        assert_eq!(process_needle(""), None);
        assert_eq!(process_needle("ab"), None);
        assert_eq!(process_needle("a*b?c"), None);
    }
}
