crate::user_error::unsupported_commands!(
    get_device_use,
    open_device_privacy_settings,
);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::device_use::get_device_use,
            crate::device_use::open_device_privacy_settings,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
