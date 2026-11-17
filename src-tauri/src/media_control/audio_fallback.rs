use std::{
    collections::{HashMap, HashSet},
    sync::{Mutex, OnceLock, PoisonError},
};

use super::{
    audio::AUDIO_ACTIVE_THRESHOLD,
    players::{
        custom_players_snapshot, default_player_label, is_browser_executable, match_music_player,
        normalize_player_id, parse_window_track, CustomMediaPlayer,
    },
    state::{MediaSessionInfo, MediaState},
};
use crate::win32;

const AUDIBLE_HOLD_MS: i64 = 2_500;
const AUDIBLE_CACHE_TTL_MS: i64 = 60_000;
const MAX_AUDIBLE_SESSIONS: usize = 64;
const SYSTEM_EXECUTABLES: &[&str] = &[
    "explorer.exe",
    "svchost.exe",
    "searchhost.exe",
    "shellexperiencehost.exe",
    "startmenuexperiencehost.exe",
    "applicationframehost.exe",
    "systemsettings.exe",
    "textinputhost.exe",
    "taskmgr.exe",
    "msedgewebview2.exe",
    "dllhost.exe",
    "conhost.exe",
    "dwm.exe",
    "fuyu.exe",
];

#[derive(Debug, Clone)]
pub(super) struct FallbackMediaSession {
    pub(super) id: String,
    pub(super) label: String,
    pub(super) playing: bool,
    pub(super) peak: f32,
    pub(super) title: Option<String>,
    pub(super) artist: Option<String>,
    pub(super) source_app: String,
}

static LAST_AUDIBLE_MS: OnceLock<Mutex<HashMap<String, i64>>> = OnceLock::new();

fn audible_cache() -> &'static Mutex<HashMap<String, i64>> {
    LAST_AUDIBLE_MS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn update_audible_cache(
    cache: &mut HashMap<String, i64>,
    id: &str,
    active: bool,
    peak: f32,
    now_ms: i64,
) -> bool {
    cache.retain(|_, last| now_ms.saturating_sub(*last) <= AUDIBLE_CACHE_TTL_MS);
    if peak > AUDIO_ACTIVE_THRESHOLD {
        cache.insert(id.to_string(), now_ms);
        if cache.len() > MAX_AUDIBLE_SESSIONS {
            let mut order: Vec<(String, i64)> = cache
                .iter()
                .filter(|(key, _)| key.as_str() != id)
                .map(|(key, last)| (key.clone(), *last))
                .collect();
            order.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
            for (key, _) in order.into_iter().take(cache.len() - MAX_AUDIBLE_SESSIONS) {
                cache.remove(&key);
            }
        }
        return true;
    }
    if !active {
        cache.remove(id);
        return false;
    }
    cache
        .get(id)
        .is_some_and(|last| now_ms.saturating_sub(*last) <= AUDIBLE_HOLD_MS)
}

fn is_held_playing(id: &str, active: bool, peak: f32, now_ms: i64) -> bool {
    let mut guard = audible_cache().lock().unwrap_or_else(PoisonError::into_inner);
    update_audible_cache(&mut guard, id, active, peak, now_ms)
}

fn resolve_host_process(
    process_id: u32,
    own_pid: u32,
    parents: &HashMap<u32, u32>,
) -> Option<(u32, String, String)> {
    let mut current = process_id;
    let mut chosen_pid = process_id;
    let mut chosen_path: Option<String> = None;

    for _ in 0..5 {
        if current == 0 || current == own_pid {
            return None;
        }
        if let Some(path) = win32::process::image_path(current) {
            let name = path.rsplit(['\\', '/']).next().unwrap_or(&path).to_string();
            if !name.eq_ignore_ascii_case("msedgewebview2.exe") && chosen_path.is_none() {
                chosen_pid = current;
                chosen_path = Some(path);
            }
        }
        match parents.get(&current).copied() {
            Some(parent) if parent != 0 && parent != current => current = parent,
            _ => break,
        }
    }

    let path = chosen_path.or_else(|| win32::process::image_path(process_id))?;
    let name = path.rsplit(['\\', '/']).next().unwrap_or(&path).trim().to_string();
    if name.is_empty() {
        return None;
    }
    Some((chosen_pid, name, path))
}

