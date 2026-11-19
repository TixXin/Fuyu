use serde::Serialize;
use std::{
    sync::{Condvar, Mutex, MutexGuard, OnceLock, PoisonError},
    thread,
    time::{Duration, Instant},
};
use tauri::ipc::{Channel, InvokeResponseBody};
use windows::Win32::{Foundation::HWND, Graphics::Dxgi::DXGI_ERROR_ACCESS_LOST};

use super::state::{read_window_state, IslandMode, IslandWindowState};
use crate::win32::desktop_duplication::{
    contains, exclude_from_duplication, is_remote_session, Duplication, Frame, OpenError, Readback, ScreenRect,
};

const FAST_INTERVAL: Duration = Duration::from_millis(33);
const SLOW_INTERVAL: Duration = Duration::from_millis(200);
const FAST_WAIT_MS: u32 = 50;
const SLOW_WAIT_MS: u32 = 200;
const MOVE_GRACE: Duration = Duration::from_millis(800);
const RETRY: Duration = Duration::from_millis(1000);
const GIVE_UP_AFTER: u32 = 5;
pub(crate) const HEADER: usize = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CaptureFailure {
    Unsupported,
    NoD3d,
    Remote,
    Failed,
}

impl CaptureFailure {
    pub(crate) fn code(self) -> u8 {
        match self {
            Self::Unsupported => 1,
            Self::NoD3d => 2,
            Self::Remote => 3,
            Self::Failed => 4,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlassCaptureStart {
    started: bool,
    reason: Option<CaptureFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct BlurOptions {
    pub(crate) blur: f32,
    pub(crate) scale: f32,
    pub(crate) saturation: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Plan {
    Off,
    Paused,
    Run { fast: bool },
}

pub(crate) fn plan(state: &IslandWindowState) -> Plan {
    if !state.glass_enabled || !state.glass_native {
        return Plan::Off;
    }
    let notch_collapsed = matches!(state.mode, IslandMode::Collapsed) && state.notch.is_some();
    if state.is_tucked || state.is_dimmed || state.game_passthrough || notch_collapsed {
        return Plan::Paused;
    }
    Plan::Run { fast: matches!(state.mode, IslandMode::Expanded) || state.is_dragging }
}

struct Control {
    channel: Option<Channel<InvokeResponseBody>>,
    window: isize,
    options: BlurOptions,
}

static CONTROL: Mutex<Control> = Mutex::new(Control {
    channel: None,
    window: 0,
    options: BlurOptions { blur: 24.0, scale: 1.0, saturation: 180.0 },
});
static WAKE: Condvar = Condvar::new();
static THREAD: OnceLock<()> = OnceLock::new();

fn control() -> MutexGuard<'static, Control> {
    CONTROL.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(super) fn wake() {
    WAKE.notify_all();
}

pub(super) fn start(window: HWND, channel: Channel<InvokeResponseBody>, scale: f32) -> GlassCaptureStart {
    if is_remote_session() {
        return GlassCaptureStart { started: false, reason: Some(CaptureFailure::Remote) };
    }
    if !exclude_from_duplication(window, true) {
        return GlassCaptureStart { started: false, reason: Some(CaptureFailure::Unsupported) };
    }
    {
        let mut control = control();
        control.channel = Some(channel);
        control.window = window.0 as isize;
        control.options.scale = scale;
    }
    THREAD.get_or_init(|| {
        if let Err(error) = thread::Builder::new().name("glass-capture".into()).spawn(run) {
            eprintln!("glass capture thread could not start: {error}");
        }
    });
    wake();
    GlassCaptureStart { started: true, reason: None }
}

pub(super) fn set_options(blur: f32, saturation: f32, scale: Option<f32>) {
    let mut control = control();
    control.options.blur = blur.clamp(0.0, 200.0);
    control.options.saturation = saturation.clamp(0.0, 400.0);
    if let Some(scale) = scale.filter(|scale| *scale > 0.0) {
        control.options.scale = scale;
    }
    drop(control);
    wake();
}

pub(super) fn stop(fallback: Option<HWND>) {
    let window = {
        let mut control = control();
        control.channel = None;
        std::mem::take(&mut control.window)
    };
    wake();
    if window != 0 {
        exclude_from_duplication(HWND(window as *mut _), false);
    } else if let Some(window) = fallback {
        exclude_from_duplication(window, false);
    }
}

struct Job {
    channel: Channel<InvokeResponseBody>,
    window: HWND,
    options: BlurOptions,
}

fn wait_for_job(session: &mut Session) -> Job {
    let mut control = control();
    loop {
        if let Some(channel) = control.channel.clone().filter(|_| control.window != 0) {
            return Job { channel, window: HWND(control.window as *mut _), options: control.options };
        }
        session.release();
        control = WAKE.wait(control).unwrap_or_else(PoisonError::into_inner);
    }
}

fn pause(duration: Duration) {
    let control = control();
    drop(WAKE.wait_timeout(control, duration).unwrap_or_else(PoisonError::into_inner));
}

#[derive(Default)]
struct Session {
    duplication: Option<Duplication>,
    sent: Option<(ScreenRect, BlurOptions)>,
    pending: bool,
    last_send: Option<Instant>,
    last_window: Option<ScreenRect>,
    moved_at: Option<Instant>,
    failures: u32,
    reported: bool,
}

impl Session {
    fn release(&mut self) {
        self.duplication = None;
        self.sent = None;
    }

    fn fail(&mut self, channel: &Channel<InvokeResponseBody>, failure: CaptureFailure) {
        self.release();
        self.failures = self.failures.saturating_add(1);
        if self.failures >= GIVE_UP_AFTER && !self.reported {
            self.reported = channel.send(InvokeResponseBody::Raw(vec![failure.code()])).is_ok();
        }
    }
}

fn island_hidden(window: HWND) -> bool {
    !crate::win32::window::is_visible(window) || crate::system::fullscreen::get_foreground_fullscreen().covers_island()
}

fn run() {
    let mut session = Session::default();
    loop {
        let job = wait_for_job(&mut session);
        let Plan::Run { fast } = plan(&read_window_state()) else {
            session.release();
            pause(RETRY);
            continue;
        };
        let rect = crate::win32::window::window_rect(job.window).map(|rect| (rect.left, rect.top, rect.right, rect.bottom));
        let Some(region) = rect.filter(|_| !island_hidden(job.window)) else {
            session.release();
            pause(RETRY);
            continue;
        };
        if session.last_window != Some(region) {
            session.last_window = Some(region);
            session.moved_at = Some(Instant::now());
        }
        let fast = fast || session.moved_at.is_some_and(|at| at.elapsed() < MOVE_GRACE);
        step(&mut session, &job, region, fast);
    }
}

fn step(session: &mut Session, job: &Job, region: ScreenRect, fast: bool) {
    let centre = ((region.0 + region.2) / 2, (region.1 + region.3) / 2);
    if !session.duplication.as_ref().is_some_and(|current| contains(current.monitor, centre)) {
        match Duplication::open(centre) {
            Ok(opened) => {
                session.duplication = Some(opened);
                session.sent = None;
            }
            Err(OpenError::SecureDesktop) => {
                session.release();
                pause(RETRY);
                return;
            }
            Err(error) => {
                eprintln!("glass capture: duplication unavailable ({error})");
                let failure = if matches!(error, OpenError::NoDevice) { CaptureFailure::NoD3d } else { CaptureFailure::Failed };
                session.fail(&job.channel, failure);
                pause(RETRY);
                return;
            }
        }
    }
    let Some(current) = session.duplication.as_mut() else {
        return;
    };
    match current.next_frame(if fast { FAST_WAIT_MS } else { SLOW_WAIT_MS }, region) {
        Ok(Frame::New { touches: true }) => session.pending = true,
        Ok(_) => {}
        Err(error) if error.code() == DXGI_ERROR_ACCESS_LOST => {
            session.release();
            pause(RETRY);
            return;
        }
        Err(error) => {
            eprintln!("glass capture: duplication ended ({error})");
            session.fail(&job.channel, CaptureFailure::Failed);
            pause(RETRY);
            return;
        }
    }
    if session.sent != Some((region, job.options)) {
        session.pending = true;
    }
    let interval = if fast { FAST_INTERVAL } else { SLOW_INTERVAL };
    if !session.pending || session.last_send.is_some_and(|at| at.elapsed() < interval) {
        return;
    }
    match current.read_region(region) {
        Ok(Some(readback)) => {
            let message = encode(readback, job.options, (region.0, region.1));
            if job.channel.send(InvokeResponseBody::Raw(message)).is_err() {
                let mut control = control();
                if control.channel.as_ref().is_some_and(|channel| channel.id() == job.channel.id()) {
                    control.channel = None;
                }
                drop(control);
                session.release();
                return;
            }
            session.sent = Some((region, job.options));
            session.pending = false;
            session.last_send = Some(Instant::now());
            session.failures = 0;
            session.reported = false;
        }
        Ok(None) => session.pending = false,
        Err(error) => {
            eprintln!("glass capture: read failed ({error})");
            session.fail(&job.channel, CaptureFailure::Failed);
            pause(RETRY);
        }
    }
}

pub(crate) fn blur_radius(options: BlurOptions, level: u32) -> usize {
    let sigma = options.blur.max(0.0) * options.scale.max(0.1) / (1u32 << level) as f32;
    (sigma - 0.5).round().max(0.0) as usize
}

pub(crate) fn encode(readback: Readback, options: BlurOptions, origin: (i32, i32)) -> Vec<u8> {
    let Readback { rect, width, height, level, mut bgra } = readback;
    box_blur(&mut bgra, width as usize, height as usize, blur_radius(options, level));
    let saturation = options.saturation / 100.0;
    let mut message = Vec::with_capacity(HEADER + bgra.len());
    for value in [rect.0 - origin.0, rect.1 - origin.1, rect.2 - origin.0, rect.3 - origin.1] {
        message.extend_from_slice(&value.to_le_bytes());
    }
    message.extend_from_slice(&width.to_le_bytes());
    message.extend_from_slice(&height.to_le_bytes());
    for pixel in bgra.as_chunks::<4>().0 {
        let (b, g, r) = (pixel[0] as f32, pixel[1] as f32, pixel[2] as f32);
        let grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let vivid = |channel: f32| (grey + (channel - grey) * saturation).round().clamp(0.0, 255.0) as u8;
        message.extend_from_slice(&[vivid(r), vivid(g), vivid(b), 255]);
    }
    message
}

pub(crate) fn box_blur(pixels: &mut [u8], width: usize, height: usize, radius: usize) {
    if radius == 0 || width == 0 || height == 0 {
        return;
    }
    let mut scratch = vec![0u8; pixels.len()];
    for _ in 0..3 {
        blur_lines(pixels, &mut scratch, width, height, radius, true);
        blur_lines(&scratch, pixels, width, height, radius, false);
    }
}

fn blur_lines(source: &[u8], target: &mut [u8], width: usize, height: usize, radius: usize, across: bool) {
    let (lines, length) = if across { (height, width) } else { (width, height) };
    let index = |line: usize, position: usize| {
        if across {
            (line * width + position) * 4
        } else {
            (position * width + line) * 4
        }
    };
    let span = (radius * 2 + 1) as u32;
    for line in 0..lines {
        let mut sums = [0u32; 3];
        for offset in 0..=radius * 2 {
            let at = index(line, offset.saturating_sub(radius).min(length - 1));
            for (channel, sum) in sums.iter_mut().enumerate() {
                *sum += source[at + channel] as u32;
            }
        }
        for position in 0..length {
            let at = index(line, position);
            for (channel, sum) in sums.iter().enumerate() {
                target[at + channel] = (sum / span) as u8;
            }
            target[at + 3] = 255;
            let leaving = index(line, position.saturating_sub(radius));
            let entering = index(line, (position + radius + 1).min(length - 1));
            for (channel, sum) in sums.iter_mut().enumerate() {
                *sum = *sum + source[entering + channel] as u32 - source[leaving + channel] as u32;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(blur: f32) -> BlurOptions {
        BlurOptions { blur, scale: 1.5, saturation: 100.0 }
    }

    #[test]
    fn a_blur_keeps_a_flat_picture_flat_and_spreads_an_edge() {
        let (width, height) = (16, 4);
        let mut flat = vec![80u8; width * height * 4];
        box_blur(&mut flat, width, height, 3);
        assert!(flat.as_chunks::<4>().0.iter().all(|pixel| pixel[..3] == [80, 80, 80]));

        let mut edge: Vec<u8> = (0..width * height)
            .flat_map(|index| if index % width < 8 { [0, 0, 0, 255] } else { [240, 240, 240, 255] })
            .collect();
        box_blur(&mut edge, width, height, 2);
        let row: Vec<u8> = edge.as_chunks::<4>().0.iter().take(width).map(|pixel| pixel[0]).collect();
        assert!(row[0] < 10 && row[15] > 230, "the far ends keep their colour: {row:?}");
        assert!(row[7] > 40 && row[8] < 200, "the edge is spread: {row:?}");
    }

    #[test]
    fn the_blur_matches_the_css_blur_at_the_read_back_size() {
        assert_eq!(blur_radius(options(0.0), 2), 0);
        assert_eq!(blur_radius(options(24.0), 2), 9);
        assert_eq!(blur_radius(options(24.0), 3), 4);
        assert_eq!(blur_radius(BlurOptions { scale: 1.0, ..options(60.0) }, 2), 15);
    }

    #[test]
    fn a_frame_carries_its_rectangle_from_the_window_its_size_and_opaque_rgba() {
        let readback = Readback { rect: (-10, 0, 30, 8), width: 2, height: 1, level: 2, bgra: vec![10, 20, 30, 0, 10, 20, 30, 0] };
        let message = encode(readback, options(0.0), (-20, 0));
        assert_eq!(message.len(), HEADER + 8);
        let int = |at: usize| i32::from_le_bytes([message[at], message[at + 1], message[at + 2], message[at + 3]]);
        assert_eq!([int(0), int(4), int(8), int(12)], [10, 0, 50, 8]);
        assert_eq!(u32::from_le_bytes([message[16], message[17], message[18], message[19]]), 2);
        assert_eq!(u32::from_le_bytes([message[20], message[21], message[22], message[23]]), 1);
        assert_eq!(&message[HEADER..HEADER + 4], &[30, 20, 10, 255]);
    }

    #[test]
    fn saturation_pushes_colours_away_from_grey_and_leaves_grey_alone() {
        let readback = |bgra: Vec<u8>| Readback { rect: (0, 0, 4, 4), width: 1, height: 1, level: 2, bgra };
        let vivid = encode(readback(vec![100, 100, 200, 255]), BlurOptions { saturation: 200.0, ..options(0.0) }, (0, 0));
        assert!(vivid[HEADER] > 200 && vivid[HEADER + 2] < 100, "{:?}", &vivid[HEADER..]);
        let grey = encode(readback(vec![90, 90, 90, 255]), BlurOptions { saturation: 250.0, ..options(0.0) }, (0, 0));
        assert_eq!(&grey[HEADER..HEADER + 3], &[90, 90, 90]);
    }

    #[test]
    fn failure_reasons_reach_the_page_with_the_names_and_codes_glass_frame_ts_reads() {
        let named = [
            (CaptureFailure::Unsupported, "\"unsupported\"", 1),
            (CaptureFailure::NoD3d, "\"no-d3d\"", 2),
            (CaptureFailure::Remote, "\"remote\"", 3),
            (CaptureFailure::Failed, "\"failed\"", 4),
        ];
        for (failure, name, code) in named {
            assert_eq!(serde_json::to_string(&failure).unwrap(), name);
            assert_eq!(failure.code(), code);
        }
    }

    #[test]
    fn capture_runs_only_for_live_windows_and_pauses_while_the_island_is_away() {
        let live = IslandWindowState { glass_enabled: true, glass_native: true, ..IslandWindowState::default() };
        assert_eq!(plan(&IslandWindowState::default()), Plan::Off);
        assert_eq!(plan(&IslandWindowState { glass_native: false, ..live }), Plan::Off);
        assert_eq!(plan(&live), Plan::Run { fast: false });
        assert_eq!(plan(&IslandWindowState { mode: IslandMode::Expanded, ..live }), Plan::Run { fast: true });
        assert_eq!(plan(&IslandWindowState { is_dragging: true, ..live }), Plan::Run { fast: true });
        for paused in [
            IslandWindowState { is_tucked: true, ..live },
            IslandWindowState { is_dimmed: true, ..live },
            IslandWindowState { game_passthrough: true, ..live },
            IslandWindowState { notch: Some(crate::island::notch::Notch { width: 200.0, height: 32.0, simulated: false }), ..live },
        ] {
            assert_eq!(plan(&paused), Plan::Paused);
        }
        let notch_open = IslandWindowState {
            mode: IslandMode::Expanded,
            notch: Some(crate::island::notch::Notch { width: 200.0, height: 32.0, simulated: false }),
            ..live
        };
        assert_eq!(plan(&notch_open), Plan::Run { fast: true });
    }
}
