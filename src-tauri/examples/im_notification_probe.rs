#[cfg(windows)]
#[path = "../src/im_sources/specs.rs"]
mod im_specs;

#[cfg(windows)]
#[path = "../src/wechat_reminders/source.rs"]
mod shell_source;

#[cfg(windows)]
#[path = "../src/win32/com.rs"]
#[allow(dead_code)]
mod win32_com;
#[cfg(windows)]
#[path = "../src/win32/message_window.rs"]
#[allow(dead_code)]
mod win32_message_window;
#[cfg(windows)]
#[path = "../src/win32/process.rs"]
#[allow(dead_code)]
mod win32_process;
#[cfg(windows)]
#[path = "../src/win32/registry.rs"]
#[allow(dead_code)]
mod win32_registry;
#[cfg(windows)]
#[path = "../src/win32/shell_hook.rs"]
mod win32_shell_hook;
#[cfg(windows)]
#[path = "../src/win32/window.rs"]
#[allow(dead_code)]
mod win32_window;

#[cfg(windows)]
mod win32 {
    pub(crate) use super::win32_com as com;
    pub(crate) use super::win32_message_window as message_window;
    pub(crate) use super::win32_process as process;
    pub(crate) use super::win32_registry as registry;
    pub(crate) use super::win32_shell_hook as shell_hook;
    pub(crate) use super::win32_window as window;
}

#[cfg(windows)]
mod probe {
    use std::{
        cell::RefCell,
        collections::{BTreeMap, HashSet},
        env,
        process::ExitCode,
        rc::Rc,
        thread,
        time::{Duration, Instant},
    };

    use serde_json::{json, Value};
    use windows::{
        core::Error,
        UI::Notifications::{
            Management::{UserNotificationListener, UserNotificationListenerAccessStatus},
            NotificationKinds,
        },
    };

    use super::{
        im_specs::{match_source, SOURCES},
        shell_source::{ route_multi_signals, ReminderListener, ReminderSignal, ShellMatcher },
        win32,
    };

    #[derive(Default)]
    struct ToastInventory {
        identities: HashSet<(u32, i64)>,
        by_app: BTreeMap<(String, String), usize>,
        by_source: [usize; SOURCES.len()],
        metadata_errors: usize,
    }

    #[derive(Default)]
    struct WatchTallies {
        flash_events: [u64; SOURCES.len()],
        activated_events: [u64; SOURCES.len()],
    }

    pub(super) fn main() -> ExitCode {
        match run() {
            Ok(()) => ExitCode::SUCCESS,
            Err(error) => {
                println!("{}", json!({ "result": "error", "error": error }));
                ExitCode::FAILURE
            }
        }
    }

    fn run() -> Result<(), String> {
        let watch_seconds = parse_watch_seconds()?;
        let _winrt = win32::com::WinRtApartment::multithreaded()
            .map_err(|error| describe_error("initialize_winrt", error))?;
        let listener = UserNotificationListener::Current()
            .map_err(|error| describe_error("create_listener", error))?;
        let access = listener
            .GetAccessStatus()
            .map_err(|error| describe_error("read_access_status", error))?;

        let baseline = if access == UserNotificationListenerAccessStatus::Allowed {
            Some(read_toast_inventory(&listener)?)
        } else {
            None
        };

        let initial_apps = baseline
            .as_ref()
            .map(|inv| format_app_rows(&inv.by_app))
            .unwrap_or_default();
        println!(
            "{}",
            json!({
                "phase": "initial",
                "access": access_label(access),
                "watchSeconds": watch_seconds,
                "readOnly": true,
                "printsMessageText": false,
                "totalNotifications": baseline.as_ref().map_or(0, |inv| inv.identities.len()),
                "metadataErrors": baseline.as_ref().map_or(0, |inv| inv.metadata_errors),
                "apps": initial_apps,
            })
        );

        if watch_seconds == 0 {
            return Ok(());
        }

        let matchers: Vec<ShellMatcher> = SOURCES
            .iter()
            .map(|spec| ShellMatcher::file_names(spec.executables))
            .collect();
        let tallies = Rc::new(RefCell::new(WatchTallies::default()));
        let sink = Rc::clone(&tallies);
        let shell_listener = ReminderListener::raw(move |signal, target, foreground| {
            let deliveries = route_multi_signals(
                signal,
                &target,
                foreground.as_deref(),
                matchers.iter().enumerate(),
            );
            let Ok(mut guard) = sink.try_borrow_mut() else {
                return;
            };
            for (index, routed) in deliveries {
                match routed {
                    ReminderSignal::Attention => guard.flash_events[index] += 1,
                    ReminderSignal::Activated => guard.activated_events[index] += 1,
                    _ => {}
                }
            }
        })?;

        let mut seen_ids = baseline
            .as_ref()
            .map(|inv| inv.identities.clone())
            .unwrap_or_default();
        let mut new_toasts = [0usize; SOURCES.len()];
        let mut new_apps: BTreeMap<(String, String), usize> = BTreeMap::new();
        let mut metadata_errors = baseline.as_ref().map_or(0, |inv| inv.metadata_errors);

        let deadline = Instant::now() + Duration::from_secs(watch_seconds);
        let mut next_toast_poll = Instant::now() + Duration::from_secs(1);
        while Instant::now() < deadline {
            shell_listener.poll();
            let now = Instant::now();
            if now >= next_toast_poll {
                next_toast_poll = now + Duration::from_secs(1);
                if let Ok(UserNotificationListenerAccessStatus::Allowed) = listener.GetAccessStatus()
                {
                    let current = read_toast_inventory_diff(
                        &listener,
                        &mut seen_ids,
                        &mut new_toasts,
                        &mut new_apps,
                    )?;
                    metadata_errors += current;
                }
            }
            thread::sleep(
                Duration::from_millis(30).min(deadline.saturating_duration_since(Instant::now())),
            );
        }
        shell_listener.poll();

        let shell_stats = shell_listener.stats();
        let snapshot_tallies = tallies.borrow();
        let per_source: Vec<Value> = SOURCES
            .iter()
            .enumerate()
            .map(|(index, spec)| {
                json!({
                    "source": spec.id,
                    "baselineToasts": baseline.as_ref().map_or(0, |inv| inv.by_source[index]),
                    "newToasts": new_toasts[index],
                    "flashEvents": snapshot_tallies.flash_events[index],
                    "activatedEvents": snapshot_tallies.activated_events[index],
                })
            })
            .collect();

        println!(
            "{}",
            json!({
                "phase": "summary",
                "watchSeconds": watch_seconds,
                "readOnly": true,
                "printsMessageText": false,
                "shellEvents": shell_stats.shell_events,
                "shellMetadataErrors": shell_stats.metadata_errors,
                "toastMetadataErrors": metadata_errors,
                "sources": per_source,
                "newToastApps": format_app_rows(&new_apps),
            })
        );
        Ok(())
    }

