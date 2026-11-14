use std::{
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};
use windows::Win32::Foundation::HWND;

use super::popup_place::{is_terminal_process, place_by_pointer, popup_size, OPENED_EVENT, POINTER_GAP};
pub(crate) use super::popup_place::WINDOW_LABEL;
pub(super) use super::popup_place::PasteOptions;
use super::{command_text, service, ClipboardHistoryItemKind, ClipboardHistorySettings, CopyAs, PopupPosition};
use crate::win32;


const FOCUS_SETTLE: Duration = Duration::from_millis(70);

static TARGET_WINDOW: Mutex<Option<isize>> = Mutex::new(None);

fn popup_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WINDOW_LABEL)
        .ok_or_else(|| "The clipboard window is missing.".to_string())
}

pub(super) fn toggle(app: &AppHandle, settings: &ClipboardHistorySettings) -> Result<(), String> {
    let (position, layout) = (settings.popup_position, settings.popup_layout);
    let window = popup_window(app)?;
    if window.is_visible().unwrap_or(false) {
        return hide(app);
    }
    let _ = window.set_content_protected(settings.hide_from_capture);
    super::sequence::stop();
    let foreground = win32::window::foreground_window();
    let own = window.hwnd().map(|hwnd| hwnd.0 as isize).unwrap_or_default();
    if let Ok(mut target) = TARGET_WINDOW.lock() {
        *target = (!foreground.is_invalid() && foreground.0 as isize != own).then_some(foreground.0 as isize);
    }

    let pinned_at = settings
        .popup_pinned
        .then_some((settings.popup_pin_x, settings.popup_pin_y))
        .and_then(|(x, y)| Some((x?, y?)))
        .filter(|(x, y)| app.monitor_from_point(f64::from(*x) + 24.0, f64::from(*y) + 24.0).ok().flatten().is_some());
    let pointer = win32::window::cursor_position().map(|point| (point.x, point.y));
    let monitor = match pointer {
        Some((x, y)) => app.monitor_from_point(f64::from(x), f64::from(y)).ok().flatten(),
        None => None,
    }
    .or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let work = monitor.work_area();
        let area = (
            work.position.x,
            work.position.y,
            work.position.x + work.size.width as i32,
            work.position.y + work.size.height as i32,
        );
        let scale = monitor.scale_factor();
        let (width, height) = popup_size(layout);
        let size = ((width * scale).round() as i32, (height * scale).round() as i32);
        let _ = window.set_size(Size::Physical(PhysicalSize::new(size.0 as u32, size.1 as u32)));
        let (x, y) = match (position, pointer) {
            _ if pinned_at.is_some() => pinned_at.unwrap_or_default(),
            (PopupPosition::Cursor, Some(pointer)) => place_by_pointer(pointer, size, area, (f64::from(POINTER_GAP) * scale) as i32),
            _ => (area.0 + (area.2 - area.0 - size.0) / 2, area.1 + (area.3 - area.1 - size.1) / 3),
        };
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
    }
    let _ = window.emit_to(WINDOW_LABEL, OPENED_EVENT, ());
    let _ = window.emit_to(crate::onboarding_window::WINDOW_LABEL, OPENED_EVENT, ());
    window.show().map_err(|error| error.to_string())?;
    let _ = window.set_focus();
    if let Ok(hwnd) = window.hwnd() {
        let _ = win32::window::activate_from_background(hwnd);
    }
    Ok(())
}

pub(super) fn hide(app: &AppHandle) -> Result<(), String> {
    popup_window(app)?.hide().map_err(|error| error.to_string())
}

pub(super) fn refocus(app: &AppHandle) -> Result<(), String> {
    let window = popup_window(app)?;
    if !window.is_visible().unwrap_or(false) {
        return Ok(());
    }
    window.set_focus().map_err(|error| error.to_string())
}

pub(super) fn outer_position(app: &AppHandle) -> Option<(i32, i32)> {
    let position = popup_window(app).ok()?.outer_position().ok()?;
    Some((position.x, position.y))
}

pub(super) fn note_target(app: &AppHandle) {
    let own = popup_window(app).ok().and_then(|window| window.hwnd().ok()).map(|hwnd| hwnd.0 as isize).unwrap_or_default();
    let foreground = win32::window::foreground_window();
    if foreground.is_invalid() || foreground.0 as isize == own {
        return;
    }
    if let Ok(mut target) = TARGET_WINDOW.lock() {
        *target = Some(foreground.0 as isize);
    }
}

fn peek_target() -> Option<HWND> {
    TARGET_WINDOW
        .lock()
        .ok()
        .and_then(|target| *target)
        .map(|value| HWND(value as *mut core::ffi::c_void))
}

fn target_for_paste(pinned: bool) -> Option<HWND> {
    if pinned {
        peek_target()
    } else {
        take_target()
    }
}

fn take_target() -> Option<HWND> {
    TARGET_WINDOW
        .lock()
        .ok()
        .and_then(|mut target| target.take())
        .map(|value| HWND(value as *mut core::ffi::c_void))
}

pub(super) fn paste(app: &AppHandle, id: &str, options: PasteOptions) -> Result<(), String> {
    let service = service()?;
    let snapshot = service.snapshot()?;
    let settings = &snapshot.settings;
    let item = snapshot.items.iter().find(|item| item.id == id);
    let is_image = item.is_some_and(|item| matches!(item.kind, ClipboardHistoryItemKind::Image | ClipboardHistoryItemKind::Files));
    let target = target_for_paste(settings.popup_pinned);
    let into_terminal = target.is_some_and(|window| {
        win32::process::image_path(win32::process::window_process_id(window)).is_some_and(|path| is_terminal_process(&path))
    });
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
    paste_into(target, settings.auto_paste, options.enter);
    Ok(())
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

fn paste_into(target: Option<HWND>, auto_paste: bool, enter: bool) {
    let (Some(target), true) = (target, auto_paste) else {
        return;
    };
    let target = target.0 as isize;
    thread::spawn(move || {
        if win32::window::force_foreground(HWND(target as *mut core::ffi::c_void)) {
            thread::sleep(FOCUS_SETTLE);
            win32::input::send_paste_shortcut();
            if enter {
                thread::sleep(FOCUS_SETTLE);
                win32::input::send_enter();
            }
        }
    });
}
