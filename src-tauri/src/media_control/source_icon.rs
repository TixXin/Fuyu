use super::players::packaged_executable_candidates;
use super::service;
use crate::agent_status::host_icon;
use crate::win32;

pub(super) fn executable_names(source_app: &str) -> Vec<String> {
    let name = source_app.rsplit(['\\', '/']).next().unwrap_or_default().trim();
    if name.is_empty() {
        return Vec::new();
    }
    if name.contains('!') {
        return packaged_executable_candidates(source_app)
            .into_iter()
            .map(str::to_string)
            .collect();
    }
    if name.to_ascii_lowercase().ends_with(".exe") {
        vec![name.to_string()]
    } else {
        vec![format!("{name}.exe")]
    }
}

pub(crate) fn current_source_icon() -> Option<String> {
    let source_app = service::get_state(None).ok()?.source_app?;
    let names = executable_names(&source_app);
    let names: Vec<&str> = names.iter().map(String::as_str).collect();
    let path = win32::process::running_executable(&names)?;
    host_icon::icon_data_url(&path)
}

#[cfg(test)]
mod tests {
    use super::executable_names;

    #[test]
    fn app_ids_map_to_executable_names() {
        assert_eq!(executable_names("cloudmusic.exe"), ["cloudmusic.exe"]);
        assert_eq!(executable_names("QQMusic"), ["QQMusic.exe"]);
        assert_eq!(executable_names(r"C:\Apps\Spotify.EXE"), ["Spotify.EXE"]);
        assert_eq!(
            executable_names("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"),
            ["Spotify.exe"]
        );
        assert!(executable_names("UnknownVendor.App_123!App").is_empty());
        assert!(executable_names("  ").is_empty());
    }
}
