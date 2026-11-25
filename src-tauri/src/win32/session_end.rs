use std::sync::OnceLock;

use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    System::Threading::SetProcessShutdownParameters,
    UI::WindowsAndMessaging::{WM_ENDSESSION, WM_QUERYENDSESSION},
};

use super::message_window::{self, WindowMessages};

const SHUTDOWN_LEVEL: u32 = 0x380;

static ON_END: OnceLock<fn()> = OnceLock::new();

fn session_ending(message: u32, wparam: usize) -> bool {
    message == WM_QUERYENDSESSION || (message == WM_ENDSESSION && wparam != 0)
}

struct SessionEndWindow;

impl WindowMessages for SessionEndWindow {
    fn handle(_window: HWND, message: u32, wparam: WPARAM, _lparam: LPARAM) -> Option<LRESULT> {
        if session_ending(message, wparam.0) {
            if let Some(on_end) = ON_END.get() {
                on_end();
            }
        }
        None
    }
}

pub(crate) fn watch(on_end: fn()) -> Result<(), String> {
    ON_END.set(on_end).map_err(|_| "Session end is already watched.".to_string())?;
    if let Err(error) = unsafe { SetProcessShutdownParameters(SHUTDOWN_LEVEL, 0) } {
        eprintln!("could not raise the shutdown level: {error}");
    }
    std::thread::Builder::new()
        .name("session-end-watch".into())
        .spawn(|| {
            const CLASS_NAME: &str = "FuyuSessionEndWatch";
            let Ok(instance) = message_window::module_instance() else {
                return;
            };
            if message_window::register_class::<SessionEndWindow>(instance, CLASS_NAME).is_err() {
                return;
            }
            if message_window::create_tool_popup_window(instance, CLASS_NAME, "").is_ok() {
                message_window::run_message_loop();
            }
        })
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use windows::Win32::UI::WindowsAndMessaging::{WM_CLOSE, WM_ENDSESSION, WM_QUERYENDSESSION};

    use super::session_ending;

    #[test]
    fn the_query_and_a_confirmed_end_count_as_the_session_ending() {
        assert!(session_ending(WM_QUERYENDSESSION, 0));
        assert!(session_ending(WM_ENDSESSION, 1));
        assert!(!session_ending(WM_ENDSESSION, 0));
        assert!(!session_ending(WM_CLOSE, 1));
    }
}
