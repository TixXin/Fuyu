use std::{
    path::PathBuf,
    sync::{mpsc, Arc, PoisonError},
    thread,
    time::{Duration, Instant},
};
use tauri::AppHandle;
use windows::{
    UI::Notifications::Management::{
        UserNotificationListener, UserNotificationListenerAccessStatus,
    },
    Win32::{
        Foundation::HWND,
        System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    },
};

use super::{
    now_ms,
    specs::{ImSourceSpec, MatchRule, SOURCES},
    ImSourcesService,
};
use crate::{
    messages_plugin::{self, SourceSwitch},
    messenger_activation::{activate_existing_window, is_interactive_window},
    toast_notifications::{self, Subscription, ToastMatcher},
    wechat_reminders::{self, ReminderSignal},
    win32::{self, process, registry},
};

const MIN_MAIN_WIDTH: i32 = 320;
const MIN_MAIN_HEIGHT: i32 = 240;
const RESTORE_WAIT: Duration = Duration::from_millis(2_500);
const RESTORE_POLL_SLICE: Duration = Duration::from_millis(50);

pub(super) fn to_toast_matchers(rules: &[MatchRule]) -> Vec<ToastMatcher> {
    rules
        .iter()
        .map(|rule| match rule {
            MatchRule::AumidExact(value) => ToastMatcher::AumidExact((*value).into()),
            MatchRule::AumidPrefix(value) => ToastMatcher::AumidPrefix((*value).into()),
            MatchRule::AumidContains(value) => ToastMatcher::AumidContains((*value).into()),
            MatchRule::DisplayNameExact(value) => ToastMatcher::DisplayNameExact((*value).into()),
        })
        .collect()
}

pub(super) fn register_sources(service: &Arc<ImSourcesService>) {
    for (index, spec) in SOURCES.iter().enumerate() {
        let polled = Arc::clone(service);
        let foregrounded = Arc::clone(service);
        toast_notifications::subscribe(Subscription {
            source: spec.id,
            matchers: to_toast_matchers(spec.toast_rules),
            executables: spec
                .executables
                .iter()
                .map(|name| (*name).to_string())
                .collect(),
            on_poll: Arc::new(move |poll| polled.on_toast_poll(index, poll)),
            on_foreground: Arc::new(move |at| foregrounded.on_foreground(index, at)),
        });

        let switched = Arc::clone(service);
        let checked = Arc::clone(service);
        let switch = SourceSwitch::new(
            spec.id,
            move |enabled| {
                switched.on_set_enabled(index, enabled);
                toast_notifications::set_enabled(spec.id, enabled);
                set_shell_subscription(&switched, index, enabled);
            },
            move || checked.is_enabled(index) && toast_notifications::is_source_running(spec.id),
        );
        messages_plugin::register(spec.id, switch);
    }
}

fn set_shell_subscription(service: &Arc<ImSourcesService>, index: usize, enabled: bool) {
    let spec = &SOURCES[index];
    if enabled {
        let mut guard = service.slots[index]
            .shell_sub
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if guard.is_some() {
            return;
        }
        let target = Arc::clone(service);
        match wechat_reminders::subscribe_executable_attention(spec.executables, move |signal| {
            match signal {
                ReminderSignal::Attention => target.on_flash(index),
                ReminderSignal::Activated => target.on_foreground(index, now_ms()),
                _ => {}
            }
        }) {
            Ok(subscription) => {
                *guard = Some(subscription);
            }
            Err(error) => {
                eprintln!(
                    "failed to subscribe shell attention for {}: {error}",
                    spec.id
                );
            }
        }
    } else {
        let taken = service.slots[index]
            .shell_sub
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .take();
        drop(taken);
    }
}

pub(super) fn detect_installed_all() -> [bool; SOURCES.len()] {
    let uninstall_subkeys = collect_uninstall_subkeys();
    std::array::from_fn(|index| is_source_installed(&SOURCES[index], &uninstall_subkeys))
}

fn collect_uninstall_subkeys() -> Vec<String> {
    let mut keys = Vec::new();
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for path in [
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ] {
            keys.extend(registry::subkey_names(root, path));
        }
    }
    keys
}

