use serde_json::{Map, Value};

use super::adapter_macos::{self as adapter, Snapshot};
use super::applescript_macos::{self as applescript, Track};
use super::players::{
    custom_players_snapshot, default_player_label, friendly_app_label, friendly_app_label_with_custom, is_browser_executable,
    match_music_player, normalize_metadata_track, normalize_player_id, parse_window_track,
    CustomMediaPlayer,
};
pub(crate) use super::state::{AudioLevel, MediaCommand, MediaSessionInfo, MediaState};
use super::state::current_unix_millis;
use super::timeline_clock::{self, track_key, Published};
use crate::macos::{accessibility, apps, audio, audio_devices};

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

pub(super) fn published(info: &Map<String, Value>, fallback_ms: i64) -> Published {
    Published {
        position_ms: (number(info, "elapsedTime").unwrap_or(0.0) * 1000.0).max(0.0) as i64,
        updated_ms: Some(timestamp_ms(info).unwrap_or(fallback_ms)),
        rate: number(info, "playbackRate").unwrap_or(1.0),
        duration_ms: number(info, "duration").map_or(0, |seconds| (seconds * 1000.0).max(0.0) as i64),
    }
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

fn adapter_pid(info: &Map<String, Value>) -> Option<i32> {
    info.get("processIdentifier")
        .and_then(Value::as_i64)
        .and_then(|pid| i32::try_from(pid).ok())
        .filter(|pid| *pid > 0)
}

fn from_fuyu(info: &Map<String, Value>) -> bool {
    let Ok(own) = i32::try_from(std::process::id()) else { return false };
    let own = crate::macos::apps::responsible_pid(own);
    adapter_pid(info).is_some_and(|pid| crate::macos::apps::responsible_pid(pid) == own)
}

fn snapshot_source(info: &Map<String, Value>) -> Option<String> {
    text(info, "parentApplicationBundleIdentifier").or_else(|| text(info, "bundleIdentifier"))
}

fn adapter_app(snapshot: &Snapshot) -> AdapterApp {
    let info = &snapshot.info;
    let source = snapshot_source(info);
    let bundle = text(info, "bundleIdentifier");
    AdapterApp {
        pid: adapter_pid(info).map(apps::responsible_pid),
        app_names: [source.as_deref(), bundle.as_deref()]
            .into_iter()
            .flatten()
            .filter_map(apps::path_for_bundle_id)
            .filter_map(|path| apps::outer_app_name(&path))
            .collect(),
        source,
    }
}

fn from_snapshot(snapshot: &Snapshot, force_playing: bool) -> MediaState {
    let info = &snapshot.info;
    let source = snapshot_source(info);
    let (title, artist) = normalize_metadata_track(text(info, "title"), text(info, "artist"), source.as_deref());
    let Some(title) = title.filter(|_| !from_fuyu(info)) else {
        return MediaState { volume: volume(), ..MediaState::empty() };
    };
    let playing = force_playing || info.get("playing").and_then(Value::as_bool).unwrap_or(false);
    let duration_ms = number(info, "duration").map_or(0, |seconds| (seconds * 1000.0) as i64);
    let track = track_key(Some(&title), artist.as_deref(), text(info, "album").as_deref(), duration_ms);
    let position_ms = timeline_clock::sample(source.as_deref().unwrap_or_default(), &track, published(info, snapshot.received_ms), playing, current_unix_millis());
    let shuffle = number(info, "shuffleMode");
    let repeat = number(info, "repeatMode");
    MediaState {
        available: true,
        audio_active: playing,
        audio_peak: if playing { PLAYING_PEAK } else { 0.0 },
        playback_status: if playing { "playing" } else { "paused" },
        title: Some(title),
        artist,
        album: text(info, "album"),
        thumbnail: artwork(info),
        position_ms,
        duration_ms,
        can_seek: duration_ms > 0,
        can_next: !info.get("prohibitsSkip").and_then(Value::as_bool).unwrap_or(false),
        can_previous: true,
        shuffle_active: shuffle.map(|mode| mode as i64 > 1),
        can_shuffle: shuffle.is_some(),
        repeat_mode: repeat_label(repeat),
        can_repeat: repeat.is_some(),
        volume: volume(),
        sessions: source.iter().map(|id| MediaSessionInfo { id: id.clone(), label: friendly_app_label(id), playing }).collect(),
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
        sessions: source.iter().map(|id| MediaSessionInfo { id: id.clone(), label: friendly_app_label(id), playing: track.playing }).collect(),
        active_session_id: source.clone(),
        source_app: source,
        ..MediaState::empty()
    }
}

pub(crate) fn list_candidates() -> Vec<CustomMediaPlayer> {
    let own = std::process::id();
    let custom = custom_players_snapshot();
    let mut out = Vec::new();
    for (pid, path) in apps::regular_apps() {
        if pid == own {
            continue;
        }
        let name = apps::outer_app_name(&path)
            .unwrap_or_else(|| path.rsplit('/').next().unwrap_or(&path).to_string());
        let Some(id) = normalize_player_id(&name) else {
            continue;
        };
        if is_browser_executable(&id)
            || custom.iter().any(|item| item.id == id)
            || out.iter().any(|item: &CustomMediaPlayer| item.id == id)
        {
            continue;
        }
        let label = default_player_label(&name);
        out.push(CustomMediaPlayer { id, label });
    }
    out.sort_by(|a, b| a.label.cmp(&b.label));
    out
}

fn from_audio_process() -> Option<AudioPlayer> {
    let pids = audio_devices::playing_pids()?;
    let own = i32::try_from(std::process::id()).ok()?;
    let own = apps::responsible_pid(own);
    let custom = custom_players_snapshot();

    for raw_pid in pids {
        let pid = apps::responsible_pid(raw_pid);
        if pid <= 0 || pid == own {
            continue;
        }
        let path = apps::path(pid);
        let Some(name) = apps::display_name(pid).or_else(|| path.clone()) else {
            continue;
        };
        let window_title = accessibility::app_windows(pid)
            .into_iter()
            .map(|(_, title)| title.trim().to_string())
            .filter(|title| !title.is_empty())
            .max_by_key(String::len)
            .unwrap_or_default();
        let Some((id, label)) = match_music_player(&name, &window_title, &custom) else {
            continue;
        };
        let (title, artist) = match parse_window_track(&window_title, &label) {
            Some((song, singer)) => (Some(song), singer),
            None => (None, None),
        };
        let state = MediaState {
            available: true,
            audio_active: true,
            audio_peak: PLAYING_PEAK,
            playback_status: "playing",
            title,
            artist,
            can_next: true,
            can_previous: true,
            volume: volume(),
            sessions: vec![MediaSessionInfo {
                id: id.clone(),
                label,
                playing: true,
            }],
            active_session_id: Some(id.clone()),
            source_app: Some(id),
            updated_at: current_unix_millis(),
            ..MediaState::empty()
        };
        let label = state.sessions.first().map(|session| session.label.clone()).unwrap_or_default();
        let names = std::iter::once(name).chain(path.as_deref().and_then(apps::outer_app_name)).collect();
        return Some(AudioPlayer { pid, names, label, state });
    }
    None
}

fn fallback_or(primary: MediaState) -> MediaState {
    if primary.playback_status == "playing" {
        return primary;
    }
    from_audio_process().map_or(primary, |player| player.state)
}

pub(crate) fn get_state(_target: Option<String>) -> Result<MediaState, String> {
    if !adapter::is_working() {
        return Ok(fallback_or(from_track(applescript::current())));
    }
    let Some(snapshot) = adapter::snapshot() else {
        return Ok(fallback_or(MediaState { volume: volume(), ..MediaState::empty() }));
    };
    let reports_playing = snapshot.info.get("playing").and_then(Value::as_bool).unwrap_or(false);
    let custom = custom_players_snapshot();
    Ok(choose(reports_playing, || adapter_app(&snapshot), &custom, from_audio_process, |force| from_snapshot(&snapshot, force)))
}

#[derive(Default)]
pub(super) struct AdapterApp {
    pub(super) pid: Option<i32>,
    pub(super) app_names: Vec<String>,
    pub(super) source: Option<String>,
}

pub(super) struct AudioPlayer {
    pub(super) pid: i32,
    pub(super) names: Vec<String>,
    pub(super) label: String,
    pub(super) state: MediaState,
}

fn same_name(left: &str, right: &str) -> bool {
    let left = left.trim().trim_end_matches(".app");
    let right = right.trim().trim_end_matches(".app");
    !left.is_empty() && left.eq_ignore_ascii_case(right)
}

pub(super) fn same_app(adapter: &AdapterApp, player: &AudioPlayer, custom: &[CustomMediaPlayer]) -> bool {
    if adapter.pid.is_some_and(|pid| pid == player.pid) {
        return true;
    }
    if adapter.app_names.iter().any(|name| player.names.iter().any(|other| same_name(name, other))) {
        return true;
    }
    adapter
        .source
        .as_deref()
        .is_some_and(|source| !player.label.is_empty() && friendly_app_label_with_custom(source, custom) == player.label)
}

pub(super) fn merge(adapter: MediaState, player: MediaState) -> MediaState {
    MediaState {
        audio_active: player.audio_active,
        audio_peak: player.audio_peak,
        playback_status: player.playback_status,
        updated_at: player.updated_at.max(adapter.updated_at),
        ..adapter
    }
}

pub(super) fn choose(
    reports_playing: bool,
    adapter: impl FnOnce() -> AdapterApp,
    custom: &[CustomMediaPlayer],
    find_player: impl FnOnce() -> Option<AudioPlayer>,
    mut build: impl FnMut(bool) -> MediaState,
) -> MediaState {
    let reported = match reports_playing.then(|| build(false)) {
        Some(state) if state.playback_status == "playing" => return state,
        other => other,
    };
    let Some(player) = find_player() else {
        return reported.unwrap_or_else(|| build(false));
    };
    if !same_app(&adapter(), &player, custom) {
        return player.state;
    }
    let state = build(true);
    if state.title.is_none() {
        return player.state;
    }
    merge(state, player.state)
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
        timeline_clock::seeked(None, position_ms.max(0), current_unix_millis());
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
#[path = "service_macos_tests.rs"]
mod tests;
