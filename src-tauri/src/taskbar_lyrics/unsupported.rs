#[tauri::command]
pub fn set_taskbar_lyrics(open: bool) {
    let _ = open;
}

#[tauri::command]
pub fn show_taskbar_lyrics(shown: bool) {
    let _ = shown;
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::taskbar_lyrics::set_taskbar_lyrics,
            crate::taskbar_lyrics::show_taskbar_lyrics,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
