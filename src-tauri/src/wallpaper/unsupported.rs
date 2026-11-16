#[tauri::command]
pub async fn get_wallpapers() -> Option<()> {
    None
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)* crate::wallpaper::get_wallpapers,] $($rest)*)
    };
}
pub(crate) use tauri_commands;
