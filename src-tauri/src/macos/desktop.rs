use objc2::MainThreadMarker;
use objc2_app_kit::NSApplication;

pub(crate) fn hide_other_applications() {
    if let Some(mtm) = MainThreadMarker::new() {
        NSApplication::sharedApplication(mtm).hideOtherApplications(None);
    }
}

pub(crate) fn unhide_all_applications() {
    if let Some(mtm) = MainThreadMarker::new() {
        NSApplication::sharedApplication(mtm).unhideAllApplications(None);
    }
}
