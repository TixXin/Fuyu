use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller;
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Shell::{DefSubclassProc, GetWindowSubclass, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            IsWindowVisible, SWP_HIDEWINDOW, SWP_SHOWWINDOW, WINDOWPOS, WM_NCDESTROY, WM_WINDOWPOSCHANGED,
            WM_WINDOWPOSCHANGING,
        },
    },
};

const SUBCLASS_ID: usize = 0x4655_5956;

pub(crate) fn follow_window(window: isize, controller: ICoreWebView2Controller) -> Result<(), String> {
    let hwnd = HWND(window as *mut core::ffi::c_void);
    let visible = unsafe { IsWindowVisible(hwnd) }.as_bool();
    unsafe { controller.SetIsVisible(visible) }.map_err(|error| format!("Could not set the WebView visibility: {error}"))?;
    let mut previous = 0usize;
    let had_previous = unsafe { GetWindowSubclass(hwnd, Some(on_message), SUBCLASS_ID, Some(&mut previous)) }.as_bool();
    let data = Box::into_raw(Box::new(controller)) as usize;
    if !unsafe { SetWindowSubclass(hwnd, Some(on_message), SUBCLASS_ID, data) }.as_bool() {
        drop(unsafe { Box::from_raw(data as *mut ICoreWebView2Controller) });
        return Err("Could not watch the window visibility".to_string());
    }
    if had_previous && previous != 0 {
        drop(unsafe { Box::from_raw(previous as *mut ICoreWebView2Controller) });
    }
    Ok(())
}

fn flags_of(lparam: LPARAM) -> Option<u32> {
    if lparam.0 == 0 {
        return None;
    }
    Some(unsafe { (*(lparam.0 as *const WINDOWPOS)).flags.0 })
}

unsafe extern "system" fn on_message(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    match message {
        WM_WINDOWPOSCHANGING if flags_of(lparam).is_some_and(|flags| flags & SWP_SHOWWINDOW.0 != 0) => {
            set_visible(data, true);
        }
        WM_WINDOWPOSCHANGED if flags_of(lparam).is_some_and(|flags| flags & SWP_HIDEWINDOW.0 != 0) => {
            set_visible(data, false);
        }
        WM_NCDESTROY => {
            let _ = unsafe { RemoveWindowSubclass(hwnd, Some(on_message), id) };
            if data != 0 {
                drop(unsafe { Box::from_raw(data as *mut ICoreWebView2Controller) });
            }
        }
        _ => {}
    }
    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn set_visible(data: usize, visible: bool) {
    if data == 0 {
        return;
    }
    let controller = unsafe { &*(data as *const ICoreWebView2Controller) };
    let _ = unsafe { controller.SetIsVisible(visible) };
}
