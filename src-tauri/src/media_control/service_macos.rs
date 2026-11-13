use serde_json::{Map, Value};

use super::adapter_macos::{self as adapter, Snapshot};
use super::applescript_macos::{self as applescript, Track};
pub(crate) use super::state::{AudioLevel, MediaCommand, MediaSessionInfo, MediaState};
use super::state::current_unix_millis;
use crate::macos::audio;

const MAX_ARTWORK_BASE64: usize = 5_400_000;
const PLAYING_PEAK: f32 = 0.4;

fn text(info: &Map<String, Value>, key: &str) -> Option<String> {
    info.get(key).and_then(Value::as_str).map(str::trim).filter(|text| !text.is_empty()).map(str::to_string)
}

fn number(info: &Map<String, Value>, key: &str) -> Option<f64> {
    info.get(key).and_then(Value::as_f64).filter(|value| value.is_finite())
}

fn timestamp_ms(info: &Map<String, Value>) -> Option<i64> {
    let stamp = text(info, "timestamp")?;
    chrono::DateTime::parse_from_rfc3339(&stamp).ok().map(|time| time.timestamp_millis())
}

pub(super) fn position_ms(info: &Map<String, Value>, playing: bool, fallback_ms: i64, now_ms: i64) -> i64 {
    let elapsed = number(info, "elapsedTime").unwrap_or(0.0) * 1000.0;
    let rate = number(info, "playbackRate").unwrap_or(1.0);
    let since = timestamp_ms(info).unwrap_or(fallback_ms);
    let moved = if playing { (now_ms - since).max(0) as f64 * rate } else { 0.0 };
    let duration = number(info, "duration").map(|seconds| seconds * 1000.0);
    let position = (elapsed + moved).max(0.0);
    duration.filter(|duration| *duration > 0.0).map_or(position, |duration| position.min(duration)) as i64
}

pub(super) fn repeat_label(mode: Option<f64>) -> &'static str {
    match mode.map(|mode| mode as i64) {
        Some(1) => "none",
        Some(2) => "track",
        Some(3) => "list",
        _ => "unknown",
    }
}

fn artwork(info: &Map<String, Value>) -> Option<String> {
    let data = text(info, "artworkData").filter(|data| data.len() <= MAX_ARTWORK_BASE64)?;
    let mime = text(info, "artworkMimeType").unwrap_or_else(|| "image/jpeg".to_string());
    Some(format!("data:{mime};base64,{data}"))
}

fn volume() -> f32 {
    audio::default_output().and_then(audio::volume).unwrap_or(-1.0)
}

fn from_fuyu(info: &Map<String, Value>) -> bool {
    let own = std::process::id();
    info.get("processIdentifier")
        .and_then(Value::as_i64)
        .and_then(|pid| i32::try_from(pid).ok())
        .is_some_and(|pid| u32::try_from(crate::macos::apps::responsible_pid(pid)).ok() == Some(own))
}

fn from_snapshot(snapshot: &Snapshot) -> MediaState {
    let info = &snapshot.info;
    let Some(title) = text(info, "title").filter(|_| !from_fuyu(info)) else {
        return MediaState { volume: volume(), ..MediaState::empty() };
    };
    let playing = info.get("playing").and_then(Value::as_bool).unwrap_or(false);
    let source = text(info, "parentApplicationBundleIdentifier").or_else(|| text(info, "bundleIdentifier"));
    let duration_ms = number(info, "duration").map_or(0, |seconds| (seconds * 1000.0) as i64);
    let shuffle = number(info, "shuffleMode");
    let repeat = number(info, "repeatMode");
    MediaState {
        available: true,
        audio_active: playing,
        audio_peak: if playing { PLAYING_PEAK } else { 0.0 },
        playback_status: if playing { "playing" } else { "paused" },
        title: Some(title),
        artist: text(info, "artist"),
        album: text(info, "album"),
        thumbnail: artwork(info),
        position_ms: position_ms(info, playing, snapshot.received_ms, current_unix_millis()),
        duration_ms,
        can_seek: duration_ms > 0,
        can_next: !info.get("prohibitsSkip").and_then(Value::as_bool).unwrap_or(false),
        can_previous: true,
        shuffle_active: shuffle.map(|mode| mode as i64 > 1),
        can_shuffle: shuffle.is_some(),
        repeat_mode: repeat_label(repeat),
        can_repeat: repeat.is_some(),
        volume: volume(),
        sessions: source.iter().map(|id| MediaSessionInfo { id: id.clone(), label: id.clone(), playing }).collect(),
        active_session_id: source.clone(),
        source_app: source,
        ..MediaState::empty()
    }
}

