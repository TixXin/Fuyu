use base64::{engine::general_purpose::STANDARD, Engine};
use crate::system::CommandExt;
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    sync::{Arc, PoisonError},
    thread,
    time::{Duration, Instant},
};
use windows::{
    core::{HRESULT, HSTRING},
    UI::Notifications::{NotificationSetting, ToastNotificationManager},
};

use super::history::NotificationBuffer;
use super::{publish, NotificationService, NotificationStatus, QQNotification};
use crate::toast_notifications::{self, PollBatch, ToastItem, ToastMatcher, ToastPoll};
use crate::win32;

pub(super) const QQ_APP_ID: &str = "QQ";

const REGISTRATION_REPAIR: &str = include_str!("repair-qq-notification-registration.ps1");

const DIAGNOSTICS: [(&str, &str); 3] = [
    (
        "Fuyu QQ notification diagnostic",
        "Local channel test; this is not a chat message.",
    ),
    (
        "FocuSD QQ notification diagnostic",
        "Local channel test; this is not a chat message.",
    ),
    ("FocuSD QQ 通知诊断", "这是本机通道测试，不是聊天消息。"),
];

pub(super) fn is_diagnostic(parts: &[String]) -> bool {
    parts.first().is_some_and(|title| {
        DIAGNOSTICS
            .iter()
            .any(|(known, body)| title == known && parts.iter().any(|part| part == body))
    })
}

pub(super) fn handle_poll(service: &Arc<NotificationService>, poll: ToastPoll) {
    let (enabled, generation) = match service.state.lock() {
        Ok(state) => (state.snapshot.enabled, state.generation),
        Err(_) => return,
    };
    if !enabled {
        return;
    }
    let channel_error = if matches!(&poll, ToastPoll::Listening(_)) {
        check_channel_error(service, generation)
    } else {
        None
    };
    let change = {
        let Ok(mut state) = service.state.lock() else {
            return;
        };
        if state.generation != generation || !state.snapshot.enabled {
            return;
        }
        let before = state.snapshot.clone();
        let newest = match poll {
            ToastPoll::Listening(items) => {
                let current = items.into_iter().filter_map(from_toast_item).collect();
                state.snapshot.status = NotificationStatus::Listening;
                state.snapshot.error = channel_error;
                let newest = state.buffer.sync(current);
                state.snapshot.items = state.buffer.items.clone();
                newest
            }
            ToastPoll::PermissionDenied => {
                state.buffer = NotificationBuffer::default();
                state.snapshot.items.clear();
                state.snapshot.status = NotificationStatus::PermissionDenied;
                state.snapshot.error = None;
                None
            }
            ToastPoll::PermissionRequired => {
                state.buffer = NotificationBuffer::default();
                state.snapshot.items.clear();
                state.snapshot.status = NotificationStatus::PermissionRequired;
                state.snapshot.error = None;
                None
            }
            ToastPoll::Error(error) => {
                state.snapshot.status = NotificationStatus::Error;
                state.snapshot.error = Some(error);
                None
            }
        };
        if state.snapshot != before {
            state.snapshot.revision += 1;
            Some((state.snapshot.clone(), newest))
        } else {
            None
        }
    };
    if let Some((snapshot, newest)) = change {
        publish(service, snapshot, newest);
    }
}

fn check_channel_error(service: &NotificationService, generation: u64) -> Option<String> {
    let setting = qq_notification_setting();
    let needs_repair = {
        let mut repair = service
            .repair
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if repair.generation != Some(generation) {
            repair.error = None;
            if should_repair_registration(&setting) {
                repair.generation = Some(generation);
                true
            } else {
                false
            }
        } else {
            false
        }
    };
    if needs_repair {
        let err = repair_registration(service, generation).err();
        service
            .repair
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .error = err;
    }
    let setting = qq_notification_setting();
    let mut repair = service
        .repair
        .lock()
        .unwrap_or_else(PoisonError::into_inner);
    if matches!(setting, Ok(NotificationSetting::Enabled)) {
        repair.error = None;
        None
    } else {
        repair.error.clone().or_else(|| registration_error(setting))
    }
}

