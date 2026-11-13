use crate::macos::login_item::{self, LoginItem};

#[tauri::command]
pub fn get_launch_at_startup() -> Result<bool, String> {
    Ok(login_item::status() == LoginItem::On)
}

#[tauri::command]
pub fn set_launch_at_startup(enabled: bool) -> Result<(), String> {
    crate::dev_lane::refuse_in_preview("change launch at startup")?;
    match login_item::set(enabled)? {
        LoginItem::NeedsApproval if enabled => {
            login_item::open_login_items_settings();
            Err("macOS needs your approval: turn on Fuyu in System Settings > General > Login Items.".to_string())
        }
        _ => Ok(()),
    }
}
