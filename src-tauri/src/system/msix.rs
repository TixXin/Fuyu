#[cfg(windows)]
pub(crate) fn is_packaged() -> bool {
    static PACKAGED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    *PACKAGED.get_or_init(|| windows::ApplicationModel::Package::Current().is_ok())
}

#[cfg(not(windows))]
pub(crate) fn is_packaged() -> bool {
    false
}

#[cfg(windows)]
pub(crate) use startup_task::{set_startup, startup_enabled};

#[cfg(windows)]
mod startup_task {
    use crate::user_error::UserError;
    use windows::{
        core::HSTRING,
        ApplicationModel::{StartupTask, StartupTaskState},
    };

    const TASK_ID: &str = "FuyuStartup";

    fn read_failed(error: windows::core::Error) -> UserError {
        UserError::new("startup.task", "Could not read the startup setting of the Microsoft Store app.").detail(error)
    }

    fn change_failed(error: windows::core::Error) -> UserError {
        UserError::new("startup.task", "Could not change the startup setting of the Microsoft Store app.").detail(error)
    }

    fn task() -> Result<StartupTask, UserError> {
        StartupTask::GetAsync(&HSTRING::from(TASK_ID)).and_then(|operation| operation.join()).map_err(read_failed)
    }

    pub(crate) fn startup_enabled() -> Result<bool, UserError> {
        let state = task()?.State().map_err(read_failed)?;
        Ok(state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy)
    }

    pub(crate) fn set_startup(enabled: bool) -> Result<(), UserError> {
        let task = task()?;
        let state = if enabled {
            task.RequestEnableAsync().and_then(|operation| operation.join()).map_err(change_failed)?
        } else {
            task.Disable().map_err(change_failed)?;
            task.State().map_err(read_failed)?
        };
        refusal(enabled, state).map_or(Ok(()), Err)
    }

    fn refusal(enabled: bool, state: StartupTaskState) -> Option<UserError> {
        match state {
            StartupTaskState::DisabledByUser if enabled => Some(UserError::new(
                "startup.disabledByUser",
                "Launch at startup was turned off in Task Manager. Turn Fuyu back on under Startup apps there.",
            )),
            StartupTaskState::DisabledByPolicy if enabled => {
                Some(UserError::new("startup.disabledByPolicy", "Launch at startup is turned off by your organization's policy."))
            }
            StartupTaskState::EnabledByPolicy if !enabled => Some(UserError::new(
                "startup.enabledByPolicy",
                "Launch at startup is turned on by your organization's policy and can't be turned off here.",
            )),
            _ => None,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::refusal;
        use windows::ApplicationModel::StartupTaskState;

        #[test]
        fn only_a_blocked_change_is_refused() {
            let code = |enabled, state| refusal(enabled, state).map(|error| error.code().to_string());
            assert_eq!(code(true, StartupTaskState::DisabledByUser).as_deref(), Some("startup.disabledByUser"));
            assert_eq!(code(true, StartupTaskState::DisabledByPolicy).as_deref(), Some("startup.disabledByPolicy"));
            assert_eq!(code(false, StartupTaskState::EnabledByPolicy).as_deref(), Some("startup.enabledByPolicy"));
            assert_eq!(code(true, StartupTaskState::Enabled), None);
            assert_eq!(code(false, StartupTaskState::Disabled), None);
            assert_eq!(code(false, StartupTaskState::DisabledByUser), None);
        }
    }
}
