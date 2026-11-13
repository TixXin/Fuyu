use std::{
    sync::{mpsc, Mutex, PoisonError},
    time::Duration,
};

use objc2::{
    encode::{Encode, Encoding},
    msg_send,
    rc::Retained,
    runtime::{AnyClass, NSObject},
    sel, MainThreadMarker,
};
use objc2_core_foundation::CGRect;
use objc2_foundation::NSArray;
use tauri::{Runtime, WebviewWindow};

const MAIN_THREAD_WAIT: Duration = Duration::from_millis(200);
const EDGE_TOLERANCE: f64 = 1.0;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct EdgeInsets {
    top: f64,
    left: f64,
    bottom: f64,
    right: f64,
}

unsafe impl Encode for EdgeInsets {
    const ENCODING: Encoding = Encoding::Struct("NSEdgeInsets", &[f64::ENCODING, f64::ENCODING, f64::ENCODING, f64::ENCODING]);
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct ScreenNotch {
    pub(crate) screen_left: f64,
    pub(crate) screen_top: f64,
    pub(crate) screen_width: f64,
    pub(crate) left: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

impl ScreenNotch {
    fn is_on(&self, left: f64, top: f64, width: f64) -> bool {
        let close = |a: f64, b: f64| (a - b).abs() <= EDGE_TOLERANCE;
        close(self.screen_left, left) && close(self.screen_top, top) && close(self.screen_width, width)
    }
}

static LAST_READ: Mutex<Vec<ScreenNotch>> = Mutex::new(Vec::new());

fn frame(screen: &NSObject) -> CGRect {
    unsafe { msg_send![screen, frame] }
}

fn knows_notch(screen: &NSObject) -> bool {
    let insets: bool = unsafe { msg_send![screen, respondsToSelector: sel!(safeAreaInsets)] };
    let areas: bool = unsafe { msg_send![screen, respondsToSelector: sel!(auxiliaryTopLeftArea)] };
    insets && areas
}

fn top_inset(screen: &NSObject) -> f64 {
    let insets: EdgeInsets = unsafe { msg_send![screen, safeAreaInsets] };
    insets.top
}

fn side_areas(screen: &NSObject) -> (CGRect, CGRect) {
    let left: CGRect = unsafe { msg_send![screen, auxiliaryTopLeftArea] };
    let right: CGRect = unsafe { msg_send![screen, auxiliaryTopRightArea] };
    (left, right)
}

fn read_on_main(_marker: MainThreadMarker) -> Vec<ScreenNotch> {
    let Some(class) = AnyClass::get(c"NSScreen") else {
        return Vec::new();
    };
    let screens: Option<Retained<NSArray<NSObject>>> = unsafe { msg_send![class, screens] };
    let Some(screens) = screens else {
        return Vec::new();
    };
    let mut primary_height = None;
    let mut notches = Vec::new();
    for screen in screens.iter() {
        let frame = frame(&screen);
        let primary_height = *primary_height.get_or_insert(frame.size.height);
        if !knows_notch(&screen) {
            continue;
        }
        let (left_area, right_area) = side_areas(&screen);
        if let Some(notch) = notch_from(frame, primary_height, top_inset(&screen), left_area, right_area) {
            notches.push(notch);
        }
    }
    notches
}

pub(crate) fn notch_from(
    frame: CGRect,
    primary_height: f64,
    top_inset: f64,
    left_area: CGRect,
    right_area: CGRect,
) -> Option<ScreenNotch> {
    if top_inset <= 0.0 || left_area.size.width <= 0.0 || right_area.size.width <= 0.0 {
        return None;
    }
    let left = left_area.origin.x + left_area.size.width;
    let width = right_area.origin.x - left;
    if width <= 0.0 {
        return None;
    }
    Some(ScreenNotch {
        screen_left: frame.origin.x,
        screen_top: primary_height - (frame.origin.y + frame.size.height),
        screen_width: frame.size.width,
        left,
        width,
        height: top_inset,
    })
}

pub(crate) fn read_notches<R: Runtime>(window: &WebviewWindow<R>) -> Vec<ScreenNotch> {
    let notches = match MainThreadMarker::new() {
        Some(marker) => Some(read_on_main(marker)),
        None => {
            let (sender, receiver) = mpsc::channel();
            let sent = window.run_on_main_thread(move || {
                if let Some(marker) = MainThreadMarker::new() {
                    let _ = sender.send(read_on_main(marker));
                }
            });
            sent.ok().and_then(|()| receiver.recv_timeout(MAIN_THREAD_WAIT).ok())
        }
    };
    let mut last = LAST_READ.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(notches) = notches {
        *last = notches;
    }
    last.clone()
}

pub(crate) fn notch_on(notches: &[ScreenNotch], left: f64, top: f64, width: f64) -> Option<ScreenNotch> {
    notches.iter().copied().find(|notch| notch.is_on(left, top, width))
}
