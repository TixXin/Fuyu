crate::user_error::unsupported_commands!(screen_recording_start, screen_recording_pause, screen_recording_stop);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::recording::screen_recording_start,
            crate::recording::screen_recording_pause,
            crate::recording::screen_recording_stop,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
