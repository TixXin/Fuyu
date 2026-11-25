use tauri::AppHandle;
#[cfg(windows)]
use std::sync::Mutex;
#[cfg(any(windows, target_os = "macos"))]
use tauri::Emitter;
#[cfg(windows)]
use windows::{
    core::{HSTRING, IInspectable},
    Data::Xml::Dom::XmlDocument,
    Foundation::TypedEventHandler,
    UI::Notifications::{NotificationSetting, ToastNotification, ToastNotificationManager},
};

#[cfg(windows)]
use super::update_notifications::escape_xml;
#[cfg(windows)]
use crate::win32::com::WinRtApartment;

#[cfg(any(windows, target_os = "macos"))]
const OPENED_EVENT: &str = "agent-notification-opened";
const MAX_TAG: usize = 64;
#[cfg(windows)]
const KEPT: usize = 8;
#[cfg(windows)]
static SHOWN: Mutex<Vec<ToastNotification>> = Mutex::new(Vec::new());

pub(crate) fn init(#[cfg_attr(not(target_os = "macos"), allow(unused_variables))] app: &AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        crate::macos::notifications::install_delegate(move |tag| {
            let _ = handle.emit_to(crate::island::WINDOW_LABEL, OPENED_EVENT, tag);
        });
    }
}

fn valid(tag: &str, title: &str, body: &str) -> bool {
    !tag.is_empty() && tag.len() <= MAX_TAG && !title.is_empty() && title.len() <= 512 && body.len() <= 4096
}

#[cfg(windows)]
fn show(app: AppHandle, tag: String, title: String, body: String) -> windows::core::Result<bool> {
    let _apartment = WinRtApartment::multithreaded()?;
    let notifier = ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(&app.config().identifier))?;
    if notifier.Setting()? != NotificationSetting::Enabled { return Ok(false); }
    let xml = XmlDocument::new()?;
    xml.LoadXml(&HSTRING::from(format!(
        "<toast><visual><binding template=\"ToastGeneric\"><text>{}</text><text>{}</text></binding></visual></toast>",
        escape_xml(&title), escape_xml(&body),
    )))?;
    let toast = ToastNotification::CreateToastNotification(&xml)?;
    toast.SetTag(&HSTRING::from(&tag))?;
    toast.SetGroup(&HSTRING::from("agent"))?;
    toast.Activated(&TypedEventHandler::<ToastNotification, IInspectable>::new(move |_, _| {
        let _ = app.emit_to(crate::island::WINDOW_LABEL, OPENED_EVENT, tag.clone());
        Ok(())
    }))?;
    notifier.Show(&toast)?;
    let mut shown = SHOWN.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if shown.len() >= KEPT { shown.remove(0); }
    shown.push(toast);
    Ok(true)
}

#[cfg(target_os = "macos")]
fn show(app: AppHandle, tag: String, title: String, body: String) -> Result<bool, String> {
    let sent = crate::macos::notifications::notify(&tag, &title, &body, move |opened| {
        let _ = app.emit_to(crate::island::WINDOW_LABEL, OPENED_EVENT, opened);
    });
    Ok(sent)
}

#[cfg(not(any(windows, target_os = "macos")))]
fn show(_app: AppHandle, _tag: String, _title: String, _body: String) -> Result<bool, String> {
    Ok(false)
}

#[tauri::command]
pub async fn agent_notify(app: AppHandle, tag: String, title: String, body: String) -> bool {
    if !valid(&tag, &title, &body) { return false; }
    tauri::async_runtime::spawn_blocking(move || show(app, tag, title, body).unwrap_or(false))
        .await.unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::valid;

    #[test]
    fn rejects_empty_or_oversized_input() {
        assert!(valid("claude:1", "Claude", ""));
        assert!(!valid("", "Claude", "body"));
        assert!(!valid(&"x".repeat(65), "Claude", "body"));
        assert!(!valid("claude:1", "", "body"));
        assert!(!valid("claude:1", "Claude", &"x".repeat(4097)));
    }
}
