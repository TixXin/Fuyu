use objc2_service_management::{SMAppService, SMAppServiceStatus};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LoginItem {
    Off,
    On,
    NeedsApproval,
}

fn read(status: SMAppServiceStatus) -> LoginItem {
    if status == SMAppServiceStatus::Enabled {
        LoginItem::On
    } else if status == SMAppServiceStatus::RequiresApproval {
        LoginItem::NeedsApproval
    } else {
        LoginItem::Off
    }
}

pub(crate) fn status() -> LoginItem {
    let service = unsafe { SMAppService::mainAppService() };
    read(unsafe { service.status() })
}

pub(crate) fn set(enabled: bool) -> Result<LoginItem, String> {
    let service = unsafe { SMAppService::mainAppService() };
    let result = if enabled {
        unsafe { service.registerAndReturnError() }
    } else {
        unsafe { service.unregisterAndReturnError() }
    };
    result.map_err(|error| error.localizedDescription().to_string())?;
    Ok(read(unsafe { service.status() }))
}

pub(crate) fn open_login_items_settings() {
    unsafe { SMAppService::openSystemSettingsLoginItems() };
}

#[cfg(test)]
mod tests {
    use super::{read, status, LoginItem};
    use objc2_service_management::SMAppServiceStatus;

    #[test]
    fn only_an_approved_login_item_counts_as_on() {
        assert_eq!(read(SMAppServiceStatus::Enabled), LoginItem::On);
        assert_eq!(read(SMAppServiceStatus::RequiresApproval), LoginItem::NeedsApproval);
        assert_eq!(read(SMAppServiceStatus::NotRegistered), LoginItem::Off);
        assert_eq!(read(SMAppServiceStatus::NotFound), LoginItem::Off);
    }

    #[test]
    fn a_test_binary_outside_an_app_bundle_is_not_a_login_item() {
        assert_ne!(status(), LoginItem::On);
    }
}
