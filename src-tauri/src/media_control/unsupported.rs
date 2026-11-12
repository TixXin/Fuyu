use serde_json::Value;
use tauri::AppHandle;

pub(crate) fn start_session_events(_app: &AppHandle) {}

pub(crate) fn current_source_icon() -> Option<String> {
    None
}

pub(crate) fn now_playing_key(value: &Value) -> Value {
    value.clone()
}

fn unsupported() -> Result<Value, (u16, String)> {
    Err((501, crate::user_error::unsupported().to_string()))
}

pub(crate) fn plugin_now_playing() -> Result<Value, (u16, String)> {
    unsupported()
}

pub(crate) fn plugin_cover() -> Result<Value, (u16, String)> {
    unsupported()
}

pub(crate) fn plugin_media_command(_method: &str, _params: &Value) -> Result<Value, (u16, String)> {
    unsupported()
}

crate::user_error::unsupported_commands!(
    get_media_state,
    get_audio_level,
    media_play_pause,
    media_next,
    media_previous,
    media_toggle_shuffle,
    media_cycle_repeat,
    media_seek,
    media_set_volume,
);

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::media_control::get_media_state,
            crate::media_control::get_audio_level,
            crate::media_control::media_play_pause,
            crate::media_control::media_next,
            crate::media_control::media_previous,
            crate::media_control::media_toggle_shuffle,
            crate::media_control::media_cycle_repeat,
            crate::media_control::media_seek,
            crate::media_control::media_set_volume,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
