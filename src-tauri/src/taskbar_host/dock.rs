use std::{
    sync::{Arc, Condvar, Mutex, PoisonError},
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
    pub(crate) status: DockStatus,
    pub(crate) rect: Option<Rect>,
    pub(crate) edge: Option<BarEdge>,
    pub(crate) light: bool,
}

type OnChange = Arc<dyn Fn() + Send + Sync>;

enum Kind {
    Window { width: f64, saved_flags: (bool, bool) },
    Reserved { width: i32, on_change: OnChange },
}

struct Docked {
    window: WebviewWindow,
    label: String,
    hwnd: isize,
    kind: Kind,
    order: u8,
    monitor: Option<Rect>,
    last: Option<DockState>,
    raised: bool,
}

enum Changed {
    Emit(Box<(WebviewWindow, String, DockState)>),
    Call(OnChange),
}

#[derive(Default)]
struct Shared {
    docked: Vec<Docked>,
    running: bool,
    wake: bool,
}

static SHARED: Mutex<Shared> = Mutex::new(Shared { docked: Vec::new(), running: false, wake: false });
static WAKE: Condvar = Condvar::new();

fn shared() -> std::sync::MutexGuard<'static, Shared> {
    SHARED.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn margin(bar: Rect, edge: BarEdge) -> i32 {
    let thickness = if edge.horizontal() { bar.bottom - bar.top } else { bar.right - bar.left };
    (thickness / 6).max(4)
}

fn handle(window: &WebviewWindow) -> Option<HWND> {
    window.hwnd().ok().filter(|handle| !handle.is_invalid())
}

