use std::{os::windows::process::CommandExt, process::Command};

use super::CREATE_NO_WINDOW;

pub(super) const STARTUP_REGISTRY_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
pub(super) const STARTUP_REGISTRY_VALUE: &str = "Fuyu";
const LEGACY_STARTUP_REGISTRY_VALUE: &str = "FocuSD Island";

fn reg(args: &[&str]) -> Result<bool, String> {
    Command::new("reg")
        .creation_flags(CREATE_NO_WINDOW)
        .args(args)
        .status()
        .map(|status| status.success())
        .map_err(|error| format!("Failed to run reg: {error}"))
}

pub(crate) fn migrate_legacy_value() -> Result<bool, String> {
    if !reg(&["query", STARTUP_REGISTRY_KEY, "/v", LEGACY_STARTUP_REGISTRY_VALUE])? {
        return Ok(false);
    }
    set_launch_at_startup(true)?;
    reg(&["delete", STARTUP_REGISTRY_KEY, "/v", LEGACY_STARTUP_REGISTRY_VALUE, "/f"])?;
    Ok(true)
}

#[tauri::command]
pub fn get_launch_at_startup() -> Result<bool, String> {
    let mut command = Command::new("reg");
    let status = command
        .creation_flags(CREATE_NO_WINDOW)
        .args(["query", STARTUP_REGISTRY_KEY, "/v", STARTUP_REGISTRY_VALUE])
        .status()
        .map_err(|error| format!("Failed to query startup registry: {error}"))?;

    Ok(status.success())
}

#[tauri::command]
pub fn set_launch_at_startup(enabled: bool) -> Result<(), String> {
    crate::dev_lane::refuse_in_preview("change launch at startup")?;
    let status = if enabled {
        let current_exe = std::env::current_exe()
            .map_err(|error| format!("Failed to resolve current executable: {error}"))?;
        let startup_value = format!("\"{}\"", current_exe.display());

        let mut command = Command::new("reg");
        command
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "add",
                STARTUP_REGISTRY_KEY,
                "/v",
                STARTUP_REGISTRY_VALUE,
                "/t",
                "REG_SZ",
                "/d",
            ])
            .arg(startup_value)
            .arg("/f")
            .status()
    } else {
        let mut command = Command::new("reg");
        command
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "delete",
                STARTUP_REGISTRY_KEY,
                "/v",
                STARTUP_REGISTRY_VALUE,
                "/f",
            ])
            .status()
    }
    .map_err(|error| format!("Failed to update startup registry: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err("Startup registry command failed.".to_string())
    }
}
