use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, Monitor, Position, Size, WebviewWindow};

use super::popup_place::{is_terminal_process, place_by_pointer, popup_size, OPENED_EVENT, POINTER_GAP};
pub(super) use super::popup_place::PasteOptions;
pub(crate) use super::popup_place::WINDOW_LABEL;
use super::{command_text, service, ClipboardHistoryItemKind, ClipboardHistorySettings, CopyAs, PopupPosition};
use crate::island::screen;
use crate::macos::{apps, input};

const FOCUS_SETTLE: Duration = Duration::from_millis(120);
const PIN_GRIP: i32 = 24;

static TARGET_APP: Mutex<Option<i32>> = Mutex::new(None);

fn popup_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "The clipboard window is missing.".to_string())
}

fn work_area_in_points(monitor: &Monitor) -> (i32, i32, i32, i32) {
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let left = (f64::from(work.position.x) / scale).round() as i32;
    let top = (f64::from(work.position.y) / scale).round() as i32;
    let width = (f64::from(work.size.width) / scale).round() as i32;
    let height = (f64::from(work.size.height) / scale).round() as i32;
    (left, top, left + width, top + height)
}

fn screen_bounds(monitor: &Monitor) -> (i32, i32, i32, i32) {
    let origin = screen::monitor_origin(monitor);
    let size = screen::monitor_size(monitor);
    (origin.x, origin.y, origin.x + size.width as i32, origin.y + size.height as i32)
}

fn contains((left, top, right, bottom): (i32, i32, i32, i32), (x, y): (i32, i32)) -> bool {
    x >= left && x < right && y >= top && y < bottom
}

fn monitor_at(app: &AppHandle, point: (i32, i32)) -> Option<Monitor> {
    app.available_monitors().ok()?.into_iter().find(|monitor| contains(screen_bounds(monitor), point))
}

fn pinned_origin(settings: &ClipboardHistorySettings, screens: &[(i32, i32, i32, i32)]) -> Option<(i32, i32)> {
    let (x, y) = (settings.popup_pin_x?, settings.popup_pin_y?);
    let grip = (x.saturating_add(PIN_GRIP), y.saturating_add(PIN_GRIP));
    (settings.popup_pinned && screens.iter().any(|bounds| contains(*bounds, grip))).then_some((x, y))
}

pub(super) fn toggle(app: &AppHandle, settings: &ClipboardHistorySettings) -> Result<(), String> {
    let window = super::background::ensure_popup_window(app)?;
    if window.is_visible().unwrap_or(false) {
        return hide(app);
    }
    let _ = window.set_content_protected(settings.hide_from_capture);
    super::sequence::stop();
    let own = i32::try_from(std::process::id()).ok();
    *TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner) = apps::frontmost_pid().filter(|pid| Some(*pid) != own);

    let (width, height) = popup_size(settings.popup_layout);
    let _ = window.set_size(Size::Logical(LogicalSize::new(width, height)));
    let screens: Vec<_> = app.available_monitors().unwrap_or_default().iter().map(screen_bounds).collect();
    let pointer = screen::cursor_position().map(|(x, y)| (x.round() as i32, y.round() as i32));
    let monitor = pointer.and_then(|point| monitor_at(app, point)).or_else(|| window.primary_monitor().ok().flatten());
    if let Some((x, y)) = pinned_origin(settings, &screens) {
        let _ = window.set_position(Position::Logical(LogicalPosition::new(f64::from(x), f64::from(y))));
    } else if let Some(monitor) = monitor {
        let area = work_area_in_points(&monitor);
        let size = (width.round() as i32, height.round() as i32);
        let (x, y) = match (settings.popup_position, pointer) {
            (PopupPosition::Cursor, Some(pointer)) => place_by_pointer(pointer, size, area, POINTER_GAP),
            _ => (area.0 + (area.2 - area.0 - size.0) / 2, area.1 + (area.3 - area.1 - size.1) / 3),
        };
        let _ = window.set_position(Position::Logical(LogicalPosition::new(f64::from(x), f64::from(y))));
    }
    let _ = window.emit_to(WINDOW_LABEL, OPENED_EVENT, ());
    let _ = window.emit_to(crate::onboarding_window::WINDOW_LABEL, OPENED_EVENT, ());
    window.show().map_err(|error| error.to_string())?;
    let handle = app.clone();
    let shown = app.run_on_main_thread(move || {
        if !crate::macos::island_panel::make_panel_key(&handle, WINDOW_LABEL) {
            if let Ok(window) = popup_window(&handle) {
                let _ = window.set_focus();
            }
        }
    });
    shown.map_err(|error| error.to_string())
}

pub(super) fn hide(app: &AppHandle) -> Result<(), String> {
    super::preview_window::hide(app, false);
    super::background::schedule_preview_close_after_popup(app);
    let Some(window) = app.get_webview_window(WINDOW_LABEL) else {
        return Ok(());
    };
    window.hide().map_err(|error| error.to_string())
}

pub(super) fn refocus(app: &AppHandle) -> Result<(), String> {
    if !popup_window(app)?.is_visible().unwrap_or(false) {
        return Ok(());
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if !crate::macos::island_panel::make_panel_key(&handle, WINDOW_LABEL) {
            if let Ok(window) = popup_window(&handle) {
                let _ = window.set_focus();
            }
        }
    })
    .map_err(|error| error.to_string())
}

