use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BluetoothBatteryAccess {
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    NotDetermined,
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    Denied,
    #[cfg_attr(not(target_os = "macos"), allow(dead_code))]
    Allowed,
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    Unsupported,
}

#[cfg(target_os = "macos")]
const PRIVACY_PAGE: &str = "x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth";

#[cfg(target_os = "macos")]
fn from_platform(access: crate::macos::bluetooth_access::Access) -> BluetoothBatteryAccess {
    use crate::macos::bluetooth_access::Access;
    match access {
        Access::NotDetermined => BluetoothBatteryAccess::NotDetermined,
        Access::Denied => BluetoothBatteryAccess::Denied,
        Access::Allowed => BluetoothBatteryAccess::Allowed,
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn get_bluetooth_battery_access() -> BluetoothBatteryAccess {
    from_platform(crate::macos::bluetooth_access::access())
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn request_bluetooth_battery_access() -> BluetoothBatteryAccess {
    tauri::async_runtime::spawn_blocking(|| from_platform(crate::macos::bluetooth_access::request()))
        .await
        .unwrap_or(BluetoothBatteryAccess::NotDetermined)
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn open_bluetooth_privacy_settings() -> Result<(), String> {
    tauri_plugin_opener::open_url(PRIVACY_PAGE, None::<&str>).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn get_bluetooth_battery_access() -> BluetoothBatteryAccess {
    BluetoothBatteryAccess::Unsupported
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn request_bluetooth_battery_access() -> BluetoothBatteryAccess {
    BluetoothBatteryAccess::Unsupported
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn open_bluetooth_privacy_settings() -> Result<(), String> {
    Err("There is no Bluetooth privacy page to open on this system.".to_string())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::bluetooth_access::get_bluetooth_battery_access,
            crate::bluetooth_access::request_bluetooth_battery_access,
            crate::bluetooth_access::open_bluetooth_privacy_settings,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
