use base64::Engine;
use std::{
    sync::{mpsc, Mutex, OnceLock, PoisonError},
    thread,
    time::{Duration, Instant},
};
use windows::{
    core::Interface,
    Foundation::TimeSpan,
    Media::{
        Control::{
            GlobalSystemMediaTransportControlsSession as MediaSession,
            GlobalSystemMediaTransportControlsSessionManager as MediaSessionManager,
            GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
        },
        MediaPlaybackAutoRepeatMode as RepeatMode,
    },
    Storage::Streams::{DataReader, IInputStream, IRandomAccessStreamReference},
    Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY,
};

use super::audio::{read_master_volume, read_system_audio_peak, AUDIO_ACTIVE_THRESHOLD};
use super::audio_fallback::{
    discover_fallback_sessions_with_devices, state_from_fallback, FallbackMediaSession,
};
use super::cache::{FallbackCache, FallbackQuery, MetadataCache};
pub(super) use super::players::friendly_app_label;
use super::players::{custom_players_snapshot, normalize_metadata_track, CustomMediaPlayer};
use super::service::*;
pub(super) use super::state::{current_unix_millis, MediaSessionInfo};
use super::timeline_clock::{self, track_key, Published};
use crate::win32::{self, audio::CachedRenderAudio};

pub(super) const MAX_THUMBNAIL_BYTES: u64 = 4_000_000;
pub(super) const WINDOWS_EPOCH_OFFSET_TICKS: i64 = 116_444_736_000_000_000;
const MANAGER_RETRY_COOLDOWN: Duration = Duration::from_secs(3);

pub(super) type CachedThumbnail = (String, Option<String>);

pub(super) static THUMBNAIL_CACHE: OnceLock<Mutex<Option<CachedThumbnail>>> = OnceLock::new();

const MEDIA_CALL_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Default)]
pub(super) struct MediaWorkerState {
    manager: Option<MediaSessionManager>,
    manager_retry_at: Option<Instant>,
    metadata_cache: MetadataCache<Metadata>,
    fallback_cache: FallbackCache<FallbackMediaSession, Vec<CustomMediaPlayer>>,
    pub(super) audio: Option<CachedRenderAudio>,
}

impl MediaWorkerState {
    pub(super) fn manager(&mut self) -> Result<MediaSessionManager, String> {
        if let Some(existing) = self.manager.as_ref() {
            return Ok(existing.clone());
        }
        if let Some(until) = self.manager_retry_at {
            if Instant::now() < until {
                return Err("Windows media session manager is retrying.".to_string());
            }
        }
        match request_manager() {
            Ok(manager) => {
                self.manager_retry_at = None;
                self.manager = Some(manager.clone());
                Ok(manager)
            }
            Err(error) => {
                self.manager_retry_at = Some(Instant::now() + MANAGER_RETRY_COOLDOWN);
                Err(error)
            }
        }
    }

    pub(super) fn invalidate_manager(&mut self) {
        self.manager = None;
    }
}

type MediaJob = Box<dyn FnOnce(&mut MediaWorkerState) + Send + 'static>;

static MEDIA_WORKER: Mutex<Option<mpsc::Sender<MediaJob>>> = Mutex::new(None);

fn spawn_media_worker() -> Result<mpsc::Sender<MediaJob>, String> {
    let (tx, rx) = mpsc::channel::<MediaJob>();
    thread::Builder::new()
        .name("media-com-worker".into())
        .spawn(move || {
            let Ok(_apartment) = win32::com::ComApartment::multithreaded() else {
                return;
            };
            let mut state = MediaWorkerState::default();
            while let Ok(job) = rx.recv() {
                let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    job(&mut state);
                }));
            }
            drop(state);
        })
        .map_err(|error| format!("Could not start the Windows media control thread: {error}"))?;
    Ok(tx)
}

