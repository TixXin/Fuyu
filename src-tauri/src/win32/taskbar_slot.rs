use std::{sync::mpsc, thread};

use windows::Win32::{
    Foundation::{COLORREF, HWND, LPARAM, LRESULT, WPARAM},
    UI::WindowsAndMessaging::{
        GetWindowLongPtrW, PostQuitMessage, SetLayeredWindowAttributes, SetWindowLongPtrW, ShowWindowAsync, GWL_EXSTYLE,
        LWA_ALPHA, SW_HIDE, SW_SHOWNOACTIVATE, WM_CLOSE, WM_DESTROY, WS_EX_LAYERED, WS_EX_TRANSPARENT,
    },
};

use super::message_window::{self, WindowMessages};

const CLASS: &str = "FuyuTaskbarSlot";

struct Slot;

impl WindowMessages for Slot {
    fn handle(_: HWND, message: u32, _: WPARAM, _: LPARAM) -> Option<LRESULT> {
        (message == WM_DESTROY).then(|| {
            unsafe { PostQuitMessage(0) };
            LRESULT(0)
        })
    }
}

fn make_invisible(window: HWND) {
    unsafe {
        let style = GetWindowLongPtrW(window, GWL_EXSTYLE);
        let _ = SetWindowLongPtrW(window, GWL_EXSTYLE, style | (WS_EX_LAYERED.0 | WS_EX_TRANSPARENT.0) as isize);
        let _ = SetLayeredWindowAttributes(window, COLORREF(0), 0, LWA_ALPHA);
    }
}

pub(crate) fn create() -> Option<HWND> {
    let (sender, receiver) = mpsc::channel::<Option<isize>>();
    thread::Builder::new()
        .name("taskbar-slot".into())
        .spawn(move || {
            let created = message_window::module_instance().ok().and_then(|instance| {
                let _ = message_window::register_class::<Slot>(instance, CLASS);
                message_window::create_tool_popup_window(instance, CLASS, "").ok()
            });
            if let Some(window) = created {
                make_invisible(window);
            }
            let _ = sender.send(created.map(|window| window.0 as isize));
            if created.is_some() {
                message_window::run_message_loop();
            }
        })
        .ok()?;
    receiver.recv().ok().flatten().map(|handle| HWND(handle as *mut _))
}

pub(crate) fn show(window: HWND, shown: bool) {
    unsafe {
        let _ = ShowWindowAsync(window, if shown { SW_SHOWNOACTIVATE } else { SW_HIDE });
    }
}

pub(crate) fn close(window: HWND) {
    let _ = message_window::post_message(window, WM_CLOSE);
}
