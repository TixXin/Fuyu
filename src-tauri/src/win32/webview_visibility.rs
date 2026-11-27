use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;
use windows::{
    core::BOOL,
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{
            Shell::{DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{
                IsIconic, IsWindowVisible, PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMESUSPEND, SIZE_MAXIMIZED, SIZE_RESTORED,
                SWP_HIDEWINDOW, SWP_SHOWWINDOW, WA_INACTIVE, WINDOWPOS, WM_ACTIVATE, WM_DISPLAYCHANGE, WM_DPICHANGED,
                WM_NCDESTROY, WM_POWERBROADCAST, WM_SIZE, WM_WINDOWPOSCHANGED, WM_WINDOWPOSCHANGING,
            },
        },
    },
};

const SUBCLASS_ID: usize = 0x4655_5956;

struct Watch {
    controller: ICoreWebView2Controller,
    healed: Box<dyn Fn(&'static str)>,
}

pub(crate) fn follow_window(
    window: isize,
    controller: ICoreWebView2Controller,
    sync_initial: bool,
    healed: impl Fn(&'static str) + 'static,
) -> Result<(), String> {
    let hwnd = HWND(window as *mut core::ffi::c_void);
    if sync_initial {
        let visible = unsafe { IsWindowVisible(hwnd) }.as_bool();
        unsafe { controller.SetIsVisible(visible) }.map_err(|error| format!("Could not set the WebView visibility: {error}"))?;
    }
    let mut previous = 0usize;
    let had_previous = unsafe { GetWindowSubclass(hwnd, Some(on_message), SUBCLASS_ID, Some(&mut previous)) }.as_bool();
    let data = Box::into_raw(Box::new(Watch { controller, healed: Box::new(healed) })) as usize;
    if !unsafe { SetWindowSubclass(hwnd, Some(on_message), SUBCLASS_ID, data) }.as_bool() {
        drop(unsafe { Box::from_raw(data as *mut Watch) });
        return Err("Could not watch the window visibility".to_string());
    }
    if had_previous && previous != 0 {
        drop(unsafe { Box::from_raw(previous as *mut Watch) });
    }
    Ok(())
}

fn flags_of(lparam: LPARAM) -> Option<u32> {
    if lparam.0 == 0 {
        return None;
    }
    Some(unsafe { (*(lparam.0 as *const WINDOWPOS)).flags.0 })
}

fn recheck_reason(message: u32, wparam: usize, flags: Option<u32>) -> Option<&'static str> {
    match message {
        WM_WINDOWPOSCHANGED if flags.is_some_and(|flags| flags & SWP_SHOWWINDOW.0 != 0) => Some("shown"),
        WM_ACTIVATE if (wparam & 0xffff) as u32 != WA_INACTIVE => Some("activated"),
        WM_SIZE if wparam as u32 == SIZE_RESTORED || wparam as u32 == SIZE_MAXIMIZED => Some("resized"),
        WM_DPICHANGED => Some("dpi-changed"),
        WM_DISPLAYCHANGE => Some("display-changed"),
        WM_POWERBROADCAST if wparam as u32 == PBT_APMRESUMEAUTOMATIC || wparam as u32 == PBT_APMRESUMESUSPEND => {
            Some("resumed")
        }
        _ => None,
    }
}

unsafe extern "system" fn on_message(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    let watch = (data != 0).then(|| unsafe { &*(data as *const Watch) });
    let flags = match message {
        WM_WINDOWPOSCHANGING | WM_WINDOWPOSCHANGED => flags_of(lparam),
        _ => None,
    };
    match message {
        WM_WINDOWPOSCHANGING if flags.is_some_and(|flags| flags & SWP_SHOWWINDOW.0 != 0) => {
            set_visible(watch, true);
        }
        WM_WINDOWPOSCHANGED if flags.is_some_and(|flags| flags & SWP_HIDEWINDOW.0 != 0) => {
            set_visible(watch, false);
        }
        WM_NCDESTROY => {
            let _ = unsafe { RemoveWindowSubclass(hwnd, Some(on_message), id) };
            if data != 0 {
                drop(unsafe { Box::from_raw(data as *mut Watch) });
            }
            return unsafe { DefSubclassProc(hwnd, message, wparam, lparam) };
        }
        _ => {}
    }
    if let (Some(watch), Some(reason)) = (watch, recheck_reason(message, wparam.0, flags)) {
        recheck(hwnd, watch, reason);
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn set_visible(watch: Option<&Watch>, visible: bool) {
    if let Some(watch) = watch {
        let _ = unsafe { watch.controller.SetIsVisible(visible) };
    }
}

fn recheck(hwnd: HWND, watch: &Watch, reason: &'static str) {
    if !unsafe { IsWindowVisible(hwnd) }.as_bool() || unsafe { IsIconic(hwnd) }.as_bool() {
        return;
    }
    let mut visible = BOOL::default();
    if unsafe { watch.controller.IsVisible(&mut visible) }.is_err() || visible.as_bool() {
        return;
    }
    if unsafe { watch.controller.SetIsVisible(true) }.is_ok() {
        (watch.healed)(reason);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rechecks_after_show_activate_restore_display_and_resume_only() {
        assert_eq!(recheck_reason(WM_WINDOWPOSCHANGED, 0, Some(SWP_SHOWWINDOW.0)), Some("shown"));
        assert_eq!(recheck_reason(WM_WINDOWPOSCHANGED, 0, Some(SWP_HIDEWINDOW.0)), None);
        assert_eq!(recheck_reason(WM_WINDOWPOSCHANGED, 0, None), None);
        assert_eq!(recheck_reason(WM_ACTIVATE, 1, None), Some("activated"));
        assert_eq!(recheck_reason(WM_ACTIVATE, 0x0001_0000, None), None);
        assert_eq!(recheck_reason(WM_SIZE, SIZE_RESTORED as usize, None), Some("resized"));
        assert_eq!(recheck_reason(WM_SIZE, 1, None), None);
        assert_eq!(recheck_reason(WM_DPICHANGED, 0, None), Some("dpi-changed"));
        assert_eq!(recheck_reason(WM_DISPLAYCHANGE, 0, None), Some("display-changed"));
        assert_eq!(recheck_reason(WM_POWERBROADCAST, PBT_APMRESUMEAUTOMATIC as usize, None), Some("resumed"));
        assert_eq!(recheck_reason(WM_POWERBROADCAST, 4, None), None);
    }
}