pub(super) fn on_media_thread<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&mut MediaWorkerState) -> Result<T, String> + Send + 'static,
{
    let (reply_tx, reply_rx) = mpsc::channel();
    let job: MediaJob = Box::new(move |state| {
        let _ = reply_tx.send(operation(state));
    });
    let mut guard = MEDIA_WORKER.lock().unwrap_or_else(PoisonError::into_inner);
    let mut pending = Some(job);
    if let Some(worker) = guard.as_ref() {
        match worker.send(pending.take().unwrap_or_else(|| Box::new(|_| {}))) {
            Ok(()) => {}
            Err(error) => {
                pending = Some(error.0);
                *guard = None;
            }
        }
    }
    if let Some(job) = pending {
        let worker = spawn_media_worker()?;
        worker
            .send(job)
            .map_err(|_| "The Windows media control thread exited immediately.".to_string())?;
        *guard = Some(worker);
    }
    drop(guard);
    match reply_rx.recv_timeout(MEDIA_CALL_TIMEOUT) {
        Ok(result) => result,
        Err(mpsc::RecvTimeoutError::Timeout) => {
            *MEDIA_WORKER.lock().unwrap_or_else(PoisonError::into_inner) = None;
            Err("The Windows media control call timed out.".to_string())
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            *MEDIA_WORKER.lock().unwrap_or_else(PoisonError::into_inner) = None;
            Err("The Windows media control thread panicked.".to_string())
        }
    }
}

pub(super) fn request_manager() -> Result<MediaSessionManager, String> {
    let operation = MediaSessionManager::RequestAsync().map_err(|error| {
        media_error("Failed to request the Windows media session manager", error)
    })?;
    pollster::block_on(operation)
        .map_err(|error| media_error("Failed to open the Windows media session manager", error))
}

pub(super) fn resolve_session(
    manager: &MediaSessionManager,
    target: Option<&str>,
) -> Result<Option<MediaSession>, String> {
    if let Some(id) = target.filter(|id| !id.is_empty()) {
        if let Some(session) = session_by_id(manager, id)? {
            return Ok(Some(session));
        }
    }
    target_session(manager)
}

pub(super) fn session_by_id(
    manager: &MediaSessionManager,
    id: &str,
) -> Result<Option<MediaSession>, String> {
    let sessions = manager
        .GetSessions()
        .map_err(|error| media_error("Failed to enumerate Windows media sessions", error))?;

    for index in 0..sessions
        .Size()
        .map_err(|error| media_error("Failed to count Windows media sessions", error))?
    {
        let session = sessions
            .GetAt(index)
            .map_err(|error| media_error("Failed to read a Windows media session", error))?;
        if session_id(&session).as_deref() == Some(id) {
            return Ok(Some(session));
        }
    }

    Ok(None)
}

pub(super) fn target_session(
    manager: &MediaSessionManager,
) -> Result<Option<MediaSession>, String> {
    let current_session = manager.GetCurrentSession().ok();

    if current_session.as_ref().is_some_and(is_playing) {
        return Ok(current_session);
    }

    let sessions = manager
        .GetSessions()
        .map_err(|error| media_error("Failed to enumerate Windows media sessions", error))?;
    let mut first_session = None;

    for index in 0..sessions
        .Size()
        .map_err(|error| media_error("Failed to count Windows media sessions", error))?
    {
        let session = sessions
            .GetAt(index)
            .map_err(|error| media_error("Failed to read a Windows media session", error))?;

        if first_session.is_none() {
            first_session = Some(session.clone());
        }

        if is_playing(&session) {
            return Ok(Some(session));
        }
    }

    Ok(current_session.or(first_session))
}

pub(super) fn list_sessions(manager: &MediaSessionManager) -> Vec<MediaSessionInfo> {
    let mut entries = Vec::new();
    let Ok(sessions) = manager.GetSessions() else {
        return entries;
    };
    let Ok(size) = sessions.Size() else {
        return entries;
    };

    for index in 0..size {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        let Some(id) = session_id(&session) else {
            continue;
        };
        if entries
            .iter()
            .any(|entry: &MediaSessionInfo| entry.id == id)
        {
            continue;
        }
        entries.push(MediaSessionInfo {
            label: friendly_app_label(&id),
            id,
            playing: is_playing(&session),
        });
    }

    entries
}

pub(super) fn session_id(session: &MediaSession) -> Option<String> {
    session
        .SourceAppUserModelId()
        .ok()
        .map(|value| value.to_string())
        .filter(|value| !value.is_empty())
}

pub(super) fn is_playing(session: &MediaSession) -> bool {
    session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .is_ok_and(|status| status == PlaybackStatus::Playing)
}