fn is_source_installed(spec: &ImSourceSpec, uninstall_subkeys: &[String]) -> bool {
    if spec
        .protocols
        .iter()
        .any(|scheme| win32::app_activation::is_url_protocol_registered(scheme))
    {
        return true;
    }
    if win32::app_activation::has_packaged_app(spec.package_prefixes) {
        return true;
    }
    if has_tencent_registry_install(spec.tencent_keys, spec.executables) {
        return true;
    }
    if has_uninstall_install(spec.uninstall_keys, spec.executables, uninstall_subkeys) {
        return true;
    }
    process::running_executable(spec.executables).is_some()
}

fn has_tencent_registry_install(keys: &[&str], executables: &[&str]) -> bool {
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for product in keys {
            for subkey in [
                format!(r"Software\Tencent\{product}"),
                format!(r"Software\WOW6432Node\Tencent\{product}"),
            ] {
                if let Some(folder) = registry::read_string(root, &subkey, "InstallPath") {
                    let base = PathBuf::from(folder.trim().trim_matches('"'));
                    if executables.iter().any(|exe| base.join(exe).is_file()) || base.is_dir() {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn has_uninstall_install(
    known_keys: &[&str],
    executables: &[&str],
    uninstall_subkeys: &[String],
) -> bool {
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for base in [
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
        ] {
            for key_name in known_keys {
                let full_key = format!(r"{base}\{key_name}");
                if uninstall_key_has_valid_target(root, &full_key, executables) {
                    return true;
                }
            }
        }
    }
    uninstall_subkeys.iter().any(|subkey| {
        known_keys
            .iter()
            .any(|expected| subkey.eq_ignore_ascii_case(expected))
    })
}

fn uninstall_key_has_valid_target(
    root: windows::Win32::System::Registry::HKEY,
    full_key: &str,
    executables: &[&str],
) -> bool {
    if let Some(icon) = registry::read_string(root, full_key, "DisplayIcon") {
        let icon_path = PathBuf::from(registry::display_icon_path(&icon));
        if icon_path.is_file() {
            return true;
        }
    }
    if let Some(location) = registry::read_string(root, full_key, "InstallLocation") {
        let dir = PathBuf::from(location.trim().trim_matches('"'));
        if executables.iter().any(|exe| dir.join(exe).is_file()) || dir.is_dir() {
            return true;
        }
    }
    false
}

struct CandidateWindow {
    handle: HWND,
    process_id: u32,
    minimized: bool,
    area: i64,
}

struct WindowScan {
    candidates: Vec<CandidateWindow>,
    running: bool,
}

fn scan_source_windows(executables: &[&str]) -> Result<WindowScan, String> {
    let mut scan = WindowScan {
        candidates: Vec::new(),
        running: false,
    };
    win32::window::for_each_top_level_window(|window| {
        let process_id = process::window_process_id(window);
        let Some(path) = process::image_path(process_id) else {
            return;
        };
        let Some(file_name) = path.rsplit(['\\', '/']).next() else {
            return;
        };
        if !executables
            .iter()
            .any(|expected| file_name.eq_ignore_ascii_case(expected))
        {
            return;
        }
        scan.running = true;
        if win32::window::has_owner(window) || !win32::window::is_visible(window) {
            return;
        }
        let class = win32::window::class_name(window);
        if class == "Electron_NotifyIconHostWindow" {
            return;
        }
        let Some(rect) = win32::window::normal_position(window) else {
            return;
        };
        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width < MIN_MAIN_WIDTH || height < MIN_MAIN_HEIGHT {
            return;
        }
        scan.candidates.push(CandidateWindow {
            handle: window,
            process_id,
            minimized: win32::window::is_minimized(window),
            area: i64::from(width) * i64::from(height),
        });
    })
    .map_err(|error| format!("无法枚举桌面窗口：{error}"))?;
    if !scan.running && process::running_executable(executables).is_some() {
        scan.running = true;
    }
    Ok(scan)
}

fn best_candidate(candidates: &[CandidateWindow], foreground: HWND) -> Option<&CandidateWindow> {
    candidates.iter().max_by_key(|item| {
        (
            item.handle == foreground && !item.minimized,
            !item.minimized,
            item.area,
        )
    })
}

fn try_activate_candidate(candidate: &CandidateWindow, display_name: &str) -> Option<Result<(), String>> {
    win32::window::allow_set_foreground_window(candidate.process_id);
    if candidate.minimized {
        win32::window::restore_minimized(candidate.handle);
    }
    if is_interactive_window(candidate.handle) {
        Some(activate_existing_window(candidate.handle, display_name))
    } else {
        None
    }
}

fn wait_and_activate_main_window(spec: &ImSourceSpec, timeout: Duration) -> Result<bool, String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        let scan = scan_source_windows(spec.executables)?;
        if let Some(best) = best_candidate(&scan.candidates, win32::window::foreground_window()) {
            if let Some(result) = try_activate_candidate(best, spec.display_name) {
                result?;
                return Ok(true);
            }
        }
        thread::sleep(RESTORE_POLL_SLICE);
    }
    Ok(false)
}

pub(super) fn open_source(
    spec: &ImSourceSpec,
    last_packaged_aumid: Option<String>,
) -> Result<(), String> {
    let scan = scan_source_windows(spec.executables)?;
    if let Some(best) = best_candidate(&scan.candidates, win32::window::foreground_window()) {
        if let Some(result) = try_activate_candidate(best, spec.display_name) {
            return result;
        }
    }

    if spec.id == messages_plugin::TIM {
        return Err(if scan.running {
            "TIM 已在运行，但主窗口已收进托盘，请从系统托盘打开 TIM。".into()
        } else {
            "未找到正在运行的 TIM 窗口，请先打开并登录桌面版 TIM。".into()
        });
    }

    let packaged_aumid = last_packaged_aumid.or_else(|| {
        win32::app_activation::find_packaged_aumid(spec.package_prefixes, spec.fallback_aumids)
    });
    if let Some(aumid) = packaged_aumid {
        if let Ok(pid) = win32::app_activation::activate_application(&aumid) {
            win32::window::allow_set_foreground_window(pid);
            let _ = wait_and_activate_main_window(spec, RESTORE_WAIT);
            return Ok(());
        }
    }

    if let Some(scheme) = spec
        .protocols
        .iter()
        .copied()
        .find(|scheme| win32::app_activation::is_url_protocol_registered(scheme))
    {
        tauri_plugin_opener::open_url(format!("{scheme}://"), None::<&str>)
            .map_err(|error| format!("无法通过系统协议唤起 {}：{error}", spec.display_name))?;
        if wait_and_activate_main_window(spec, RESTORE_WAIT)? {
            return Ok(());
        }
        if !scan.running && process::running_executable(spec.executables).is_some() {
            return Ok(());
        }
        return Err(format!(
            "{} 未能恢复可交互的主窗口，请从系统托盘打开 {}。",
            spec.display_name, spec.display_name
        ));
    }

    Err(if scan.running {
        format!(
            "{} 已在运行，但主窗口已收起且未检测到可用唤回协议，请从系统托盘打开 {}。",
            spec.display_name, spec.display_name
        )
    } else {
        format!(
            "未检测到已安装的 {} 或可用启动协议，请先打开并登录 {}。",
            spec.display_name, spec.display_name
        )
    })
}

pub(super) async fn request_notification_access(app: AppHandle) -> Result<String, String> {
    let (sender, receiver) = mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let operation = (|| {
            let listener = UserNotificationListener::Current()?;
            let access = listener.GetAccessStatus()?;
            let operation = if access == UserNotificationListenerAccessStatus::Unspecified {
                Some(listener.RequestAccessAsync()?)
            } else {
                None
            };
            windows::core::Result::Ok((access, operation))
        })();
        let _ = sender.send(operation);
    })
    .map_err(|error| format!("无法发起通知授权：{error}"))?;
    let (access, operation) =
        tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(5)))
            .await
            .map_err(|error| format!("通知授权线程失败：{error}"))?
            .map_err(|error| format!("无法发起通知授权：{error}"))?
            .map_err(|error| format!("无法请求 Windows 通知权限：{error}"))?;
    let access = match operation {
        Some(operation) => operation
            .await
            .map_err(|error| format!("Windows 通知授权失败：{error}"))?,
        None => access,
    };
    Ok(match access {
        UserNotificationListenerAccessStatus::Allowed => "allowed",
        UserNotificationListenerAccessStatus::Denied => "denied",
        _ => "unspecified",
    }
    .to_string())
}

pub(super) fn open_notification_settings(access: bool) -> Result<(), String> {
    let url = if access {
        "ms-settings:privacy-notifications"
    } else {
        "ms-settings:notifications"
    };
    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|error| format!("无法打开 Windows 通知设置：{error}"))
}
