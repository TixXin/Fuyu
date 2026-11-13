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

fn monitor_at(app: &AppHandle, (x, y): (i32, i32)) -> Option<Monitor> {
    app.available_monitors().ok()?.into_iter().find(|monitor| {
        let origin = screen::monitor_origin(monitor);
        let size = screen::monitor_size(monitor);
        x >= origin.x && x < origin.x + size.width as i32 && y >= origin.y && y < origin.y + size.height as i32
    })
}

pub(super) fn toggle(app: &AppHandle, settings: &ClipboardHistorySettings) -> Result<(), String> {
    let window = popup_window(app)?;
    if window.is_visible().unwrap_or(false) {
        return hide(app);
    }
    let _ = window.set_content_protected(settings.hide_from_capture);
    super::sequence::stop();
    let own = i32::try_from(std::process::id()).ok();
    *TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner) = apps::frontmost_pid().filter(|pid| Some(*pid) != own);

    let (width, height) = popup_size(settings.popup_layout);
    let _ = window.set_size(Size::Logical(LogicalSize::new(width, height)));
    let pointer = screen::cursor_position().map(|(x, y)| (x.round() as i32, y.round() as i32));
    let monitor = pointer.and_then(|point| monitor_at(app, point)).or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
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
    let _ = window.set_focus();
    Ok(())
}

pub(super) fn hide(app: &AppHandle) -> Result<(), String> {
    popup_window(app)?.hide().map_err(|error| error.to_string())
}

fn take_target() -> Option<i32> {
    TARGET_APP.lock().unwrap_or_else(PoisonError::into_inner).take()
}

pub(super) fn paste(app: &AppHandle, id: &str, options: PasteOptions) -> Result<(), String> {
    let service = service()?;
    let snapshot = service.snapshot()?;
    let settings = &snapshot.settings;
    let item = snapshot.items.iter().find(|item| item.id == id);
    let is_image = item.is_some_and(|item| matches!(item.kind, ClipboardHistoryItemKind::Image | ClipboardHistoryItemKind::Files));
    let target = take_target();
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
    hide(app)?;
    paste_into(target, settings.auto_paste, options.enter);
    Ok(())
}

pub(super) fn paste_text(app: &AppHandle, text: &str, enter: bool) -> Result<(), String> {
    let auto_paste = service()?.snapshot()?.settings.auto_paste;
    super::suspend_clipboard_capture(Duration::from_millis(800));
    super::clipboard_io::write_clipboard_text(text)?;
    hide(app)?;
    paste_into(take_target(), auto_paste, enter);
    Ok(())
}

fn paste_into(target: Option<i32>, auto_paste: bool, enter: bool) {
    let (Some(target), true) = (target, auto_paste) else {
        return;
    };
    thread::spawn(move || {
        if !input::can_post_keys() {
            input::ask_to_post_keys();
            return;
        }
        if apps::activate(target) {
            thread::sleep(FOCUS_SETTLE);
            input::send_paste_shortcut();
            if enter {
                thread::sleep(FOCUS_SETTLE);
                input::send_enter();
            }
        }
    });
}
