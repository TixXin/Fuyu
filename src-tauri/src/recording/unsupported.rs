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
