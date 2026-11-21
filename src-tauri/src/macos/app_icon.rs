use objc2::{AllocAnyThread, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSImage};
use objc2_foundation::NSData;

const ICON_PNG: &[u8] = include_bytes!("../../icons/icon.png");
const BUNDLED_EXE_MARKER: &str = ".app/Contents/MacOS/";

pub(crate) fn use_own_icon_outside_bundle() {
    if running_from_bundle() {
        return;
    }
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    let data = NSData::with_bytes(ICON_PNG);
    let Some(image) = NSImage::initWithData(NSImage::alloc(), &data) else {
        return;
    };
    unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
}

fn running_from_bundle() -> bool {
    std::env::current_exe()
        .map(|path| path.to_string_lossy().contains(BUNDLED_EXE_MARKER))
        .unwrap_or(false)
}
