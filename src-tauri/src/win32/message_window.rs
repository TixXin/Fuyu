use std::iter::once;

use windows::{
    core::{Error, Result, PCWSTR},
    Win32::{
        Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::{
            CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW,
            PeekMessageW, PostMessageW, RegisterClassW, TranslateMessage, UnregisterClassW,
            HWND_MESSAGE, MSG, PM_REMOVE, WINDOW_EX_STYLE, WINDOW_STYLE, WNDCLASSW,
            WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP,
        },
    },
};

pub(crate) trait WindowMessages {
    fn handle(window: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT>;
}

unsafe extern "system" fn window_proc<H: WindowMessages>(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if let Some(result) = H::handle(window, message, wparam, lparam) {
        return result;
    }
    unsafe { DefWindowProcW(window, message, wparam, lparam) }
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(once(0)).collect()
}

pub(crate) fn module_instance() -> Result<HINSTANCE> {
    let module = unsafe { GetModuleHandleW(None) }?;
    Ok(HINSTANCE(module.0))
}

pub(crate) fn register_class<H: WindowMessages>(instance: HINSTANCE, name: &str) -> Result<()> {
    let name = wide(name);
    let class = WNDCLASSW {
        lpfnWndProc: Some(window_proc::<H>),
        hInstance: instance,
        lpszClassName: PCWSTR(name.as_ptr()),
        ..Default::default()
    };
    if unsafe { RegisterClassW(&class) } == 0 {
        return Err(Error::from_thread());
    }
    Ok(())
}

pub(crate) fn create_message_only_window(
    instance: HINSTANCE,
    class: &str,
    title: &str,
) -> Result<HWND> {
    let class = wide(class);
    let title = wide(title);
    unsafe {
        CreateWindowExW(
            WINDOW_EX_STYLE(0),
            PCWSTR(class.as_ptr()),
            PCWSTR(title.as_ptr()),
            WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None,
            Some(instance),
            None,
        )
    }
}

pub(crate) fn create_tool_popup_window(
    instance: HINSTANCE,
    class: &str,
    title: &str,
) -> Result<HWND> {
    let class = wide(class);
    let title = wide(title);
    unsafe {
        CreateWindowExW(
            WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
            PCWSTR(class.as_ptr()),
            PCWSTR(title.as_ptr()),
            WS_POPUP,
            0,
            0,
            0,
            0,
            None,
            None,
            Some(instance),
            None,
        )
    }
}

pub(crate) fn destroy_window(window: HWND) -> Result<()> {
    unsafe { DestroyWindow(window) }
}

pub(crate) fn unregister_class(instance: HINSTANCE, name: &str) -> Result<()> {
    let name = wide(name);
    unsafe { UnregisterClassW(PCWSTR(name.as_ptr()), Some(instance)) }
}

pub(crate) fn post_message(window: HWND, message: u32) -> Result<()> {
    unsafe { PostMessageW(Some(window), message, WPARAM(0), LPARAM(0)) }
}

pub(crate) fn run_message_loop() {
    let mut message = MSG::default();
    unsafe {
        while GetMessageW(&mut message, None, 0, 0).into() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
}

pub(crate) fn dispatch_pending_messages() {
    let mut message = MSG::default();
    unsafe {
        while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
            let _ = TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use windows::Win32::UI::WindowsAndMessaging::{WM_APP, WM_QUIT};

    static RECEIVED: AtomicU32 = AtomicU32::new(0);

    struct Counter;

    impl WindowMessages for Counter {
        fn handle(_: HWND, message: u32, _: WPARAM, _: LPARAM) -> Option<LRESULT> {
            (message == WM_APP + 7).then(|| {
                RECEIVED.fetch_add(1, Ordering::SeqCst);
                LRESULT(0)
            })
        }
    }

    #[test]
    fn posted_messages_reach_the_handler_until_quit() {
        std::thread::spawn(|| {
            let class = "FocuSDMessageWindowTest";
            let instance = module_instance().unwrap();
            register_class::<Counter>(instance, class).unwrap();
            let window = create_message_only_window(instance, class, "").unwrap();
            post_message(window, WM_APP + 7).unwrap();
            post_message(window, WM_QUIT).unwrap();
            run_message_loop();
            assert_eq!(RECEIVED.load(Ordering::SeqCst), 1);
        })
        .join()
        .unwrap();
    }

    struct Silent;

    impl WindowMessages for Silent {
        fn handle(_: HWND, _: u32, _: WPARAM, _: LPARAM) -> Option<LRESULT> {
            None
        }
    }

    #[test]
    fn tool_popups_can_be_created_drained_destroyed_and_unregistered() {
        std::thread::spawn(|| {
            let class = "FocuSDToolPopupTest";
            let instance = module_instance().unwrap();
            register_class::<Silent>(instance, class).unwrap();
            let window = create_tool_popup_window(instance, class, "").unwrap();
            assert!(!crate::win32::window::is_visible(window));
            dispatch_pending_messages();
            assert!(
                unregister_class(instance, class).is_err(),
                "window still alive"
            );
            destroy_window(window).unwrap();
            unregister_class(instance, class).unwrap();
        })
        .join()
        .unwrap();
    }
}
