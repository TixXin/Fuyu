use objc2_core_foundation::{CFBoolean, CFDictionary, CFRetained, CFString, CFType};
use objc2_core_graphics::{CGEventSource, CGEventSourceStateID, CGEventType, CGSessionCopyCurrentDictionary};

const ANY_INPUT: CGEventType = CGEventType(u32::MAX);

pub(crate) fn idle_seconds() -> Option<u32> {
    let seconds = CGEventSource::seconds_since_last_event_type(CGEventSourceStateID::CombinedSessionState, ANY_INPUT);
    (seconds.is_finite() && seconds >= 0.0).then(|| seconds.min(f64::from(u32::MAX)) as u32)
}

pub(crate) fn is_locked() -> bool {
    let Some(session) = CGSessionCopyCurrentDictionary() else {
        return false;
    };
    let session: CFRetained<CFDictionary<CFString, CFType>> = unsafe { CFRetained::cast_unchecked(session) };
    session
        .get(&CFString::from_static_str("CGSSessionScreenIsLocked"))
        .and_then(|value| value.downcast_ref::<CFBoolean>().map(CFBoolean::as_bool))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{idle_seconds, is_locked};

    #[test]
    fn a_running_session_reports_idle_time_and_is_not_locked() {
        assert!(idle_seconds().is_some());
        assert!(!is_locked());
    }
}