pub(super) fn run_play_pause(session: &MediaSession) -> Result<bool, String> {
    let status = session
        .GetPlaybackInfo()
        .and_then(|info| info.PlaybackStatus())
        .map_err(|error| media_error("Failed to read the active media playback state", error))?;

    if status == PlaybackStatus::Playing {
        let operation = session
            .TryPauseAsync()
            .map_err(|error| media_error("Failed to request media pause", error))?;
        pollster::block_on(operation).map_err(|error| media_error("Failed to pause media", error))
    } else {
        let operation = session
            .TryPlayAsync()
            .map_err(|error| media_error("Failed to request media playback", error))?;
        pollster::block_on(operation).map_err(|error| media_error("Failed to play media", error))
    }
}

pub(super) fn run_toggle_shuffle(session: &MediaSession) -> Result<bool, String> {
    let current = session
        .GetPlaybackInfo()
        .ok()
        .and_then(|info| info.IsShuffleActive().ok())
        .and_then(|value| value.Value().ok())
        .unwrap_or(false);
    let operation = session
        .TryChangeShuffleActiveAsync(!current)
        .map_err(|error| media_error("Failed to request shuffle", error))?;
    pollster::block_on(operation).map_err(|error| media_error("Failed to change shuffle", error))
}

pub(super) fn run_cycle_repeat(session: &MediaSession) -> Result<bool, String> {
    let current = session
        .GetPlaybackInfo()
        .ok()
        .and_then(|info| info.AutoRepeatMode().ok())
        .and_then(|value| value.Value().ok())
        .unwrap_or(RepeatMode::None);
    let next = match current {
        RepeatMode::None => RepeatMode::List,
        RepeatMode::List => RepeatMode::Track,
        _ => RepeatMode::None,
    };
    let operation = session
        .TryChangeAutoRepeatModeAsync(next)
        .map_err(|error| media_error("Failed to request repeat mode", error))?;
    pollster::block_on(operation)
        .map_err(|error| media_error("Failed to change repeat mode", error))
}

pub(super) fn run_session_command(
    session: &MediaSession,
    command: MediaCommand,
) -> Result<bool, String> {
    match command {
        MediaCommand::PlayPause => run_play_pause(session),
        MediaCommand::Next => pollster::block_on(
            session
                .TrySkipNextAsync()
                .map_err(|error| media_error("Failed to request the next track", error))?,
        )
        .map_err(|error| media_error("Failed to change to the next track", error)),
        MediaCommand::Previous => pollster::block_on(
            session
                .TrySkipPreviousAsync()
                .map_err(|error| media_error("Failed to request the previous track", error))?,
        )
        .map_err(|error| media_error("Failed to change to the previous track", error)),
        MediaCommand::ToggleShuffle => run_toggle_shuffle(session),
        MediaCommand::CycleRepeat => run_cycle_repeat(session),
    }
}

pub(super) fn send_media_key(key: VIRTUAL_KEY) {
    win32::input::send_key_down(key);
    thread::sleep(Duration::from_millis(80));
    win32::input::send_key_up(key);
}

pub(super) fn read_media_state(
    state: &mut MediaWorkerState,
    target: Option<&str>,
) -> Result<MediaState, String> {
    let manager = match state.manager() {
        Ok(manager) => manager,
        Err(_) => return read_media_state_without_session(state),
    };
    match read_media_state_from_manager(state, &manager, target) {
        Ok(media_state) => Ok(media_state),
        Err(_) => {
            state.invalidate_manager();
            match state.manager() {
                Ok(fresh) => read_media_state_from_manager(state, &fresh, target),
                Err(_) => read_media_state_without_session(state),
            }
        }
    }
}

