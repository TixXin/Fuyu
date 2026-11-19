use plugin_base::{host_service, ServeError};
use serde::Serialize;

use super::service::{self, MediaCommand, MediaState};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
#[serde(rename_all = "camelCase")]
pub(crate) struct NowPlaying {
    available: bool,
    playing: bool,
    audible: bool,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    source_app: Option<String>,
    source_frontmost: bool,
    #[cfg_attr(test, ts(type = "number"))]
    position_ms: i64,
    #[cfg_attr(test, ts(type = "number"))]
    duration_ms: i64,
    can_seek: bool,
    can_next: bool,
    can_previous: bool,
    #[cfg_attr(test, ts(type = "number"))]
    updated_at: i64,
}

impl From<MediaState> for NowPlaying {
    fn from(state: MediaState) -> Self {
        Self {
            available: state.available,
            playing: state.playback_status == "playing",
            audible: state.audio_active,
            title: state.title,
            artist: state.artist,
            album: state.album,
            source_frontmost: false,
            source_app: state.source_app,
            position_ms: state.position_ms,
            duration_ms: state.duration_ms,
            can_seek: state.can_seek,
            can_next: state.can_next,
            can_previous: state.can_previous,
            updated_at: state.updated_at,
        }
    }
}

fn switched_on() -> Result<(), ServeError> {
    if super::is_enabled() {
        Ok(())
    } else {
        Err(ServeError::new("inactive", "The music plugin is switched off."))
    }
}

fn with_frontmost(state: MediaState) -> NowPlaying {
    let mut now = NowPlaying::from(state);
    now.source_frontmost = now.source_app.as_deref().is_some_and(super::source_app::is_frontmost);
    now
}

fn answer(state: Result<MediaState, String>) -> Result<NowPlaying, ServeError> {
    state.map(with_frontmost).map_err(|error| ServeError::new("failed", error))
}

fn command(command: MediaCommand) -> Result<NowPlaying, ServeError> {
    switched_on()?;
    answer(service::run_command(command, None))
}

#[host_service("media.nowPlaying")]
fn now_playing_for_host() -> Result<NowPlaying, ServeError> {
    switched_on()?;
    answer(service::get_state(None))
}

#[host_service("media.playPause")]
fn play_pause_for_host() -> Result<NowPlaying, ServeError> {
    command(MediaCommand::PlayPause)
}

#[host_service("media.next")]
fn next_for_host() -> Result<NowPlaying, ServeError> {
    command(MediaCommand::Next)
}

#[host_service("media.previous")]
fn previous_for_host() -> Result<NowPlaying, ServeError> {
    command(MediaCommand::Previous)
}

#[host_service("media.seek")]
fn seek_for_host(position_ms: i64) -> Result<NowPlaying, ServeError> {
    if position_ms < 0 {
        return Err(ServeError::bad_params("media.seek", "positionMs must be a whole number of milliseconds from 0"));
    }
    switched_on()?;
    answer(service::seek(position_ms, None))
}
