use std::{os::windows::process::CommandExt, process::Command};

use super::CREATE_NO_WINDOW;
use crate::user_error::UserError;

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
    if super::msix::is_packaged() || !reg(&["query", STARTUP_REGISTRY_KEY, "/v", LEGACY_STARTUP_REGISTRY_VALUE])? {
        return Ok(false);
    }
    set_registry_value(true)?;
    reg(&["delete", STARTUP_REGISTRY_KEY, "/v", LEGACY_STARTUP_REGISTRY_VALUE, "/f"])?;
    Ok(true)
}

#[tauri::command]
pub async fn get_launch_at_startup() -> Result<bool, UserError> {
    if super::msix::is_packaged() {
        return super::msix::startup_enabled();
    }
    Ok(registry_value_present()?)
}

#[tauri::command]
pub async fn set_launch_at_startup(enabled: bool) -> Result<(), UserError> {
    crate::dev_lane::refuse_in_preview("change launch at startup")?;
    if super::msix::is_packaged() {
        return super::msix::set_startup(enabled);
    }
    Ok(set_registry_value(enabled)?)
}

fn registry_value_present() -> Result<bool, String> {
    let mut command = Command::new("reg");
    let status = command
        .creation_flags(CREATE_NO_WINDOW)
        .args(["query", STARTUP_REGISTRY_KEY, "/v", STARTUP_REGISTRY_VALUE])
        .status()
        .map_err(|error| format!("Failed to query startup registry: {error}"))?;

    Ok(status.success())
}

fn set_registry_value(enabled: bool) -> Result<(), String> {
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