pub(super) fn outer_position(app: &AppHandle) -> Option<(i32, i32)> {
    let position = screen::window_position(&popup_window(app).ok()?).ok()?;
    Some((position.x, position.y))
}

pub(super) fn note_target(_app: &AppHandle) {
    let own = i32::try_from(std::process::id()).ok();
    if let Some(pid) = apps::frontmost_pid().filter(|pid| Some(*pid) != own) {
        *TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner) = Some(pid);
    }
}

fn take_target() -> Option<i32> {
    TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner).take()
}

fn target_for_paste(pinned: bool) -> Option<i32> {
    if pinned {
        *TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner)
    } else {
        take_target()
    }
}

pub(super) fn paste(app: &AppHandle, id: &str, options: PasteOptions) -> Result<bool, String> {
    let service = service()?;
    let snapshot = service.snapshot()?;
    let settings = &snapshot.settings;
    let item = snapshot.items.iter().find(|item| item.id == id);
    let is_image = item.is_some_and(|item| matches!(item.kind, ClipboardHistoryItemKind::Image | ClipboardHistoryItemKind::Files));
    let target = target_for_paste(settings.popup_pinned);
    let into_terminal = target.and_then(apps::path).is_some_and(|path| is_terminal_process(&path));
    let split_command = item
        .filter(|_| options.copy_as.is_none() && into_terminal && settings.auto_paste && settings.flatten_terminal_commands)
        .and_then(|item| item.text.as_deref())
        .filter(|text| command_text::looks_like_split_command(text));
    if let Some(text) = split_command {
        super::suspend_clipboard_capture(Duration::from_millis(800));
        super::clipboard_io::write_clipboard_text(&command_text::flatten_command(text))?;
    } else {
        let copy_as = match options.copy_as {
            Some(copy_as) => copy_as,
            None if is_image && settings.auto_paste && settings.terminal_image_path && into_terminal => CopyAs::Path,
            None if options.plain => CopyAs::Plain,
            None => CopyAs::Original,
        };
        service.copy_item_as(id, copy_as)?;
    }
    if !settings.popup_pinned {
        hide(app)?;
    }
    Ok(paste_into(target, settings.auto_paste, options.enter))
}

pub(super) fn paste_text(app: &AppHandle, text: &str, enter: bool) -> Result<(), String> {
    let settings = service()?.snapshot()?.settings;
    super::suspend_clipboard_capture(Duration::from_millis(800));
    super::clipboard_io::write_clipboard_text(text)?;
    if !settings.popup_pinned {
        hide(app)?;
    }
    paste_into(target_for_paste(settings.popup_pinned), settings.auto_paste, enter);
    Ok(())
}

fn will_send_keys(target: Option<i32>, auto_paste: bool, can_post_keys: impl FnOnce() -> bool) -> Option<i32> {
    target.filter(|_| auto_paste && can_post_keys())
}

fn paste_into(target: Option<i32>, auto_paste: bool, enter: bool) -> bool {
    let Some(target) = will_send_keys(target, auto_paste, input::can_post_keys) else {
        if target.is_some() && auto_paste {
            thread::spawn(input::ask_to_post_keys);
        }
        return false;
    };
    thread::spawn(move || {
        if apps::activate(target) {
            thread::sleep(FOCUS_SETTLE);
            input::send_paste_shortcut();
            if enter {
                thread::sleep(FOCUS_SETTLE);
                input::send_enter();
            }
        }
    });
    true
}

#[cfg(test)]
mod tests {
    use super::{pinned_origin, will_send_keys, ClipboardHistorySettings};

    fn pinned_at(pinned: bool, x: Option<i32>, y: Option<i32>) -> ClipboardHistorySettings {
        ClipboardHistorySettings { popup_pinned: pinned, popup_pin_x: x, popup_pin_y: y, ..ClipboardHistorySettings::default() }
    }

    #[test]
    fn keys_are_sent_only_with_a_target_auto_paste_and_access() {
        assert_eq!(will_send_keys(Some(42), true, || true), Some(42));
        assert_eq!(will_send_keys(Some(42), true, || false), None);
        assert_eq!(will_send_keys(Some(42), false, || true), None);
        assert_eq!(will_send_keys(None, true, || true), None);
    }

    #[test]
    fn the_pinned_spot_is_used_only_while_it_is_on_a_screen() {
        let screens = [(0, 0, 1512, 982), (1512, -200, 3432, 880)];
        assert_eq!(pinned_origin(&pinned_at(true, Some(2000), Some(100)), &screens), Some((2000, 100)));
        assert_eq!(pinned_origin(&pinned_at(true, Some(1600), Some(-150)), &screens), Some((1600, -150)));
        assert_eq!(pinned_origin(&pinned_at(true, Some(4000), Some(100)), &screens), None);
        assert_eq!(pinned_origin(&pinned_at(true, Some(2000), Some(100)), &screens[..1]), None);
        assert_eq!(pinned_origin(&pinned_at(false, Some(200), Some(100)), &screens), None);
        assert_eq!(pinned_origin(&pinned_at(true, None, Some(100)), &screens), None);
    }
}
