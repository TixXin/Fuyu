use std::{
    sync::{Mutex, PoisonError},
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use super::output::{self, Picture};
use super::session::{self, WINDOW_PREFIX};
use super::stitch::{Step, Stitcher};
use crate::win32;

const TICK: Duration = Duration::from_millis(45);
const START_DELAY: Duration = Duration::from_millis(180);
const WHEEL_SETTLE: Duration = Duration::from_millis(30);
const SCROLL_WAIT: Duration = Duration::from_millis(320);
const NOTCH: i32 = 120;
const START_NOTCHES: i32 = 3;
const MAX_NOTCHES: i32 = 8;
const STILL_LIMIT: u32 = 2;
pub(super) const MAX_HEIGHT: u32 = 20_000;
const PREVIEW_WIDTH: u32 = 120;
const PREVIEW_HEIGHT: u32 = 360;
pub(super) const STARTED_EVENT: &str = "screenshot-long";
const PROGRESS_EVENT: &str = "screenshot-long-progress";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum LongState {
    Scrolling,
    Paused,
    End,
    Fast,
    Full,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    state: LongState,
    height: u32,
    frames: u32,
    preview: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Ending {
    Copy,
    Save { folder: Option<String>, name: String },
    Cancel,
}

struct Control {
    owner: String,
    paused: bool,
    ending: Option<Ending>,
    bar: Option<(f64, f64, f64, f64)>,
}

static CONTROL: Mutex<Option<Control>> = Mutex::new(None);

fn control() -> std::sync::MutexGuard<'static, Option<Control>> {
    CONTROL.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn set_bar(label: &str, rect: (f64, f64, f64, f64)) {
    if let Some(control) = control().as_mut().filter(|control| control.owner == label) {
        control.bar = Some(rect);
    }
}

pub(super) fn set_paused(paused: Option<bool>) -> Option<bool> {
    let mut guard = control();
    let control = guard.as_mut()?;
    control.paused = paused.unwrap_or(!control.paused);
    Some(control.paused)
}

pub(super) fn end_with(ending: Ending) -> bool {
    match control().as_mut() {
        Some(control) => {
            control.ending.get_or_insert(ending);
            true
        }
        None => false,
    }
}

fn paused() -> bool {
    control().as_ref().is_some_and(|control| control.paused)
}

fn pause_by_itself() {
    if let Some(control) = control().as_mut() {
        control.paused = true;
    }
}

fn take_ending() -> Option<Ending> {
    control().as_mut().and_then(|control| control.ending.take())
}

pub(crate) fn contains(rect: (f64, f64, f64, f64), point: (f64, f64)) -> bool {
    point.0 >= rect.0 && point.0 <= rect.0 + rect.2 && point.1 >= rect.1 && point.1 <= rect.1 + rect.3
}

pub(crate) fn next_notches(notches: i32, shift: u32, band: u32) -> i32 {
    if shift.saturating_mul(3) < band { (notches + 1).min(MAX_NOTCHES) } else { notches }
}

fn on_bar(origin: (i32, i32), scale: f64) -> bool {
    let Some(bar) = control().as_ref().and_then(|control| control.bar) else {
        return false;
    };
    win32::window::cursor_position().is_some_and(|point| {
        let x = (f64::from(point.x) - f64::from(origin.0)) / scale;
        let y = (f64::from(point.y) - f64::from(origin.1)) / scale;
        contains(bar, (x, y))
    })
}

fn scroll(centre: (i32, i32), delta: i32) {
    let back = win32::window::cursor_position().map(|point| (point.x, point.y));
    win32::input::move_cursor(centre.0, centre.1);
    win32::input::send_wheel(delta);
    thread::sleep(WHEEL_SETTLE);
    if let Some((x, y)) = back {
        win32::input::move_cursor(x, y);
    }
}

fn preview(stitcher: &Stitcher) -> Option<String> {
    use base64::Engine;
    let (width, height, rgba) = stitcher.tail_preview(PREVIEW_WIDTH, PREVIEW_HEIGHT);
    let png = output::encode_png(&Picture { width, height, rgba }).ok()?;
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
}

fn overlays(app: &AppHandle) -> Vec<WebviewWindow> {
    app.webview_windows().into_iter().filter(|(name, _)| name.starts_with(WINDOW_PREFIX)).map(|(_, window)| window).collect()
}

fn hold_overlays(windows: &[WebviewWindow], on: bool) {
    for window in windows {
        if let Ok(hwnd) = window.hwnd() {
            win32::window::exclude_from_capture(hwnd, on);
        }
        let _ = window.set_ignore_cursor_events(on);
    }
}

pub(super) fn start<F>(app: &AppHandle, owner: String, area: (i32, i32, u32, u32), deliver: F)
where
    F: FnOnce(&AppHandle, Ending, Picture) + Send + 'static,
{
    let Some(id) = session::id() else { return };
    let mut guard = control();
    if guard.is_some() {
        return;
    }
    *guard = Some(Control { owner: owner.clone(), paused: false, ending: None, bar: None });
    drop(guard);
    let app = app.clone();
    let _ = app.emit(STARTED_EVENT, owner.clone());
    thread::spawn(move || {
        let windows = overlays(&app);
        hold_overlays(&windows, true);
        let owner_window = windows.iter().find(|window| window.label() == owner).cloned();
        let scale = owner_window.as_ref().and_then(|window| window.scale_factor().ok()).unwrap_or(1.0);
        let origin = session::origin(&owner).unwrap_or((area.0, area.1));
        let (ending, picture) = run(&app, &owner, owner_window.as_ref(), id, area, origin, scale);
        hold_overlays(&windows, false);
        *control() = None;
        deliver(&app, ending, picture);
    });
}

fn run(app: &AppHandle, owner: &str, owner_window: Option<&WebviewWindow>, id: u64, area: (i32, i32, u32, u32), origin: (i32, i32), scale: f64) -> (Ending, Picture) {
    let (x, y, width, height) = area;
    let capture = || win32::screen_capture::capture(x, y, width, height);
    thread::sleep(START_DELAY);
    let Some(first) = capture() else {
        return (Ending::Cancel, Picture { width: 1, height: 1, rgba: vec![0; 4] });
    };
    let centre = (x + (width / 2) as i32, y + (height / 2) as i32);
    let mut stitcher = Stitcher::new(width, height, first.clone());
    let mut previous = first.clone();
    let mut tried = first;
    let mut notches = START_NOTCHES;
    let mut wheeled: Option<Instant> = None;
    let mut still = 0;
    let mut frames = 1;
    let mut state = LongState::Scrolling;
    let mut was_paused = false;
    let mut ignoring = true;
    let emit = |state: LongState, frames: u32, stitcher: &Stitcher, with_preview: bool| {
        let progress = Progress { state, height: stitcher.height(), frames, preview: if with_preview { preview(stitcher) } else { None } };
        let _ = app.emit_to(owner, PROGRESS_EVENT, progress);
    };
    emit(state, frames, &stitcher, true);

    let ending = loop {
        if session::id() != Some(id) || win32::input::is_escape_down() {
            break Ending::Cancel;
        }
        if let Some(ending) = take_ending() {
            break ending;
        }
        let hovering = on_bar(origin, scale);
        if let Some(window) = owner_window.filter(|_| hovering == ignoring) {
            if window.set_ignore_cursor_events(!hovering).is_ok() {
                ignoring = !hovering;
            }
        }
        let is_paused = paused();
        if is_paused != was_paused {
            was_paused = is_paused;
            if !is_paused {
                still = 0;
                wheeled = None;
            }
            state = if is_paused { if matches!(state, LongState::End | LongState::Full) { state } else { LongState::Paused } } else { LongState::Scrolling };
            emit(state, frames, &stitcher, false);
        }
        thread::sleep(TICK);
        let Some(frame) = capture() else { continue };
        let stable = frame == previous;
        previous = frame;
        if !stable {
            continue;
        }
        if previous != tried {
            tried = previous.clone();
            match stitcher.push(previous.clone()) {
                Step::Added(shift) => {
                    frames += 1;
                    still = 0;
                    if wheeled.take().is_some() {
                        notches = next_notches(notches, shift, stitcher.band());
                    }
                    state = if stitcher.height() >= MAX_HEIGHT {
                        pause_by_itself();
                        was_paused = true;
                        LongState::Full
                    } else if is_paused { LongState::Paused } else { LongState::Scrolling };
                    emit(state, frames, &stitcher, true);
                }
                Step::Lost => {
                    state = LongState::Fast;
                    if wheeled.take().is_some() {
                        scroll(centre, notches * NOTCH / 2);
                        notches = (notches / 2).max(1);
                    }
                    emit(state, frames, &stitcher, false);
                }
                Step::Unchanged => {}
            }
            continue;
        }
        if is_paused || matches!(state, LongState::Full) {
            continue;
        }
        match wheeled {
            None => {
                scroll(centre, -notches * NOTCH);
                wheeled = Some(Instant::now());
            }
            Some(at) if at.elapsed() >= SCROLL_WAIT => {
                wheeled = None;
                still += 1;
                if still >= STILL_LIMIT {
                    pause_by_itself();
                    was_paused = true;
                    state = LongState::End;
                    emit(state, frames, &stitcher, false);
                }
            }
            Some(_) => {}
        }
    };
    let (width, height, mut rgba) = stitcher.finish();
    let height = height.min(MAX_HEIGHT);
    rgba.truncate(width as usize * height as usize * 4);
    (ending, Picture { width, height, rgba })
}