    fn parse_watch_seconds() -> Result<u64, String> {
        let args: Vec<String> = env::args().skip(1).collect();
        match args.as_slice() {
            [] => Ok(15),
            [single] if single.starts_with("--watch-seconds=") => single
                .trim_start_matches("--watch-seconds=")
                .parse::<u64>()
                .ok()
                .filter(|seconds| *seconds <= 300)
                .ok_or_else(|| "--watch-seconds must be an integer between 0 and 300".to_string()),
            [flag, value] if flag == "--watch-seconds" => value
                .parse::<u64>()
                .ok()
                .filter(|seconds| *seconds <= 300)
                .ok_or_else(|| "--watch-seconds must be an integer between 0 and 300".to_string()),
            _ => Err("Usage: im_notification_probe [--watch-seconds 0..300]".to_string()),
        }
    }

    fn read_toast_inventory(listener: &UserNotificationListener) -> Result<ToastInventory, String> {
        let operation = listener
            .GetNotificationsAsync(NotificationKinds::Toast)
            .map_err(|error| describe_error("start_read_notifications", error))?;
        let notifications = pollster::block_on(operation)
            .map_err(|error| describe_error("read_notifications", error))?;
        let mut inventory = ToastInventory::default();
        for notification in notifications {
            let identity = notification.Id().and_then(|id| {
                notification
                    .CreationTime()
                    .map(|created_at| (id, created_at.UniversalTime))
            });
            let Ok(identity) = identity else {
                inventory.metadata_errors += 1;
                continue;
            };
            let Some((aumid, display_name)) = read_app_meta(&notification) else {
                inventory.metadata_errors += 1;
                continue;
            };
            inventory.identities.insert(identity);
            *inventory
                .by_app
                .entry((aumid.clone(), display_name.clone()))
                .or_insert(0) += 1;
            if let Some(matched) = match_source(&aumid, &display_name) {
                if let Some(index) = SOURCES.iter().position(|spec| spec.id == matched) {
                    inventory.by_source[index] += 1;
                }
            }
        }
        Ok(inventory)
    }

    fn read_toast_inventory_diff(
        listener: &UserNotificationListener,
        seen_ids: &mut HashSet<(u32, i64)>,
        new_toasts: &mut [usize; SOURCES.len()],
        new_apps: &mut BTreeMap<(String, String), usize>,
    ) -> Result<usize, String> {
        let operation = listener
            .GetNotificationsAsync(NotificationKinds::Toast)
            .map_err(|error| describe_error("start_read_notifications", error))?;
        let notifications = pollster::block_on(operation)
            .map_err(|error| describe_error("read_notifications", error))?;
        let mut errors = 0usize;
        for notification in notifications {
            let identity = notification.Id().and_then(|id| {
                notification
                    .CreationTime()
                    .map(|created_at| (id, created_at.UniversalTime))
            });
            let Ok(identity) = identity else {
                errors += 1;
                continue;
            };
            if !seen_ids.insert(identity) {
                continue;
            }
            let Some((aumid, display_name)) = read_app_meta(&notification) else {
                errors += 1;
                continue;
            };
            *new_apps
                .entry((aumid.clone(), display_name.clone()))
                .or_insert(0) += 1;
            if let Some(matched) = match_source(&aumid, &display_name) {
                if let Some(index) = SOURCES.iter().position(|spec| spec.id == matched) {
                    new_toasts[index] += 1;
                }
            }
        }
        Ok(errors)
    }

    fn read_app_meta(
        notification: &windows::UI::Notifications::UserNotification,
    ) -> Option<(String, String)> {
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
        Some((aumid, display_name))
    }

    fn format_app_rows(rows: &BTreeMap<(String, String), usize>) -> Vec<Value> {
        rows.iter()
            .map(|((aumid, display_name), count)| {
                json!({
                    "aumid": aumid,
                    "displayName": display_name,
                    "count": count,
                    "matchedSource": match_source(aumid, display_name),
                })
            })
            .collect()
    }

    fn access_label(access: UserNotificationListenerAccessStatus) -> &'static str {
        match access {
            UserNotificationListenerAccessStatus::Allowed => "allowed",
            UserNotificationListenerAccessStatus::Denied => "denied",
            UserNotificationListenerAccessStatus::Unspecified => "unspecified",
            _ => "unknown",
        }
    }

    fn describe_error(operation: &str, error: Error) -> String {
        format!("{operation}: {} ({})", error.code(), error.message())
    }
}

#[cfg(windows)]
fn main() -> std::process::ExitCode {
    probe::main()
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This probe only runs on Windows.");
}