pub(super) fn read_media_state_from_manager(
    state: &mut MediaWorkerState,
    manager: &MediaSessionManager,
    target: Option<&str>,
) -> Result<MediaState, String> {
    let now_ms = current_unix_millis();
    let audio_peak = read_system_audio_peak(&mut state.audio).unwrap_or(0.0);
    let audio_active = audio_peak > AUDIO_ACTIVE_THRESHOLD;
    let volume = read_master_volume(&mut state.audio).unwrap_or(-1.0);
    let smtc_sessions = list_sessions(manager);
    let resolved = resolve_session(manager, target)?;
    let smtc_playing = resolved.as_ref().is_some_and(is_playing);
    let target_id = target.filter(|id| !id.is_empty());
    let target_needs_fallback =
        target_id.is_some_and(|id| !smtc_sessions.iter().any(|session| session.id == id));
    let query = FallbackQuery {
        smtc_playing,
        target_needs_fallback,
        audio_active,
        config_key: custom_players_snapshot(),
        now_ms,
    };
    let devices_ref = state.audio.as_ref().map(|cached| cached.devices());
    let fallback_sessions = state.fallback_cache.resolve(
        query,
        |entry| entry.playing,
        || discover_fallback_sessions_with_devices(devices_ref, &smtc_sessions, now_ms),
    );

    let mut sessions = smtc_sessions;
    for entry in &fallback_sessions {
        if !sessions.iter().any(|existing| existing.id == entry.id) {
            sessions.push(MediaSessionInfo {
                id: entry.id.clone(),
                label: entry.label.clone(),
                playing: entry.playing,
            });
        }
    }

    if let Some(target_id) = target_id {
        if let Some(fallback) = fallback_sessions.iter().find(|entry| entry.id == target_id) {
            return Ok(state_from_fallback(fallback, sessions, volume, now_ms));
        }
    }

    if !smtc_playing {
        if let Some(playing_fallback) = fallback_sessions.iter().find(|entry| entry.playing) {
            return Ok(state_from_fallback(playing_fallback, sessions, volume, now_ms));
        }
    }

    let Some(session) = resolved else {
        if let Some(fallback) = fallback_sessions.first() {
            return Ok(state_from_fallback(fallback, sessions, volume, now_ms));
        }
        return Ok(MediaState {
            available: false,
            audio_active,
            audio_peak,
            playback_status: if audio_active {
                "playing"
            } else {
                "unavailable"
            },
            volume,
            sessions,
            ..MediaState::empty()
        });
    };

    let source_app = session_id(&session);
    let playback_info = session
        .GetPlaybackInfo()
        .map_err(|error| media_error("Failed to read Windows media playback information", error))?;
    let playback_status = playback_info
        .PlaybackStatus()
        .map_err(|error| media_error("Failed to read Windows media playback status", error))?;
    let is_playing = playback_status == PlaybackStatus::Playing;

    let controls = playback_info.Controls().ok();
    let can_next = controls
        .as_ref()
        .and_then(|controls| controls.IsNextEnabled().ok())
        .unwrap_or(false);
    let can_previous = controls
        .as_ref()
        .and_then(|controls| controls.IsPreviousEnabled().ok())
        .unwrap_or(false);
    let can_seek = controls
        .as_ref()
        .and_then(|controls| controls.IsPlaybackPositionEnabled().ok())
        .unwrap_or(false);
    let can_shuffle = controls
        .as_ref()
        .and_then(|controls| controls.IsShuffleEnabled().ok())
        .unwrap_or(false);
    let can_repeat = controls
        .as_ref()
        .and_then(|controls| controls.IsRepeatEnabled().ok())
        .unwrap_or(false);

    let shuffle_active = playback_info
        .IsShuffleActive()
        .ok()
        .and_then(|value| value.Value().ok());
    let repeat_mode = playback_info
        .AutoRepeatMode()
        .ok()
        .and_then(|value| value.Value().ok())
        .map(repeat_mode_label)
        .unwrap_or("unknown");

    let playback_rate = playback_info
        .PlaybackRate()
        .ok()
        .and_then(|value| value.Value().ok())
        .unwrap_or(1.0);

    let epoch = super::events::metadata_epoch();
    let events_on = super::events::running();
    let Metadata {
        title,
        artist,
        album,
        thumbnail,
        track_id,
    } = if let Some(cached) =
        state
            .metadata_cache
            .get(source_app.as_deref(), epoch, events_on, now_ms)
    {
        cached
    } else {
        let fresh = read_metadata(&session, source_app.as_deref());
        state.metadata_cache.put(
            source_app.as_deref(),
            epoch,
            now_ms,
            fresh.title.is_some(),
            fresh.thumbnail.is_some(),
            fresh.clone(),
        );
        fresh
    };

    let (position_ms, duration_ms) =
        read_timeline(&session, is_playing, playback_rate, |duration_ms| {
            (
                source_app.clone().unwrap_or_default(),
                track_key(
                    title.as_deref(),
                    artist.as_deref(),
                    album.as_deref(),
                    duration_ms,
                ),
            )
        });

    Ok(MediaState {
        available: true,
        audio_active,
        audio_peak,
        playback_status: if is_playing { "playing" } else { "paused" },
        title,
        artist,
        album,
        thumbnail,
        track_id,
        position_ms,
        duration_ms,
        can_seek,
        can_next,
        can_previous,
        shuffle_active,
        can_shuffle,
        repeat_mode,
        can_repeat,
        volume,
        source_app,
        active_session_id: session_id(&session),
        sessions,
        updated_at: now_ms,
    })
}