fn qq_notification_setting() -> windows::core::Result<NotificationSetting> {
    let _apartment = win32::com::WinRtApartment::multithreaded()?;
    ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(QQ_APP_ID))?.Setting()
}

pub(super) fn should_repair_registration(
    setting: &windows::core::Result<NotificationSetting>,
) -> bool {
    setting
        .as_ref()
        .is_err_and(|error| error.code() == HRESULT(0x80070490u32 as i32))
}

pub(super) fn registration_error(
    setting: windows::core::Result<NotificationSetting>,
) -> Option<String> {
    match setting {
        Ok(NotificationSetting::Enabled) => None,
        Ok(NotificationSetting::DisabledForApplication) => {
            Some("QQ 的 Windows 通知已关闭，请在系统通知设置中开启。".into())
        }
        Ok(NotificationSetting::DisabledForUser) => {
            Some("Windows 系统通知已关闭，请在系统通知设置中开启。".into())
        }
        Ok(NotificationSetting::DisabledByGroupPolicy) => {
            Some("管理员策略禁止了 Windows 通知，请联系管理员。".into())
        }
        Ok(_) => Some("QQ 当前安装方式不支持系统通知，请检查或更新 QQ。".into()),
        Err(error) => Some(format!(
            "QQ 通知通道尚未就绪，请确认已安装 QQ；可关闭后重新开启接收以重试：{error}"
        )),
    }
}

fn repair_registration(service: &NotificationService, generation: u64) -> Result<(), String> {
    let script = format!("& {{\n{REGISTRATION_REPAIR}\n}} -Repair");
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let system_root = std::env::var_os("SystemRoot").ok_or("无法定位 Windows 通知修复工具。")?;
    let executable =
        PathBuf::from(system_root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(executable)
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            &STANDARD.encode(bytes),
        ])
        .creation_flags(0x08000000)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("无法启动 QQ 通知自动修复：{error}"))?;
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    Ok(())
                } else {
                    Err(
                        "QQ 通知自动修复未完成，请确认 QQ 安装正常；可关闭后重新开启接收以重试。"
                            .into(),
                    )
                }
            }
            Ok(None)
                if Instant::now() < deadline
                    && service.state.lock().is_ok_and(|state| {
                        state.snapshot.enabled && state.generation == generation
                    }) =>
            {
                thread::sleep(Duration::from_millis(50))
            }
            result => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(match result {
                    Err(error) => format!("QQ 通知自动修复失败：{error}"),
                    _ => "QQ 通知自动修复已停止或超时，可关闭后重新开启接收以重试。".into(),
                });
            }
        }
    }
}

#[cfg_attr(not(test), allow(dead_code))]
pub(super) fn read_notifications() -> Result<(NotificationStatus, Vec<QQNotification>), String> {
    match toast_notifications::read_matching(&[ToastMatcher::AumidExact(QQ_APP_ID.into())])? {
        PollBatch::Allowed(items) => Ok((
            NotificationStatus::Listening,
            items.into_iter().filter_map(from_toast_item).collect(),
        )),
        PollBatch::PermissionDenied => Ok((NotificationStatus::PermissionDenied, Vec::new())),
        PollBatch::PermissionRequired => Ok((NotificationStatus::PermissionRequired, Vec::new())),
    }
}

fn from_toast_item(item: ToastItem) -> Option<QQNotification> {
    if is_diagnostic(&item.texts) {
        return None;
    }
    let title = item
        .texts
        .first()
        .filter(|text| !text.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| "QQ".into());
    let body = item
        .texts
        .iter()
        .skip(1)
        .cloned()
        .collect::<Vec<_>>()
        .join("\n");
    Some(QQNotification {
        id: format!("QQ:{}:{}", item.id, item.ticks),
        title: title.chars().take(120).collect(),
        body: body.chars().take(1000).collect(),
        created_at: item.created_at,
    })
}
