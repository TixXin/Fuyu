use std::{thread, time::Duration};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    VIRTUAL_KEY, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
};

use super::audio::{read_system_audio_peak, set_master_volume, AUDIO_ACTIVE_THRESHOLD};
use super::session::*;
pub(crate) use super::state::{AudioLevel, MediaCommand, MediaState};

pub(crate) fn get_state(target: Option<String>) -> Result<MediaState, String> {
    on_media_thread(move || read_media_state(target.as_deref()))
}

pub(crate) fn get_audio_level() -> Result<AudioLevel, String> {
    on_media_thread(|| {
        let peak = read_system_audio_peak()?;
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
    on_media_thread(move || {
        if let Some(id) = target.as_deref() {
            let manager = request_manager()?;
            let session = session_by_id(&manager, id)?
                .ok_or_else(|| "The selected media source is no longer available.".to_string())?;
            if run_session_command(&session, command)? {
                thread::sleep(Duration::from_millis(40));
                return read_media_state_from_manager(&manager, Some(id));
            }
            return Err("The selected media source did not accept the command.".to_string());
        }

        if let Ok(manager) = request_manager() {
            if let Ok(Some(session)) = target_session(&manager) {
                if run_session_command(&session, command).unwrap_or(false) {
                    thread::sleep(Duration::from_millis(40));
                    return read_media_state_from_manager(&manager, None);
                }
            }
        }

        if let Some(key_command) = command.as_media_key() {
            send_media_key(key_command);
            thread::sleep(Duration::from_millis(80));
        }
        read_media_state(None)
    })
}

pub(crate) fn seek(position_ms: i64, target: Option<String>) -> Result<MediaState, String> {
    on_media_thread(move || {
        let manager = request_manager()?;
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
            thread::sleep(Duration::from_millis(40));
            read_media_state_from_manager(&manager, target.as_deref())
        } else {
            Err("The media source did not accept the seek.".to_string())
        }
    })
}

pub(crate) fn set_volume(level: f32) -> Result<MediaState, String> {
    on_media_thread(move || {
        set_master_volume(level)?;
        read_media_state(None)
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
