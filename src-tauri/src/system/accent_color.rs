//! The Windows accent colour (Settings > Personalization > Colors), for the island's accent when
//! the theme follows it (C33.5).

use windows::Win32::System::Registry::HKEY_CURRENT_USER;

use crate::win32;

const DWM_KEY: &str = r"Software\Microsoft\Windows\DWM";

/// The accent as `#rrggbb`. DWM stores it as a DWORD in ABGR order.
pub(crate) fn accent_hex(abgr: u32) -> String {
    let red = abgr & 0xff;
    let green = (abgr >> 8) & 0xff;
    let blue = (abgr >> 16) & 0xff;
    format!("#{red:02x}{green:02x}{blue:02x}")
}

/// The Windows accent colour, or null when Windows does not say.
#[tauri::command]
pub fn get_windows_accent_color() -> Option<String> {
    win32::registry::read_u32(HKEY_CURRENT_USER, DWM_KEY, "AccentColor").map(accent_hex)
}

#[cfg(test)]
mod tests {
    use super::accent_hex;

    #[test]
    fn abgr_turns_into_rgb_hex() {
        // Windows' default blue, 0078D4, stored as ABGR.
        assert_eq!(accent_hex(0xffd4_7800), "#0078d4");
        assert_eq!(accent_hex(0x0000_00ff), "#ff0000");
    }
}