fn from_track(track: Option<Track>) -> MediaState {
    let Some(track) = track else {
        return MediaState { volume: volume(), ..MediaState::empty() };
    };
    let source = Some(track.player.bundle_id().to_string());
    MediaState {
        available: true,
        audio_active: track.playing,
        audio_peak: if track.playing { PLAYING_PEAK } else { 0.0 },
        playback_status: if track.playing { "playing" } else { "paused" },
        title: Some(track.title),
        artist: Some(track.artist).filter(|artist| !artist.is_empty()),
        album: Some(track.album).filter(|album| !album.is_empty()),
        position_ms: track.position_ms,
        duration_ms: track.duration_ms,
        can_seek: track.duration_ms > 0,
        can_next: true,
        can_previous: true,
        volume: volume(),
        sessions: source.iter().map(|id| MediaSessionInfo { id: id.clone(), label: id.clone(), playing: track.playing }).collect(),
        active_session_id: source.clone(),
        source_app: source,
        ..MediaState::empty()
    }
}

pub(crate) fn get_state(_target: Option<String>) -> Result<MediaState, String> {
    if adapter::is_working() {
        return Ok(adapter::snapshot().map_or_else(|| MediaState { volume: volume(), ..MediaState::empty() }, |snapshot| from_snapshot(&snapshot)));
    }
    Ok(from_track(applescript::current()))
}

pub(crate) fn get_audio_level() -> Result<AudioLevel, String> {
    let state = get_state(None)?;
    Ok(AudioLevel { active: state.audio_active, peak: state.audio_peak, updated_at: current_unix_millis() })
}

fn adapter_args(command: MediaCommand) -> Vec<String> {
    let id = match command {
        MediaCommand::PlayPause => "2",
        MediaCommand::Next => "4",
        MediaCommand::Previous => "5",
        MediaCommand::ToggleShuffle => "6",
        MediaCommand::CycleRepeat => "7",
    };
    vec!["send".to_string(), id.to_string()]
}

fn applescript_verb(command: MediaCommand) -> Result<&'static str, String> {
    match command {
        MediaCommand::PlayPause => Ok("playpause"),
        MediaCommand::Next => Ok("next track"),
        MediaCommand::Previous => Ok("previous track"),
        MediaCommand::ToggleShuffle | MediaCommand::CycleRepeat => Err("This player cannot change shuffle or repeat from Fuyu.".to_string()),
    }
}

fn settle() {
    std::thread::sleep(std::time::Duration::from_millis(120));
}

pub(crate) fn run_command(command: MediaCommand, target: Option<String>) -> Result<MediaState, String> {
    if adapter::is_working() {
        adapter::run(&adapter_args(command))?;
    } else {
        applescript::command(applescript_verb(command)?)?;
    }
    settle();
    get_state(target)
}

pub(crate) fn seek(position_ms: i64, target: Option<String>) -> Result<MediaState, String> {
    if adapter::is_working() {
        adapter::run(&["seek".to_string(), (position_ms.max(0) * 1000).to_string()])?;
    } else {
        applescript::seek(position_ms)?;
    }
    settle();
    get_state(target)
}

pub(crate) fn set_volume(level: f32) -> Result<MediaState, String> {
    let device = audio::default_output().ok_or_else(|| "No sound output device was found.".to_string())?;
    if !audio::set_volume(device, level.clamp(0.0, 1.0)) {
        return Err("The sound output did not accept the volume.".to_string());
    }
    get_state(None)
}

#[cfg(test)]
mod tests {
    use super::{position_ms, repeat_label};
    use serde_json::json;

    #[test]
    fn a_playing_tracks_position_moves_on_from_its_timestamp_and_stops_at_the_end() {
        let info = json!({ "elapsedTime": 10.0, "playbackRate": 1.0, "duration": 200.0, "timestamp": "2026-11-13T17:52:33Z" });
        let info = info.as_object().unwrap();
        let stamp = 1_794_592_353_000;
        assert_eq!(position_ms(info, true, 0, stamp + 2_500), 12_500);
        assert_eq!(position_ms(info, false, 0, stamp + 2_500), 10_000);
        assert_eq!(position_ms(info, true, 0, stamp + 900_000), 200_000);
        assert_eq!(repeat_label(Some(3.0)), "list");
        assert_eq!(repeat_label(None), "unknown");
    }
}
