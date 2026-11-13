use tauri::{AppHandle, Emitter};

const FINISHED_EVENT: &str = "recording-finished";

#[expect(dead_code, reason = "macOS has no recorder yet, so the area is not used")]
pub(crate) struct Request {
    pub(crate) x: i32,
    pub(crate) y: i32,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) fps: Option<u32>,
    pub(crate) system_audio: Option<bool>,
    pub(crate) microphone: Option<bool>,
    pub(crate) gif: Option<bool>,
    pub(crate) folder_name: String,
}

#[derive(Clone, serde::Serialize)]
struct Finished {
    summary: Option<()>,
    error: crate::user_error::UserError,
}

pub(crate) fn begin(app: &AppHandle, _request: Request) {
    let _ = app.emit_to(crate::island::WINDOW_LABEL, FINISHED_EVENT, Finished { summary: None, error: crate::user_error::unsupported() });
}

crate::user_error::unsupported_commands!(screen_recording_start, screen_recording_pause, screen_recording_stop, screen_recording_status);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::recording::screen_recording_start,
            crate::recording::screen_recording_pause,
            crate::recording::screen_recording_stop,
            crate::recording::screen_recording_status,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