pub(super) fn read_media_state_without_session(
    state: &mut MediaWorkerState,
) -> Result<MediaState, String> {
    let now_ms = current_unix_millis();
    let audio_peak = read_system_audio_peak(&mut state.audio).unwrap_or(0.0);
    let audio_active = audio_peak > AUDIO_ACTIVE_THRESHOLD;
    let volume = read_master_volume(&mut state.audio).unwrap_or(-1.0);
    let query = FallbackQuery {
        smtc_playing: false,
        target_needs_fallback: false,
        audio_active,
        config_key: custom_players_snapshot(),
        now_ms,
    };
    let devices_ref = state.audio.as_ref().map(|cached| cached.devices());
    let fallback_sessions = state.fallback_cache.resolve(
        query,
        |entry| entry.playing,
        || discover_fallback_sessions_with_devices(devices_ref, &[], now_ms),
    );
    if let Some(fallback) = fallback_sessions
        .iter()
        .find(|entry| entry.playing)
        .or_else(|| fallback_sessions.first())
    {
        let sessions = fallback_sessions
            .iter()
            .map(|entry| MediaSessionInfo {
                id: entry.id.clone(),
                label: entry.label.clone(),
                playing: entry.playing,
            })
            .collect();
        return Ok(state_from_fallback(fallback, sessions, volume, now_ms));
    }

    Ok(MediaState {
        available: false,
        audio_active,
        audio_peak,
        playback_status: if audio_active {
            "playing"
        } else {
            "unavailable"
        },
        volume,
        ..MediaState::empty()
    })
}

pub(super) fn read_timeline(
    session: &MediaSession,
    is_playing: bool,
    playback_rate: f64,
    identify: impl FnOnce(i64) -> (String, String),
) -> (i64, i64) {
    let Ok(timeline) = session.GetTimelineProperties() else {
        return (0, 0);
    };

    let start = timeline.StartTime().map(ticks_to_ms).unwrap_or(0);
    let end = timeline.EndTime().map(ticks_to_ms).unwrap_or(0);
    let position = timeline.Position().map(ticks_to_ms).unwrap_or(0);
    let duration = (end - start).max(0);
    if duration == 0 {
        return (0, 0);
    }

    let updated_ms = timeline
        .LastUpdatedTime()
        .ok()
        .map(|time| (time.UniversalTime - WINDOWS_EPOCH_OFFSET_TICKS) / 10_000)
        .filter(|updated| *updated > 0);
    let published = Published {
        position_ms: (position - start).clamp(0, duration),
        updated_ms,
        rate: playback_rate,
        duration_ms: duration,
    };
    let (session_key, track) = identify(duration);
    let elapsed = timeline_clock::sample(
        &session_key,
        &track,
        published,
        is_playing,
        current_unix_millis(),
    );
    (elapsed, duration)
}

#[derive(Clone, Default)]
pub(super) struct Metadata {
    pub(super) title: Option<String>,
    pub(super) artist: Option<String>,
    pub(super) album: Option<String>,
    pub(super) thumbnail: Option<String>,
    pub(super) track_id: Option<String>,
}

pub(super) fn player_track_id(genres: impl IntoIterator<Item = String>) -> Option<String> {
    genres
        .into_iter()
        .map(|genre| genre.trim().to_string())
        .find(|genre| {
            genre
                .strip_prefix("NCM-")
                .or_else(|| genre.strip_prefix("QQ-"))
                .is_some_and(|id| !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric()))
        })
}

