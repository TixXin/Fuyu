use std::{thread, time::Duration};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    VIRTUAL_KEY, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
};

use super::audio::{read_system_audio_peak, set_master_volume, AUDIO_ACTIVE_THRESHOLD};
use super::audio_fallback::{
    discover_fallback_sessions_with_devices, list_candidates as fallback_candidates,
};
use super::players::CustomMediaPlayer;
use super::session::*;
pub(crate) use super::state::{AudioLevel, MediaCommand, MediaState};
use super::timeline_clock;

pub(crate) fn list_candidates() -> Vec<CustomMediaPlayer> {
    on_media_thread(|state| {
        let devices = state.audio.as_ref().map(|cached| cached.devices());
        Ok(fallback_candidates(devices))
    })
    .unwrap_or_default()
}

pub(crate) fn get_state(target: Option<String>) -> Result<MediaState, String> {
    on_media_thread(move |state| read_media_state(state, target.as_deref()))
}

pub(crate) fn get_audio_level() -> Result<AudioLevel, String> {
    on_media_thread(|state| {
        let peak = read_system_audio_peak(&mut state.audio)?;
        Ok(AudioLevel {
            active: peak > AUDIO_ACTIVE_THRESHOLD,
            peak,
            updated_at: current_unix_millis(),
        })
    })
}

pub(crate) fn run_command(
    command: MediaCommand,
    target: Option<String>,
) -> Result<MediaState, String> {
    on_media_thread(move |state| {
        let is_track_skip = matches!(command, MediaCommand::Next | MediaCommand::Previous);
        if let Some(id) = target.as_deref() {
            let manager = state.manager()?;
            if let Some(session) = session_by_id(&manager, id)? {
                if run_session_command(&session, command)? {
                    if is_track_skip {
                        super::events::bump_metadata_epoch();
                    }
                    thread::sleep(Duration::from_millis(40));
                    return read_media_state_from_manager(state, &manager, Some(id));
                }
                return Err("The selected media source did not accept the command.".to_string());
            }
            let fallbacks = discover_fallback_sessions_with_devices(
                state.audio.as_ref().map(|cached| cached.devices()),
                &list_sessions(&manager),
                current_unix_millis(),
            );
            if fallbacks.iter().any(|entry| entry.id == id) {
                let key_command = command.as_media_key().ok_or_else(|| {
                    "This player cannot change shuffle or repeat from Fuyu.".to_string()
                })?;
                send_media_key(key_command);
                thread::sleep(Duration::from_millis(80));
                return read_media_state_from_manager(state, &manager, Some(id));
            }
            return Err("The selected media source is no longer available.".to_string());
        }

        if let Ok(manager) = state.manager() {
            if let Ok(Some(session)) = target_session(&manager) {
                if run_session_command(&session, command).unwrap_or(false) {
                    if is_track_skip {
                        super::events::bump_metadata_epoch();
                    }
                    thread::sleep(Duration::from_millis(40));
                    return read_media_state_from_manager(state, &manager, None);
                }
            }
        }

        if let Some(key_command) = command.as_media_key() {
            send_media_key(key_command);
            if is_track_skip {
                super::events::bump_metadata_epoch();
            }
            thread::sleep(Duration::from_millis(80));
        }
        read_media_state(state, None)
    })
}

pub(crate) fn seek(position_ms: i64, target: Option<String>) -> Result<MediaState, String> {
    on_media_thread(move |state| {
        let manager = state.manager()?;
        let session = match target.as_deref() {
            Some(id) => session_by_id(&manager, id)?
                .ok_or_else(|| "The selected media source is no longer available.".to_string())?,
            None => target_session(&manager)?
                .ok_or_else(|| "No media is currently playing.".to_string())?,
        };

        let start_ms = session
            .GetTimelineProperties()
            .ok()
            .and_then(|timeline| timeline.StartTime().ok())
            .map(ticks_to_ms)
            .unwrap_or(0);
        let ticks = (start_ms + position_ms.max(0)).saturating_mul(10_000);
        let operation = session
            .TryChangePlaybackPositionAsync(ticks)
            .map_err(|error| media_error("Failed to request the seek", error))?;
        if pollster::block_on(operation).unwrap_or(false) {
            timeline_clock::seeked(
                session_id(&session).as_deref(),
                position_ms.max(0),
                current_unix_millis(),
            );
            thread::sleep(Duration::from_millis(40));
            read_media_state_from_manager(state, &manager, target.as_deref())
        } else {
            Err("The media source did not accept the seek.".to_string())
        }
    })
}

pub(crate) fn set_volume(level: f32) -> Result<MediaState, String> {
    on_media_thread(move |state| {
        set_master_volume(&mut state.audio, level)?;
        read_media_state(state, None)
    })
}

impl MediaCommand {
    pub(super) fn as_media_key(self) -> Option<VIRTUAL_KEY> {
        match self {
            MediaCommand::PlayPause => Some(VK_MEDIA_PLAY_PAUSE),
            MediaCommand::Next => Some(VK_MEDIA_NEXT_TRACK),
            MediaCommand::Previous => Some(VK_MEDIA_PREV_TRACK),
            MediaCommand::ToggleShuffle | MediaCommand::CycleRepeat => None,
        }
    }
}
