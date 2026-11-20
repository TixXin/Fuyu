use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, PoisonError,
    },
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::{HWND, RECT};

use super::{
    layout::{self, BarEdge, Rect},
    snapshot::{self, Bar},
};
use crate::win32::{notification_state, taskbar_shell, window};

pub(crate) const DOCK_CHANGED_EVENT: &str = "taskbar-dock-changed";
const TICK: Duration = Duration::from_millis(500);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DockStatus {
    Shown,
    BarHidden,
    Fullscreen,
    NoRoom,
    NoTaskbar,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockState {
    status: DockStatus,
    rect: Option<Rect>,
    edge: Option<BarEdge>,
}

struct Docked {
    window: WebviewWindow,
    width: f64,
    order: u8,
    monitor: Option<Rect>,
    saved_flags: (bool, bool),
    last: Option<DockState>,
}

static DOCKED: Mutex<Vec<Docked>> = Mutex::new(Vec::new());
static RUNNING: AtomicBool = AtomicBool::new(false);

pub(crate) fn margin(bar: Rect, edge: BarEdge) -> i32 {
    let thickness = if edge.horizontal() { bar.bottom - bar.top } else { bar.right - bar.left };
    (thickness / 6).max(4)
}

fn handle(window: &WebviewWindow) -> Option<HWND> {
    window.hwnd().ok().filter(|handle| !handle.is_invalid())
}

fn monitor_of(window: &WebviewWindow, bars: &[Bar]) -> Option<Rect> {
    let rect = window::window_rect(handle(window)?)?;
    let (x, y) = ((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    bars.iter().find(|bar| bar.monitor.contains(x, y)).map(|bar| bar.monitor)
}

pub(crate) fn dock(window: WebviewWindow, width: f64, order: u8) -> Result<(), String> {
    let hwnd = handle(&window).ok_or_else(|| "The window has no native handle.".to_string())?;
    let monitor = monitor_of(&window, &snapshot::read());
    {
        let mut docked = DOCKED.lock().unwrap_or_else(PoisonError::into_inner);
        let label = window.label().to_string();
        let saved_flags = match docked.iter().position(|item| item.window.label() == label) {
            Some(index) => docked.remove(index).saved_flags,
            None => taskbar_shell::extended_style_flags(hwnd),
        };
        taskbar_shell::set_extended_style_flags(hwnd, true, true);
        docked.push(Docked { window, width: width.max(1.0), order, monitor, saved_flags, last: None });
        docked.sort_by_key(|item| item.order);
    }
    tick();
    if !RUNNING.swap(true, Ordering::SeqCst) {
        thread::spawn(run);
    }
    Ok(())
}

pub(crate) fn undock(window: &WebviewWindow) {
    let removed = {
        let mut docked = DOCKED.lock().unwrap_or_else(PoisonError::into_inner);
        docked
            .iter()
            .position(|item| item.window.label() == window.label())
            .map(|index| docked.remove(index))
    };
    if let (Some(item), Some(hwnd)) = (removed, handle(window)) {
        taskbar_shell::set_owner(hwnd, None);
        taskbar_shell::set_extended_style_flags(hwnd, item.saved_flags.0, item.saved_flags.1);
    }
}

fn run() {
    loop {
        thread::sleep(TICK);
        if is_empty() {
            RUNNING.store(false, Ordering::SeqCst);
            if is_empty() || RUNNING.swap(true, Ordering::SeqCst) {
                return;
            }
        }
        tick();
    }
}

fn is_empty() -> bool {
    DOCKED.lock().unwrap_or_else(PoisonError::into_inner).is_empty()
}

fn bar_index(bars: &[Bar], monitor: Option<Rect>) -> Option<usize> {
    monitor
        .and_then(|monitor| bars.iter().position(|bar| bar.monitor == monitor))
        .or_else(|| bars.iter().position(|bar| bar.primary))
        .or_else(|| (!bars.is_empty()).then_some(0))
}

fn tick() {
    let bars = snapshot::read();
    let fullscreen = notification_state::fullscreen_app_in_front();
    let mut docked = DOCKED.lock().unwrap_or_else(PoisonError::into_inner);
    let targets: Vec<Option<usize>> = docked.iter().map(|item| bar_index(&bars, item.monitor)).collect();
    let mut states: Vec<DockState> = vec![DockState { status: DockStatus::NoTaskbar, rect: None, edge: None }; docked.len()];
    for (bar_index, bar) in bars.iter().enumerate() {
        let members: Vec<usize> = (0..docked.len()).filter(|index| targets[*index] == Some(bar_index)).collect();
        if members.is_empty() {
            continue;
        }
        let sizes: Vec<i32> = members
            .iter()
            .map(|index| {
                let scale = docked[*index].window.scale_factor().unwrap_or(1.0);
                (docked[*index].width * scale).round() as i32
            })
            .collect();
        let gap = margin(bar.rect, bar.edge);
        let spans = layout::arrange(&bar.free(gap), bar.tray_start(), &sizes, gap);
        for (slot, index) in members.iter().enumerate() {
            let rect = spans[slot].map(|span| layout::place(bar.rect, bar.edge.horizontal(), span));
            let status = match rect {
                _ if bar.hidden => DockStatus::BarHidden,
                _ if fullscreen => DockStatus::Fullscreen,
                Some(_) => DockStatus::Shown,
                None => DockStatus::NoRoom,
            };
            states[*index] = DockState { status, rect, edge: Some(bar.edge) };
        }
    }
    for (index, item) in docked.iter_mut().enumerate() {
        apply(item, targets[index].map(|bar| bars[bar].handle), states[index]);
    }
}

fn apply(item: &mut Docked, taskbar: Option<HWND>, state: DockState) {
    let Some(hwnd) = handle(&item.window) else {
        return;
    };
    if let Some(taskbar) = taskbar {
        if taskbar_shell::owner(hwnd) != Some(taskbar) {
            taskbar_shell::set_owner(hwnd, Some(taskbar));
        }
    }
    if let (DockStatus::Shown, Some(rect)) = (state.status, state.rect) {
        let target = RECT { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        if window::window_rect(hwnd).is_none_or(|current| current != target) {
            taskbar_shell::move_to(hwnd, target);
        }
    }
    if item.last != Some(state) {
        item.last = Some(state);
        let _ = item.window.emit_to(item.window.label(), DOCK_CHANGED_EVENT, state);
    }
}
