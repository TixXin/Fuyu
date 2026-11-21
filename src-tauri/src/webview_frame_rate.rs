use tauri::Webview;

#[tauri::command]
pub async fn set_webview_follow_display_rate(webview: Webview, follow: bool) {
    #[cfg(target_os = "macos")]
    crate::macos::webview_frame_rate::follow_display_rate(&webview, follow);
    #[cfg(not(target_os = "macos"))]
    let _ = (webview, follow);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::webview_frame_rate::set_webview_follow_display_rate,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
