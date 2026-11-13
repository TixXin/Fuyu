use objc2_app_kit::{NSApplicationActivationOptions, NSApplicationActivationPolicy, NSRunningApplication, NSWorkspace};

extern "C" {
    fn responsibility_get_pid_responsible_for_pid(pid: i32) -> i32;
}

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

fn executable_of(app: &NSRunningApplication) -> Option<String> {
    Some(app.executableURL()?.path()?.to_string())
}

pub(crate) fn regular_apps() -> Vec<(u32, String)> {
    NSWorkspace::sharedWorkspace()
        .runningApplications()
        .iter()
        .filter(|app| app.activationPolicy() == NSApplicationActivationPolicy::Regular)
        .filter_map(|app| Some((u32::try_from(app.processIdentifier()).ok()?, executable_of(&app)?)))
        .collect()
}

pub(crate) fn responsible_pid(pid: i32) -> i32 {
    let responsible = unsafe { responsibility_get_pid_responsible_for_pid(pid) };
    if responsible > 0 {
        responsible
    } else {
        pid
    }
}

pub(crate) fn outer_app_name(path: &str) -> Option<String> {
    let bundle = path.split('/').find(|part| part.len() > ".app".len() && part.ends_with(".app"))?;
    Some(bundle.trim_end_matches(".app").to_string())
}

pub(crate) fn display_name(pid: i32) -> Option<String> {
    let app = NSRunningApplication::runningApplicationWithProcessIdentifier(pid);
    let from_path = app.as_deref().and_then(path_of).as_deref().and_then(outer_app_name);
    from_path.or_else(|| Some(app?.localizedName()?.to_string()))
}

#[cfg(test)]
mod tests {
    use super::outer_app_name;

    #[test]
    fn helpers_are_named_after_the_outermost_app() {
        let helper = "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper.app";
        assert_eq!(outer_app_name(helper).as_deref(), Some("Google Chrome"));
        assert_eq!(outer_app_name("/System/Applications/FaceTime.app").as_deref(), Some("FaceTime"));
        assert_eq!(outer_app_name("/usr/libexec/coreaudiod"), None);
    }
}
