#[cfg(target_os = "macos")]
mod adapter_macos;
#[cfg(target_os = "macos")]
mod applescript_macos;
#[cfg(windows)]
mod audio;
#[cfg(windows)]
mod audio_fallback;
mod background;
#[cfg_attr(target_os = "macos", path = "events_macos.rs")]
mod events;
mod host;
mod players;
mod plugin_view;
#[cfg_attr(target_os = "macos", path = "service_macos.rs")]
mod service;
#[cfg(windows)]
mod session;
#[cfg_attr(target_os = "macos", path = "source_icon_macos.rs")]
mod source_icon;
mod state;
mod timeline_clock;

pub use players::CustomMediaPlayer;
pub(crate) use plugin_view::{now_playing_key, plugin_cover, plugin_media_command, plugin_now_playing};
pub(crate) use source_icon::current_source_icon;

pub(crate) const PLUGIN_ID: &str = "music";

pub(crate) fn is_enabled() -> bool {
    crate::plugin_kernel::builtins::is_enabled(PLUGIN_ID)
}

pub(crate) fn init(app: &tauri::AppHandle) {
    players::init_custom_players(app);
    background::register(app);
}

fn switched_on() -> Result<(), String> {
    if is_enabled() {
        Ok(())
    } else {
        Err("Music is switched off in Fuyu.".to_string())
    }
}

#[tauri::command]
pub async fn get_media_state(target: Option<String>) -> Result<service::MediaState, String> {
    if !is_enabled() {
        return Ok(service::MediaState::empty());
    }
    tauri::async_runtime::spawn_blocking(move || service::get_state(target))
        .await
        .map_err(|error| format!("Failed to join the media state task: {error}"))?
}

#[tauri::command]
pub async fn get_audio_level() -> Result<service::AudioLevel, String> {
    if !is_enabled() {
        return Ok(service::AudioLevel::silent());
    }
    tauri::async_runtime::spawn_blocking(service::get_audio_level)
        .await
        .map_err(|error| format!("Failed to join the audio level task: {error}"))?
}

#[tauri::command]
pub async fn media_play_pause(target: Option<String>) -> Result<service::MediaState, String> {
    run_media_command(service::MediaCommand::PlayPause, target).await
}

#[tauri::command]
pub async fn media_next(target: Option<String>) -> Result<service::MediaState, String> {
    run_media_command(service::MediaCommand::Next, target).await
}

#[tauri::command]
pub async fn media_previous(target: Option<String>) -> Result<service::MediaState, String> {
    run_media_command(service::MediaCommand::Previous, target).await
}

#[tauri::command]
pub async fn media_toggle_shuffle(target: Option<String>) -> Result<service::MediaState, String> {
    run_media_command(service::MediaCommand::ToggleShuffle, target).await
}

#[tauri::command]
pub async fn media_cycle_repeat(target: Option<String>) -> Result<service::MediaState, String> {
    run_media_command(service::MediaCommand::CycleRepeat, target).await
}

#[tauri::command]
pub async fn media_seek(
    position_ms: i64,
    target: Option<String>,
) -> Result<service::MediaState, String> {
    switched_on()?;
    tauri::async_runtime::spawn_blocking(move || service::seek(position_ms, target))
        .await
        .map_err(|error| format!("Failed to join the media seek task: {error}"))?
}

#[tauri::command]
pub async fn media_set_volume(level: f32) -> Result<service::MediaState, String> {
    switched_on()?;
    tauri::async_runtime::spawn_blocking(move || service::set_volume(level))
        .await
        .map_err(|error| format!("Failed to join the media volume task: {error}"))?
}

#[tauri::command]
pub async fn get_custom_media_players(
    app: tauri::AppHandle,
) -> Result<Vec<CustomMediaPlayer>, String> {
    tauri::async_runtime::spawn_blocking(move || players::get_custom_players(&app))
        .await
        .map_err(|error| format!("Failed to join the custom media players task: {error}"))?
}

#[tauri::command]
pub async fn add_custom_media_player(
    app: tauri::AppHandle,
    id: String,
    label: Option<String>,
) -> Result<Vec<CustomMediaPlayer>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        players::add_custom_player(&app, &id, label.as_deref())
    })
    .await
    .map_err(|error| format!("Failed to join the add custom media player task: {error}"))?
}

#[tauri::command]
pub async fn remove_custom_media_player(
    app: tauri::AppHandle,
    id: String,
) -> Result<Vec<CustomMediaPlayer>, String> {
    tauri::async_runtime::spawn_blocking(move || players::remove_custom_player(&app, &id))
        .await
        .map_err(|error| format!("Failed to join the remove custom media player task: {error}"))?
}

#[tauri::command]
pub async fn list_media_player_candidates() -> Result<Vec<CustomMediaPlayer>, String> {
    tauri::async_runtime::spawn_blocking(service::list_candidates)
        .await
        .map_err(|error| format!("Failed to join the media player candidates task: {error}"))
}

async fn run_media_command(
    command: service::MediaCommand,
    target: Option<String>,
) -> Result<service::MediaState, String> {
    switched_on()?;
    tauri::async_runtime::spawn_blocking(move || service::run_command(command, target))
        .await
        .map_err(|error| format!("Failed to join the media command task: {error}"))?
}

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
            crate::media_control::get_custom_media_players,
            crate::media_control::add_custom_media_player,
            crate::media_control::remove_custom_media_player,
            crate::media_control::list_media_player_candidates,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
