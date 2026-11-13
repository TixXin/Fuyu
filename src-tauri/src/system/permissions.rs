use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemPermission {
    kind: &'static str,
    granted: bool,
}

#[cfg(target_os = "macos")]
const PAGES: [(&str, &str); 2] = [
    ("accessibility", "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"),
    ("screenRecording", "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"),
];

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_system_permissions() -> Vec<SystemPermission> {
    vec![
        SystemPermission { kind: "accessibility", granted: crate::macos::accessibility::is_trusted() },
        SystemPermission { kind: "screenRecording", granted: crate::macos::screen_capture::has_access() },
    ]
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn open_system_permission(kind: String) -> Result<(), String> {
    let page = PAGES.iter().find(|(name, _)| *name == kind).map(|(_, page)| *page).ok_or_else(|| format!("Unknown permission {kind}."))?;
    tauri_plugin_opener::open_url(page, None::<&str>).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_system_permissions() -> Vec<SystemPermission> {
    Vec::new()
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn open_system_permission(kind: String) -> Result<(), String> {
    Err(format!("There is no {kind} permission to open on this system."))
}
