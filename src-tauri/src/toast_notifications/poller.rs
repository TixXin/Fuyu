use std::collections::HashSet;
use windows::UI::Notifications::{
    KnownNotificationBindings,
    Management::{UserNotificationListener, UserNotificationListenerAccessStatus},
    NotificationKinds, UserNotification,
};

use super::{
    cache::{AppInfoCache, ToastApp},
    router::{matches_any, ticks_to_unix_ms, PollBatch, ToastItem, ToastMatcher},
};
use crate::win32;

pub(super) fn poll_once(
    cache: &mut AppInfoCache,
    active_matchers: &[ToastMatcher],
) -> Result<PollBatch, String> {
    let _apartment = win32::com::WinRtApartment::multithreaded()
        .map_err(|error| format!("无法初始化 Windows 通知：{error}"))?;
    let listener = UserNotificationListener::Current()
        .map_err(|error| format!("Windows 通知监听不可用：{error}"))?;
    let access = listener
        .GetAccessStatus()
        .map_err(|error| format!("无法检查通知权限：{error}"))?;
    if access != UserNotificationListenerAccessStatus::Allowed {
        cache.clear_active();
        return Ok(if access == UserNotificationListenerAccessStatus::Denied {
            PollBatch::PermissionDenied
        } else {
            PollBatch::PermissionRequired
        });
    }
    let operation = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .map_err(|error| format!("无法读取 Windows 通知：{error}"))?;
    let notifications =
        pollster::block_on(operation).map_err(|error| format!("无法读取 Windows 通知：{error}"))?;
    let mut active_ids = HashSet::new();
    let mut items = Vec::new();
    for notification in notifications {
        let Ok(id) = notification.Id() else {
            continue;
        };
        active_ids.insert(id);
        let app = cache.resolve(id, || read_toast_app(&notification));
        let Some(app) = app else {
            continue;
        };
        if !matches_any(active_matchers, &app) {
            continue;
        }
        if let Ok(item) = read_toast_item(&notification, id, app) {
            items.push(item);
        }
    }
    cache.retain_active(&active_ids);
    Ok(PollBatch::Allowed(items))
}

pub(super) fn foreground_executable() -> Option<String> {
    let process_id = win32::process::window_process_id(win32::window::foreground_window());
    let path = win32::process::image_path(process_id)?;
    std::path::Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
}

fn read_toast_app(notification: &UserNotification) -> Option<ToastApp> {
    let info = notification.AppInfo().ok()?;
    let aumid = info.AppUserModelId().ok()?.to_string_lossy();
    if aumid.trim().is_empty() {
        return None;
    }
    let display_name = info
        .DisplayInfo()
        .and_then(|display| display.DisplayName())
        .map(|name| name.to_string_lossy())
        .unwrap_or_default();
    Some(ToastApp {
        aumid,
        display_name,
    })
}

fn read_toast_item(
    notification: &UserNotification,
    id: u32,
    app: ToastApp,
) -> windows::core::Result<ToastItem> {
    let ticks = notification.CreationTime()?.UniversalTime;
    let mut texts = Vec::new();
    if let Ok(elements) = notification
        .Notification()?
        .Visual()?
        .GetBinding(&KnownNotificationBindings::ToastGeneric()?)
        .and_then(|binding| binding.GetTextElements())
    {
        for element in elements {
            if let Ok(text) = element.Text() {
                texts.push(text.to_string_lossy());
            }
        }
    }
    Ok(ToastItem {
        id,
        ticks,
        created_at: ticks_to_unix_ms(ticks),
        app,
        texts,
    })
}
