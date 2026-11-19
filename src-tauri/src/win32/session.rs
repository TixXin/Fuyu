use windows::{
    core::PWSTR,
    Win32::{
        System::{
            RemoteDesktop::{
                WTSFreeMemory, WTSQuerySessionInformationW, WTSSessionInfoEx, WTSINFOEXW, WTS_CURRENT_SERVER_HANDLE,
                WTS_CURRENT_SESSION, WTS_SESSIONSTATE_LOCK,
            },
            SystemInformation::GetTickCount,
        },
        UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
    },
};

pub(crate) fn idle_seconds() -> Option<u32> {
    let mut info = LASTINPUTINFO { cbSize: size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
    if !unsafe { GetLastInputInfo(&mut info) }.as_bool() {
        return None;
    }
    let now = unsafe { GetTickCount() };
    Some(now.wrapping_sub(info.dwTime) / 1000)
}

struct WtsBuffer(PWSTR);

impl Drop for WtsBuffer {
    fn drop(&mut self) {
        unsafe { WTSFreeMemory(self.0 .0.cast()) };
    }
}

pub(crate) fn is_locked() -> bool {
    let mut buffer = PWSTR::null();
    let mut bytes = 0u32;
    if unsafe { WTSQuerySessionInformationW(Some(WTS_CURRENT_SERVER_HANDLE), WTS_CURRENT_SESSION, WTSSessionInfoEx, &mut buffer, &mut bytes) }.is_err()
        || buffer.is_null()
    {
        return false;
    }
    let buffer = WtsBuffer(buffer);
    if (bytes as usize) < size_of::<WTSINFOEXW>() {
        return false;
    }
    let info = unsafe { &*buffer.0 .0.cast::<WTSINFOEXW>() };
    if info.Level != 1 {
        return false;
    }
    let flags = unsafe { info.Data.WTSInfoExLevel1.SessionFlags };
    flags == WTS_SESSIONSTATE_LOCK as i32
}

#[cfg(test)]
mod tests {
    use super::{idle_seconds, is_locked};

    #[test]
    fn idle_time_is_known() {
        assert!(idle_seconds().is_some());
    }

    #[test]
    fn lock_state_can_be_read() {
        let _ = is_locked();
    }
}