pub(super) fn read_metadata(session: &MediaSession, source_app: Option<&str>) -> Metadata {
    let Ok(operation) = session.TryGetMediaPropertiesAsync() else {
        return Metadata::default();
    };
    let Ok(properties) = pollster::block_on(operation) else {
        return Metadata::default();
    };

    let raw_title = non_empty(properties.Title().ok().map(|value| value.to_string()));
    let raw_artist = non_empty(properties.Artist().ok().map(|value| value.to_string()));
    let (title, artist) = normalize_metadata_track(raw_title, raw_artist, source_app);
    let album = non_empty(properties.AlbumTitle().ok().map(|value| value.to_string()));
    let thumbnail = cached_thumbnail(source_app, title.as_deref(), artist.as_deref(), || {
        properties.Thumbnail().ok()
    });

    let track_id = properties
        .Genres()
        .ok()
        .and_then(|genres| player_track_id(genres.into_iter().map(|genre| genre.to_string())));

    Metadata {
        title,
        artist,
        album,
        thumbnail,
        track_id,
    }
}

pub(super) fn cached_thumbnail(
    source_app: Option<&str>,
    title: Option<&str>,
    artist: Option<&str>,
    read_reference: impl FnOnce() -> Option<IRandomAccessStreamReference>,
) -> Option<String> {
    let key = format!(
        "{}|{}|{}",
        source_app.unwrap_or_default(),
        title.unwrap_or_default(),
        artist.unwrap_or_default()
    );
    let cache = THUMBNAIL_CACHE.get_or_init(|| Mutex::new(None));

    if let Ok(guard) = cache.lock() {
        if let Some((cached_key, cached_value)) = guard.as_ref() {
            if *cached_key == key {
                return cached_value.clone();
            }
        }
    }

    let value = read_reference().and_then(|reference| read_thumbnail(&reference));

    if let Ok(mut guard) = cache.lock() {
        *guard = Some((key, value.clone()));
    }

    value
}

pub(super) fn read_thumbnail(reference: &IRandomAccessStreamReference) -> Option<String> {
    let stream = pollster::block_on(reference.OpenReadAsync().ok()?).ok()?;
    let size = stream.Size().ok()?;
    if size == 0 || size > MAX_THUMBNAIL_BYTES {
        return None;
    }

    let input: IInputStream = stream.cast().ok()?;
    let reader = DataReader::CreateDataReader(&input).ok()?;
    let loaded = pollster::block_on(reader.LoadAsync(size as u32).ok()?).ok()?;
    let mut buffer = vec![0u8; loaded as usize];
    reader.ReadBytes(&mut buffer).ok()?;
    if buffer.is_empty() {
        return None;
    }

    let mime = detect_image_mime(&buffer);
    let encoded = base64::engine::general_purpose::STANDARD.encode(&buffer);
    Some(format!("data:{mime};base64,{encoded}"))
}

pub(super) fn detect_image_mime(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "image/jpeg"
    } else if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "image/png"
    } else if bytes.starts_with(b"GIF8") {
        "image/gif"
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        "image/webp"
    } else if bytes.starts_with(&[0x42, 0x4D]) {
        "image/bmp"
    } else {
        "image/jpeg"
    }
}

pub(super) fn repeat_mode_label(mode: RepeatMode) -> &'static str {
    match mode {
        RepeatMode::None => "none",
        RepeatMode::Track => "track",
        RepeatMode::List => "list",
        _ => "unknown",
    }
}

pub(super) fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(super) fn ticks_to_ms(span: TimeSpan) -> i64 {
    span.Duration / 10_000
}

pub(super) fn media_error(context: &str, error: windows::core::Error) -> String {
    format!("{context}: {error}")
}

#[cfg(test)]
mod tests {
    use super::player_track_id;

    #[test]
    fn a_player_plugin_names_the_song_among_the_genres() {
        let genres =
            |list: &[&str]| list.iter().map(|genre| genre.to_string()).collect::<Vec<_>>();
        assert_eq!(
            player_track_id(genres(&["流行", "NCM-487885426"])).as_deref(),
            Some("NCM-487885426")
        );
        assert_eq!(
            player_track_id(genres(&["QQ-002Abc"])).as_deref(),
            Some("QQ-002Abc")
        );
        assert_eq!(
            player_track_id(genres(&["Pop", "NCM-", "NCM-12 34"])),
            None
        );
        assert_eq!(player_track_id(Vec::new()), None);
    }
}
