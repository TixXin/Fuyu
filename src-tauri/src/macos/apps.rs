use objc2_app_kit::{NSApplicationActivationOptions, NSRunningApplication, NSWorkspace};

fn path_of(app: &NSRunningApplication) -> Option<String> {
    let url = app.bundleURL().or_else(|| app.executableURL())?;
    Some(url.path()?.to_string())
}

pub(crate) fn frontmost_pid() -> Option<i32> {
    Some(NSWorkspace::sharedWorkspace().frontmostApplication()?.processIdentifier())
}

pub(crate) fn frontmost_path() -> Option<String> {
    NSWorkspace::sharedWorkspace().frontmostApplication().as_deref().and_then(path_of)
}

pub(crate) fn path(pid: i32) -> Option<String> {
    NSRunningApplication::runningApplicationWithProcessIdentifier(pid).as_deref().and_then(path_of)
}

pub(crate) fn activate(pid: i32) -> bool {
    NSRunningApplication::runningApplicationWithProcessIdentifier(pid)
        .is_some_and(|app| app.activateWithOptions(NSApplicationActivationOptions::ActivateAllWindows))
}
