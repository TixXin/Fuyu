use objc2_foundation::{NSProcessInfo, NSString};

pub(crate) fn set_process_name(name: &str) {
    NSProcessInfo::processInfo().setProcessName(&NSString::from_str(name));
}