fn collect_window_titles() -> (HashMap<u32, String>, HashMap<String, String>) {
    let mut by_pid: HashMap<u32, String> = HashMap::new();
    let mut by_exe: HashMap<String, String> = HashMap::new();
    let mut path_by_pid: HashMap<u32, Option<String>> = HashMap::new();

    let _ = win32::window::for_each_top_level_window(|hwnd| {
        if win32::window::has_owner(hwnd) {
            return;
        }
        let visible = win32::window::is_visible(hwnd) || win32::window::is_minimized(hwnd);
        if !visible {
            return;
        }
        let title = win32::window::window_text(hwnd, 512).trim().to_string();
        if title.is_empty() {
            return;
        }
        let pid = win32::process::window_process_id(hwnd);
        if pid == 0 {
            return;
        }
        let replace_pid = by_pid
            .get(&pid)
            .is_none_or(|existing| title.len() > existing.len());
        if replace_pid {
            by_pid.insert(pid, title.clone());
        }
        let cached_path = path_by_pid
            .entry(pid)
            .or_insert_with(|| win32::process::image_path(pid));
        if let Some(path) = cached_path.as_deref() {
            let exe = path
                .rsplit(['\\', '/'])
                .next()
                .unwrap_or(path)
                .to_lowercase();
            let replace_exe = by_exe
                .get(&exe)
                .is_none_or(|existing| title.len() > existing.len());
            if replace_exe {
                by_exe.insert(exe, title);
            }
        }
    });

    (by_pid, by_exe)
}

fn smtc_already_covers(smtc_sessions: &[MediaSessionInfo], candidate_id: &str, label: &str) -> bool {
    let candidate_stem = candidate_id
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(candidate_id)
        .to_lowercase();
    let candidate_stem = candidate_stem
        .strip_suffix(".exe")
        .unwrap_or(&candidate_stem);

    smtc_sessions.iter().any(|session| {
        if session.label.eq_ignore_ascii_case(label) {
            return true;
        }
        let session_lower = session.id.to_lowercase();
        !candidate_stem.is_empty() && session_lower.contains(candidate_stem)
    })
}

pub(super) fn discover_fallback_sessions_with_devices(
    existing_devices: Option<&win32::audio::AudioDevices>,
    smtc_sessions: &[MediaSessionInfo],
    now_ms: i64,
) -> Vec<FallbackMediaSession> {
    let owned_devices;
    let devices = match existing_devices {
        Some(devices) => devices,
        None => {
            let Ok(opened) = win32::audio::AudioDevices::open() else {
                return Vec::new();
            };
            owned_devices = opened;
            &owned_devices
        }
    };
    let own_pid = std::process::id();
    let audio_sessions: Vec<_> = devices
        .process_sessions()
        .into_iter()
        .filter(|session| session.process_id != 0 && session.process_id != own_pid)
        .collect();
    if audio_sessions.is_empty() {
        return Vec::new();
    }

    let parents = win32::process_tree::parent_process_ids();
    let mut candidates = Vec::new();
    for audio in audio_sessions {
        let Some((app_pid, exe_name, _)) = resolve_host_process(audio.process_id, own_pid, &parents) else {
            continue;
        };
        let lowered_exe = exe_name.to_lowercase();
        if SYSTEM_EXECUTABLES.iter().any(|sys| *sys == lowered_exe) {
            continue;
        }
        if !is_browser_executable(&lowered_exe)
            && smtc_already_covers(smtc_sessions, &lowered_exe, &default_player_label(&exe_name))
        {
            continue;
        }
        candidates.push((audio, app_pid, exe_name, lowered_exe));
    }
    if candidates.is_empty() {
        return Vec::new();
    }

    let (titles_by_pid, titles_by_exe) = collect_window_titles();
    let custom = custom_players_snapshot();
    let mut by_id: HashMap<String, FallbackMediaSession> = HashMap::new();

    for (audio, app_pid, exe_name, lowered_exe) in candidates {
        let window_title = titles_by_pid
            .get(&app_pid)
            .or_else(|| titles_by_pid.get(&audio.process_id))
            .or_else(|| titles_by_exe.get(&lowered_exe))
            .map(String::as_str)
            .unwrap_or_default();

        let Some((matched_id, label)) = match_music_player(&exe_name, window_title, &custom) else {
            continue;
        };
        if smtc_already_covers(smtc_sessions, &matched_id, &label) {
            continue;
        }

        let playing = is_held_playing(&matched_id, audio.active, audio.peak, now_ms);
        let (title, artist) = match parse_window_track(window_title, &label) {
            Some((song, singer)) => (Some(song), singer),
            None => (None, None),
        };

        by_id
            .entry(matched_id.clone())
            .and_modify(|existing| {
                existing.playing |= playing;
                existing.peak = existing.peak.max(audio.peak);
                if existing.title.is_none() && title.is_some() {
                    existing.title = title.clone();
                    existing.artist = artist.clone();
                }
            })
            .or_insert(FallbackMediaSession {
                id: matched_id,
                label,
                playing,
                peak: audio.peak,
                title,
                artist,
                source_app: exe_name,
            });
    }

    let mut list: Vec<FallbackMediaSession> = by_id.into_values().collect();
    list.sort_by(|a, b| b.playing.cmp(&a.playing).then_with(|| a.label.cmp(&b.label)));
    list
}

