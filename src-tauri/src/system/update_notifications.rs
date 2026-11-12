use std::{collections::HashSet, sync::{Mutex, OnceLock}};

use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::{
    core::{HSTRING, IInspectable},
    Data::Xml::Dom::XmlDocument,
    Foundation::TypedEventHandler,
    UI::Notifications::{NotificationSetting, ToastNotification, ToastNotificationManager},
    Win32::System::Registry::HKEY_LOCAL_MACHINE,
};

use crate::win32::{com::WinRtApartment, registry};
use super::update_runtime::{updater_state, Stage};

const OPEN_SETTINGS_EVENT: &str = "updater-open-settings";
const CURRENT_VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

#[derive(Default)]
struct Notifications {
    shown: HashSet<String>,
    active: Option<ToastNotification>,
}

static NOTIFICATIONS: OnceLock<Mutex<Notifications>> = OnceLock::new();

fn escape_xml(value: &str) -> String {
    value.chars().filter(|c| !c.is_control() || matches!(c, '\n' | '\r' | '\t'))
        .collect::<String>()
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn show_notification(app: AppHandle, version: String, title: String, body: String) -> windows::core::Result<bool> {
    let _apartment = WinRtApartment::multithreaded()?;
    let snapshot = updater_state();
    if snapshot.stage != Stage::Available || snapshot.next_version != version {
        return Ok(false);
    }
    let key = format!("{}:{version}", snapshot.channel.as_deref().unwrap_or("stable"));
    let mut notifications = NOTIFICATIONS.get_or_init(|| Mutex::new(Notifications::default()))
        .lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if notifications.shown.contains(&key) { return Ok(false); }

    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(&app.config().identifier))?;
    if notifier.Setting()? != NotificationSetting::Enabled { return Ok(false); }
    let xml = XmlDocument::new()?;
    xml.LoadXml(&HSTRING::from(format!(
        "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
        escape_xml(&title), escape_xml(&body),
    )))?;
    let toast = ToastNotification::CreateToastNotification(&xml)?;
    toast.SetTag(&HSTRING::from("update"))?;
    toast.SetGroup(&HSTRING::from("application"))?;
    let app_for_click = app.clone();
    toast.Activated(&TypedEventHandler::<ToastNotification, IInspectable>::new(move |_, _| {
        let _ = app_for_click.emit_to(crate::island::WINDOW_LABEL, OPEN_SETTINGS_EVENT, ());
        Ok(())
    }))?;
    notifier.Show(&toast)?;
    notifications.shown.insert(key);
    notifications.active = Some(toast);
    Ok(true)
}

#[tauri::command]
pub async fn updater_notify(app: AppHandle, version: String, title: String, body: String) -> bool {
    if version.is_empty() || version.len() > 128 || title.len() > 512 || body.len() > 4096 {
        return false;
    }
    tauri::async_runtime::spawn_blocking(move || show_notification(app, version, title, body).unwrap_or(false))
        .await.unwrap_or(false)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDiagnostics {
    os_version: String,
    architecture: &'static str,
}

#[tauri::command]
pub async fn updater_diagnostics() -> UpdateDiagnostics {
    let build = registry::read_string(HKEY_LOCAL_MACHINE, CURRENT_VERSION_KEY, "CurrentBuildNumber")
        .unwrap_or_else(|| "unknown".into());
    let revision = registry::read_u32(HKEY_LOCAL_MACHINE, CURRENT_VERSION_KEY, "UBR");
    let os_version = revision.map_or_else(
        || format!("Windows build {build}"),
        |revision| format!("Windows build {build}.{revision}"),
    );
    UpdateDiagnostics { os_version, architecture: std::env::consts::ARCH }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notification_text_cannot_inject_xml() {
        assert_eq!(escape_xml("A & <text>\"'\0"), "A &amp; &lt;text&gt;&quot;&apos;");
    }

    #[test]
    fn diagnostic_serialization_is_an_explicit_whitelist() {
        let value = serde_json::to_value(UpdateDiagnostics {
            os_version: "Windows build 26100".into(), architecture: "x86_64",
        }).unwrap();
        assert_eq!(value.as_object().unwrap().len(), 2);
        assert_eq!(value["osVersion"], "Windows build 26100");
        assert_eq!(value["architecture"], "x86_64");
    }
}
