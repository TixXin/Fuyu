use crate::system::CommandExt;
use std::{path::Path, process::Command, thread, time::Duration};

use windows::Win32::System::Registry::HKEY_CURRENT_USER;

use crate::system::CREATE_NO_WINDOW;
use crate::win32::{process, registry};

const OLD_EXE: &str = "focusd-island.exe";
const OLD_UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\fly-island";

fn old_island_running() -> bool {
    process::running_executable(&[OLD_EXE]).is_some()
}

pub(super) fn stop_old_island() {
    if !old_island_running() {
        return;
    }
    let _ = Command::new("taskkill").creation_flags(CREATE_NO_WINDOW).args(["/IM", OLD_EXE, "/F"]).status();
    for _ in 0..50 {
        if !old_island_running() {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
}

pub(super) fn is_installed_copy() -> bool {
    std::env::current_exe().ok().and_then(|exe| exe.parent().map(|dir| dir.join("uninstall.exe").is_file())).unwrap_or(false)
}

fn old_install_dir() -> Option<String> {
    let command = registry::read_string(HKEY_CURRENT_USER, OLD_UNINSTALL_KEY, "UninstallString")?;
    let exe = command.trim().trim_matches('"');
    Some(Path::new(exe).parent()?.to_string_lossy().into_owned())
}

pub(super) fn uninstall_old() -> Result<bool, String> {
    let Some(dir) = old_install_dir() else {
        return Ok(false);
    };
    stop_old_island();
    let uninstaller = Path::new(&dir).join("uninstall.exe");
    let status = Command::new(&uninstaller)
        .creation_flags(CREATE_NO_WINDOW)
        .arg("/S")
        .arg(format!("_?={dir}"))
        .status()
        .map_err(|error| format!("Could not run {}: {error}", uninstaller.display()))?;
    if old_install_dir().is_some() {
        return Err(format!("{} ended with {status} and the old copy is still listed.", uninstaller.display()));
    }
    let _ = std::fs::remove_file(&uninstaller);
    let _ = std::fs::remove_dir(&dir);
    Ok(true)
}