fn monitor_of(hwnd: HWND, bars: &[Bar]) -> Option<Rect> {
    let rect = window::window_rect(hwnd)?;
    let (x, y) = ((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
    bars.iter().find(|bar| bar.monitor.contains(x, y)).map(|bar| bar.monitor)
}

fn take(docked: &mut Vec<Docked>, label: &str) -> Option<Docked> {
    docked.iter().position(|item| item.label == label).map(|index| docked.remove(index))
}

fn insert(window: WebviewWindow, hwnd: HWND, kind: Kind, order: u8, monitor: Option<Rect>) {
    let label = window.label().to_string();
    let mut shared = shared();
    let _ = take(&mut shared.docked, &label);
    shared.docked.push(Docked { window, label, hwnd: hwnd.0 as isize, kind, order, monitor, last: None, raised: false });
    shared.docked.sort_by_key(|item| item.order);
    shared.wake = true;
    if !shared.running {
        shared.running = true;
        thread::spawn(run);
    }
    WAKE.notify_all();
}

pub(crate) fn dock(window: WebviewWindow, width: f64, order: u8) -> Result<(), String> {
    let hwnd = handle(&window).ok_or_else(|| "The window has no native handle.".to_string())?;
    let monitor = monitor_of(hwnd, &snapshot::read());
    let previous = take(&mut shared().docked, window.label()).map(|item| item.kind);
    let saved_flags = match previous {
        Some(Kind::Window { saved_flags, .. }) => saved_flags,
        _ => taskbar_shell::extended_style_flags(hwnd),
    };
    taskbar_shell::set_extended_style_flags(hwnd, true, true);
    insert(window, hwnd, Kind::Window { width: width.max(1.0), saved_flags }, order, monitor);
    Ok(())
}

pub(crate) fn reserve(window: WebviewWindow, monitor: Option<Rect>, width: i32, order: u8, on_change: OnChange) {
    if let Some(hwnd) = handle(&window) {
        insert(window, hwnd, Kind::Reserved { width: width.max(1), on_change }, order, monitor);
    }
}

pub(crate) fn resize_reserved(window: &WebviewWindow, width: i32) {
    let mut shared = shared();
    let found = shared.docked.iter_mut().find(|item| item.label == window.label());
    if let Some(Kind::Reserved { width: reserved, .. }) = found.map(|item| &mut item.kind) {
        if *reserved != width.max(1) {
            *reserved = width.max(1);
            shared.wake = true;
            WAKE.notify_all();
        }
    }
}

pub(crate) fn set_raised(window: &WebviewWindow, raised: bool) {
    let hwnd = {
        let mut shared = shared();
        let Some(item) = shared.docked.iter_mut().find(|item| item.label == window.label()) else {
            return;
        };
        item.raised = raised;
        HWND(item.hwnd as *mut _)
    };
    if raised {
        taskbar_shell::raise(hwnd);
    }
}

pub(crate) fn current(window: &WebviewWindow) -> Option<DockState> {
    shared().docked.iter().find(|item| item.label == window.label()).and_then(|item| item.last)
}

pub(crate) fn undock(window: &WebviewWindow) {
    let removed = take(&mut shared().docked, window.label());
    if let Some(item) = removed {
        let hwnd = HWND(item.hwnd as *mut _);
        taskbar_shell::set_owner(hwnd, None);
        if let Kind::Window { saved_flags, .. } = item.kind {
            taskbar_shell::set_extended_style_flags(hwnd, saved_flags.0, saved_flags.1);
        }
    }
}

fn run() {
    loop {
        {
            let mut shared = shared();
            if !shared.wake {
                shared = WAKE.wait_timeout(shared, TICK).unwrap_or_else(PoisonError::into_inner).0;
            }
            shared.wake = false;
            if shared.docked.is_empty() {
                shared.running = false;
                return;
            }
        }
        tick();
    }
}

fn bar_index(bars: &[Bar], monitor: Option<Rect>) -> Option<usize> {
    monitor
        .and_then(|monitor| bars.iter().position(|bar| bar.monitor == monitor))
        .or_else(|| bars.iter().position(|bar| bar.primary))
        .or_else(|| (!bars.is_empty()).then_some(0))
}

fn width_of(item: &Docked) -> i32 {
    match &item.kind {
        Kind::Window { width, .. } => (width * taskbar_shell::dpi_scale(HWND(item.hwnd as *mut _))).round() as i32,
        Kind::Reserved { width, .. } => *width,
    }
}

fn tick() {
    let bars = snapshot::read();
    let fullscreen = notification_state::fullscreen_app_in_front();
    let light = taskbar_shell::uses_light_theme();
    let mut shared = shared();
    let docked = &mut shared.docked;
    let targets: Vec<Option<usize>> = docked.iter().map(|item| bar_index(&bars, item.monitor)).collect();
    let mut states: Vec<DockState> = vec![DockState { status: DockStatus::NoTaskbar, rect: None, edge: None, light }; docked.len()];
    for (bar_index, bar) in bars.iter().enumerate() {
        let members: Vec<usize> = (0..docked.len()).filter(|index| targets[*index] == Some(bar_index)).collect();
        if members.is_empty() {
            continue;
        }
        let sizes: Vec<i32> = members.iter().map(|index| width_of(&docked[*index])).collect();
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
            states[*index] = DockState { status, rect, edge: Some(bar.edge), light };
        }
    }
    let changed: Vec<Changed> = docked
        .iter_mut()
        .enumerate()
        .filter_map(|(index, item)| apply(item, targets[index].map(|bar| bars[bar].handle), states[index]))
        .collect();
    let raised: Vec<isize> = shared.docked.iter().filter(|item| item.raised).map(|item| item.hwnd).collect();
    drop(shared);
    raised.into_iter().for_each(|hwnd| taskbar_shell::raise(HWND(hwnd as *mut _)));
    for change in changed {
        match change {
            Changed::Emit(emit) => {
                let (window, label, state) = *emit;
                let _ = window.emit_to(label.as_str(), DOCK_CHANGED_EVENT, state);
            }
            Changed::Call(on_change) => on_change(),
        }
    }
}

fn apply(item: &mut Docked, taskbar: Option<HWND>, state: DockState) -> Option<Changed> {
    let hwnd = HWND(item.hwnd as *mut _);
    if let Some(taskbar) = taskbar {
        if taskbar_shell::owner(hwnd) != Some(taskbar) {
            taskbar_shell::set_owner(hwnd, Some(taskbar));
        }
    }
    let changed = item.last.replace(state) != Some(state);
    if let Kind::Reserved { on_change, .. } = &item.kind {
        return changed.then(|| Changed::Call(on_change.clone()));
    }
    if let (DockStatus::Shown, Some(rect)) = (state.status, state.rect) {
        let target = RECT { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        if window::window_rect(hwnd).is_none_or(|current| current != target) {
            taskbar_shell::move_to(hwnd, target);
        }
    }
    changed.then(|| Changed::Emit(Box::new((item.window.clone(), item.label.clone(), state))))
}
