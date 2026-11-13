use std::{sync::mpsc, time::Duration};

use block2::RcBlock;
use objc2::AllocAnyThread;
use objc2_core_foundation::{CGPoint, CGRect, CGSize};
use objc2_core_graphics::{CGDataProvider, CGImage, CGPreflightScreenCaptureAccess, CGRequestScreenCaptureAccess};
use objc2_foundation::{NSArray, NSError};
use objc2_screen_capture_kit::{
    SCCaptureResolutionType, SCContentFilter, SCRunningApplication, SCScreenshotManager, SCShareableContent, SCStreamConfiguration, SCWindow,
};

const WAIT: Duration = Duration::from_secs(4);

pub(crate) struct Shot {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

pub(crate) fn has_access() -> bool {
    CGPreflightScreenCaptureAccess()
}

pub(crate) fn ask_for_access() -> bool {
    CGRequestScreenCaptureAccess()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Leave {
    Nothing,
    OwnWindows,
    Windows(Vec<u32>),
}

#[derive(Clone)]
struct Request {
    rect: (f64, f64, f64, f64),
    scale: f64,
    leave: Leave,
}

pub(crate) fn capture(rect: (f64, f64, f64, f64), scale: f64, leave: Leave) -> Option<Shot> {
    if rect.2 <= 0.0 || rect.3 <= 0.0 || !scale.is_finite() || scale <= 0.0 {
        return None;
    }
    let request = Request { rect, scale, leave };
    let (sender, receiver) = mpsc::channel::<Option<Shot>>();
    let handler = RcBlock::new(move |content: *mut SCShareableContent, _error: *mut NSError| {
        let content = unsafe { content.as_ref() };
        let started = content.is_some_and(|content| shoot(content, request.clone(), sender.clone()));
        if !started {
            let _ = sender.send(None);
        }
    });
    unsafe { SCShareableContent::getShareableContentExcludingDesktopWindows_onScreenWindowsOnly_completionHandler(false, true, &handler) };
    receiver.recv_timeout(WAIT).ok().flatten()
}

fn contains(frame: CGRect, point: (f64, f64)) -> bool {
    point.0 >= frame.origin.x && point.0 < frame.origin.x + frame.size.width && point.1 >= frame.origin.y && point.1 < frame.origin.y + frame.size.height
}

fn shoot(content: &SCShareableContent, request: Request, sender: mpsc::Sender<Option<Shot>>) -> bool {
    let (x, y, width, height) = request.rect;
    let centre = (x + width / 2.0, y + height / 2.0);
    let displays = unsafe { content.displays() };
    let Some(display) = displays.iter().find(|display| contains(unsafe { display.frame() }, centre)) else {
        return false;
    };
    let frame = unsafe { display.frame() };
    let ours: Vec<_> = if request.leave == Leave::Nothing {
        Vec::new()
    } else {
        unsafe { content.applications() }.iter().filter(|app| is_own(unsafe { app.processID() })).collect()
    };
    let kept: Vec<_> = match &request.leave {
        Leave::Windows(left) => unsafe { content.windows() }.iter().filter(|window| keeps(window, left)).collect(),
        Leave::Nothing | Leave::OwnWindows => Vec::new(),
    };
    let filter = unsafe {
        SCContentFilter::initWithDisplay_excludingApplications_exceptingWindows(
            SCContentFilter::alloc(),
            &display,
            &NSArray::<SCRunningApplication>::from_retained_slice(&ours),
            &NSArray::<SCWindow>::from_retained_slice(&kept),
        )
    };
    let config = unsafe { SCStreamConfiguration::new() };
    let source = CGRect::new(CGPoint::new(x - frame.origin.x, y - frame.origin.y), CGSize::new(width, height));
    unsafe {
        config.setSourceRect(source);
        config.setWidth((width * request.scale).round().max(1.0) as usize);
        config.setHeight((height * request.scale).round().max(1.0) as usize);
        config.setShowsCursor(false);
        config.setCaptureResolution(SCCaptureResolutionType::Best);
    }
    let handler = RcBlock::new(move |image: *mut CGImage, _error: *mut NSError| {
        let image = unsafe { image.as_ref() };
        let _ = sender.send(image.and_then(to_rgba));
    });
    unsafe { SCScreenshotManager::captureImageWithFilter_configuration_completionHandler(&filter, &config, Some(&handler)) };
    true
}

fn is_own(pid: i32) -> bool {
    u32::try_from(pid).ok() == Some(std::process::id())
}

fn keeps(window: &SCWindow, left: &[u32]) -> bool {
    let owner = unsafe { window.owningApplication() };
    owner.is_some_and(|app| is_own(unsafe { app.processID() })) && !left.contains(&unsafe { window.windowID() })
}

fn to_rgba(image: &CGImage) -> Option<Shot> {
    let (width, height) = (CGImage::width(Some(image)), CGImage::height(Some(image)));
    let row = CGImage::bytes_per_row(Some(image));
    if width == 0 || height == 0 || CGImage::bits_per_pixel(Some(image)) != 32 || row < width * 4 {
        return None;
    }
    let provider = CGImage::data_provider(Some(image))?;
    let data = CGDataProvider::data(Some(&provider))?;
    let bytes = data.to_vec();
    if bytes.len() < row * height {
        return None;
    }
    let mut rgba = vec![0u8; width * height * 4];
    for (out, line) in rgba.chunks_exact_mut(width * 4).zip(bytes.chunks_exact(row)) {
        for (pixel, &[blue, green, red, _]) in out.as_chunks_mut::<4>().0.iter_mut().zip(line[..width * 4].as_chunks::<4>().0) {
            *pixel = [red, green, blue, 255];
        }
    }
    Some(Shot { width: u32::try_from(width).ok()?, height: u32::try_from(height).ok()?, rgba })
}
