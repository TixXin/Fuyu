use serde::Serialize;

use crate::macos::{apps, audio_devices, camera};

const UNKNOWN_APP: &str = "";

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceUse {
    camera: Vec<String>,
    microphone: Vec<String>,
}

fn sorted(mut apps: Vec<String>) -> Vec<String> {
    apps.sort_by_key(|app| app.to_lowercase());
    apps.dedup();
    apps
}

fn in_use_by_someone(in_use: bool) -> Vec<String> {
    if in_use {
        vec![UNKNOWN_APP.to_string()]
    } else {
        Vec::new()
    }
}

fn microphone_apps() -> Vec<String> {
    let Some(pids) = audio_devices::recording_pids() else {
        return in_use_by_someone(audio_devices::any_input_running());
    };
    let own = i32::try_from(std::process::id()).unwrap_or_default();
    let names = pids
        .into_iter()
        .map(apps::responsible_pid)
        .filter(|&pid| pid != own)
        .map(|pid| apps::display_name(pid).unwrap_or_else(|| UNKNOWN_APP.to_string()))
        .collect();
    sorted(names)
}

#[tauri::command]
pub fn get_device_use() -> DeviceUse {
    DeviceUse { camera: in_use_by_someone(camera::in_use()), microphone: microphone_apps() }
}

fn privacy_page(device: &str) -> Option<&'static str> {
    match device {
        "camera" => Some("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"),
        "microphone" => Some("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"),
        _ => None,
    }
}

#[tauri::command]
pub fn open_device_privacy_settings(device: String) -> Result<(), String> {
    let page = privacy_page(&device).ok_or_else(|| format!("Unknown device: {device}"))?;
    tauri_plugin_opener::open_url(page, None::<&str>).map_err(|error| error.to_string())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::device_use::get_device_use,
            crate::device_use::open_device_privacy_settings,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apps_are_sorted_without_repeats_and_unknown_users_are_an_empty_name() {
        assert_eq!(sorted(vec!["zoom".into(), "FaceTime".into(), "zoom".into()]), ["FaceTime", "zoom"]);
        assert_eq!(in_use_by_someone(true), [""]);
        assert!(in_use_by_someone(false).is_empty());
        assert!(privacy_page("camera").is_some_and(|page| page.ends_with("Privacy_Camera")));
        assert_eq!(privacy_page("speaker"), None);
    }

    #[test]
    #[ignore = "reads the real devices of the computer it runs on"]
    fn probe_this_computer() {
        println!("recording pids: {:?}", audio_devices::recording_pids());
        println!("any input running: {}", audio_devices::any_input_running());
        println!("{:?}", get_device_use());
    }
}