pub(super) fn state_from_fallback(
    fallback: &FallbackMediaSession,
    sessions: Vec<MediaSessionInfo>,
    volume: f32,
    updated_at: i64,
) -> MediaState {
    let audio_peak = if fallback.playing {
        fallback.peak.max(AUDIO_ACTIVE_THRESHOLD * 2.0)
    } else {
        0.0
    };
    MediaState {
        available: true,
        audio_active: fallback.playing,
        audio_peak,
        playback_status: if fallback.playing { "playing" } else { "paused" },
        title: fallback.title.clone(),
        artist: fallback.artist.clone(),
        album: None,
        thumbnail: None,
        track_id: None,
        position_ms: 0,
        duration_ms: 0,
        can_seek: false,
        can_next: true,
        can_previous: true,
        shuffle_active: None,
        can_shuffle: false,
        repeat_mode: "unknown",
        can_repeat: false,
        volume,
        source_app: Some(fallback.source_app.clone()),
        active_session_id: Some(fallback.id.clone()),
        sessions,
        updated_at,
    }
}

pub(crate) fn list_candidates(existing_devices: Option<&win32::audio::AudioDevices>) -> Vec<CustomMediaPlayer> {
    let own_pid = std::process::id();
    let parents = win32::process_tree::parent_process_ids();
    let custom = custom_players_snapshot();
    let existing: HashSet<String> = custom.iter().map(|item| item.id.clone()).collect();
    let (titles_by_pid, _) = collect_window_titles();

    let mut audio_pids: HashSet<u32> = HashSet::new();
    let owned_devices;
    let devices = match existing_devices {
        Some(dev) => Some(dev),
        None => {
            owned_devices = win32::audio::AudioDevices::open().ok();
            owned_devices.as_ref()
        }
    };
    if let Some(devices) = devices {
        for session in devices.process_sessions() {
            if let Some((host_pid, _, _)) = resolve_host_process(session.process_id, own_pid, &parents) {
                audio_pids.insert(host_pid);
            }
        }
    }

    let mut candidates: Vec<(bool, CustomMediaPlayer)> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for pid in audio_pids.iter().copied().chain(titles_by_pid.keys().copied()) {
        let Some((host_pid, exe_name, _)) = resolve_host_process(pid, own_pid, &parents) else {
            continue;
        };
        let Some(id) = normalize_player_id(&exe_name) else {
            continue;
        };
        if SYSTEM_EXECUTABLES.iter().any(|sys| *sys == id)
            || is_browser_executable(&id)
            || existing.contains(&id)
            || !seen.insert(id.clone())
        {
            continue;
        }
        let has_audio = audio_pids.contains(&host_pid);
        let label = default_player_label(&exe_name);
        candidates.push((has_audio, CustomMediaPlayer { id, label }));
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.label.cmp(&b.1.label)));
    candidates.into_iter().map(|(_, item)| item).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audible_cache_expires_stale_entries_and_caps_capacity() {
        let mut cache = HashMap::new();
        let t0 = 100_000;
        assert!(update_audible_cache(&mut cache, "old", true, AUDIO_ACTIVE_THRESHOLD + 0.1, t0));
        assert!(update_audible_cache(&mut cache, "old", true, 0.0, t0 + AUDIBLE_HOLD_MS));
        assert!(!update_audible_cache(&mut cache, "old", true, 0.0, t0 + AUDIBLE_HOLD_MS + 1));

        let later = t0 + AUDIBLE_CACHE_TTL_MS + 10;
        assert!(update_audible_cache(&mut cache, "fresh", true, AUDIO_ACTIVE_THRESHOLD + 0.1, later));
        assert!(!cache.contains_key("old"));

        for index in 0..(MAX_AUDIBLE_SESSIONS + 5) {
            let at = later + 10 + index as i64;
            update_audible_cache(&mut cache, &format!("app-{index:02}"), true, AUDIO_ACTIVE_THRESHOLD + 0.1, at);
        }
        assert_eq!(cache.len(), MAX_AUDIBLE_SESSIONS);
        assert!(!cache.contains_key("fresh"));
        assert!(!cache.contains_key("app-00"));
        assert!(cache.contains_key(&format!("app-{:02}", MAX_AUDIBLE_SESSIONS + 4)));
    }
}
