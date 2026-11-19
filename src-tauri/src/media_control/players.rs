use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, PoisonError},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const CUSTOM_PLAYERS_FILE: &str = "media-custom-players.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMediaPlayer {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct KnownPlayer {
    pub(crate) needles: &'static [&'static str],
    pub(crate) label: &'static str,
    pub(crate) title_suffixes: &'static [&'static str],
    pub(crate) standalone: bool,
    pub(crate) web_title_match: bool,
    pub(crate) artist_first: bool,
}

const fn known(
    needles: &'static [&'static str],
    label: &'static str,
    title_suffixes: &'static [&'static str],
    standalone: bool,
    web_title_match: bool,
    artist_first: bool,
) -> KnownPlayer {
    KnownPlayer { needles, label, title_suffixes, standalone, web_title_match, artist_first }
}

pub(crate) const KNOWN_PLAYERS: &[KnownPlayer] = &[
    known(&["xtmusic", "fnmusic", "feiniumusic", "feiniu-music", "fnnas-music", "feiniu", "飞牛音乐"], "飞牛音乐", &["飞牛音乐", "xtMusic", "FnMusic", "FeiNiuMusic", "飞牛私有云音乐"], true, true, false),
    known(&["streammusic", "stream-music", "音流"], "音流", &["音流", "Stream Music", "StreamMusic"], true, false, false),
    known(&["feishin"], "Feishin", &["Feishin"], true, true, false),
    known(&["supersonic"], "Supersonic", &["Supersonic"], true, false, false),
    known(&["sonixd"], "Sonixd", &["Sonixd"], true, false, false),
    known(&["aonsoku"], "Aonsoku", &["Aonsoku"], true, false, false),
    known(&["navidrome"], "Navidrome", &["Navidrome"], true, true, false),
    known(&["plexamp"], "Plexamp", &["Plexamp"], true, false, false),
    known(&["finamp"], "Finamp", &["Finamp"], true, false, false),
    known(&["roon", "roonappliance"], "Roon", &["Roon"], true, false, false),
    known(&["audirvana"], "Audirvana", &["Audirvana", "Audirvāna"], true, false, false),
    known(&["netease", "cloudmusic", "163music"], "NetEase Music", &["网易云音乐", "NetEase Cloud Music", "CloudMusic"], true, true, false),
    known(&["yesplaymusic"], "YesPlayMusic", &["YesPlayMusic"], true, true, false),
    known(&["splayer"], "SPlayer", &["SPlayer"], true, false, false),
    known(&["lyricease"], "LyricEase", &["LyricEase"], true, false, false),
    known(&["algermusicplayer", "algermusic"], "AlgerMusic", &["AlgerMusicPlayer", "AlgerMusic"], true, false, false),
    known(&["qqmusic"], "QQ Music", &["QQ音乐", "QQ Music", "QQMusic"], true, true, false),
    known(&["kugou"], "KuGou", &["酷狗音乐", "酷狗概念版", "KuGou"], true, false, false),
    known(&["kuwo", "kwmusic"], "Kuwo", &["酷我音乐", "Kuwo"], true, false, false),
    known(&["sodamusic", "qishui", "汽水音乐"], "汽水音乐", &["汽水音乐", "Soda Music", "SodaMusic"], true, true, false),
    known(&["lx-music", "lxmusic", "洛雪音乐"], "LX Music", &["洛雪音乐", "洛雪音乐助手", "LX Music", "lx-music-desktop"], true, false, false),
    known(&["musicfree"], "MusicFree", &["MusicFree"], true, false, false),
    known(&["listen1", "listen 1"], "Listen 1", &["Listen 1", "Listen1"], true, true, false),
    known(&["tongzhong", "铜钟"], "铜钟", &["铜钟", "Tongzhong"], true, true, false),
    known(&["ttplayer", "qianqian", "千千音乐", "千千静听"], "千千音乐", &["千千音乐", "千千静听", "TTPlayer"], true, false, false),
    known(&["migumusic", "咪咕音乐"], "咪咕音乐", &["咪咕音乐", "Migu Music"], true, false, false),
    known(&["bodian", "波点音乐"], "波点音乐", &["波点音乐"], true, false, false),
    known(&["saltplayer", "椒盐音乐"], "Salt Player", &["椒盐音乐", "Salt Player", "SaltPlayer"], true, false, false),
    known(&["fongermusic", "方格音乐"], "方格音乐", &["方格音乐", "FongerMusic"], true, false, false),
    known(&["hibymusic", "海贝音乐"], "HiBy Music", &["海贝音乐", "HiBy Music", "HiByMusic"], true, false, false),
    known(&["cider"], "Cider", &["Cider"], true, false, false),
    known(&["spotify"], "Spotify", &["Spotify", "Spotify Free", "Spotify Premium"], true, false, false),
    known(&["spotube"], "Spotube", &["Spotube"], true, false, false),
    known(&["apple.music", "applemusic", "music.ui", "com.apple.music"], "Apple Music", &["Apple Music"], true, false, false),
    known(&["itunes", "com.apple.itunes"], "iTunes", &["iTunes"], true, false, false),
    known(&["tidal"], "TIDAL", &["TIDAL"], true, false, false),
    known(&["deezer"], "Deezer", &["Deezer"], true, false, false),
    known(&["qobuz"], "Qobuz", &["Qobuz"], true, false, false),
    known(&["amazonmusic", "amazon music"], "Amazon Music", &["Amazon Music"], true, false, false),
    known(&["youtube-music", "youtubemusic", "ytmdesktop"], "YouTube Music", &["YouTube Music"], true, true, false),
    known(&["nuclear"], "Nuclear", &["Nuclear"], true, false, false),
    known(&["foobar2000", "foobar"], "foobar2000", &["foobar2000"], true, false, true),
    known(&["musicbee"], "MusicBee", &["MusicBee"], true, false, true),
    known(&["aimp"], "AIMP", &["AIMP"], true, false, true),
    known(&["winamp"], "Winamp", &["Winamp"], true, false, true),
    known(&["wacup"], "WACUP", &["WACUP"], true, false, true),
    known(&["dopamine"], "Dopamine", &["Dopamine"], true, false, false),
    known(&["harmonoid"], "Harmonoid", &["Harmonoid"], true, false, false),
    known(&["tauonmb", "tauon"], "Tauon", &["Tauon Music Box", "Tauon"], true, false, false),
    known(&["strawberry"], "Strawberry", &["Strawberry"], true, false, true),
    known(&["clementine"], "Clementine", &["Clementine"], true, false, true),
    known(&["elisa"], "Elisa", &["Elisa"], true, false, false),
    known(&["audacious"], "Audacious", &["Audacious"], true, false, true),
    known(&["deadbeef"], "DeaDBeeF", &["DeaDBeeF"], true, false, true),
    known(&["mediamonkey"], "MediaMonkey", &["MediaMonkey"], true, false, true),
    known(&["resonic"], "Resonic", &["Resonic"], true, false, false),
    known(&["mcool"], "Mcool", &["Mcool"], true, false, false),
    known(&["tuneblade"], "TuneBlade", &["TuneBlade"], true, false, false),
    known(&["swinsian"], "Swinsian", &["Swinsian"], true, false, false),
    known(&["com.coppertino.vox", "vox"], "VOX", &["VOX"], true, false, false),
    known(&["org.cogx.cog", "cog"], "Cog", &["Cog"], true, false, true),
    known(&["pine player", "pineplayer"], "Pine Player", &["Pine Player"], true, false, true),
    known(&["doppler"], "Doppler", &["Doppler"], true, false, false),
    known(&["com.colliderli.iina", "iina"], "IINA", &["IINA"], true, false, false),
    known(&["vlc"], "VLC", &["VLC media player", "VLC"], true, false, false),
    known(&["potplayer"], "PotPlayer", &["PotPlayer"], true, false, false),
    known(&["mpv"], "mpv", &["mpv"], true, false, false),
    known(&["mpc-hc", "mpc-be"], "MPC", &["Media Player Classic", "MPC-HC", "MPC-BE"], true, false, false),
    known(&["kmplayer"], "KMPlayer", &["KMPlayer"], true, false, false),
    known(&["wmplayer"], "Windows Media Player", &["Windows Media Player"], true, false, false),
    known(&["zune", "groove"], "Groove", &["Groove Music", "Groove"], true, false, false),
    known(&["chrome"], "Chrome", &["Google Chrome", "Chrome"], false, false, false),
    known(&["msedge", "edge"], "Edge", &["Microsoft Edge", "Microsoft\u{200b} Edge", "Edge"], false, false, false),
    known(&["firefox"], "Firefox", &["Mozilla Firefox", "Firefox"], false, false, false),
    known(&["brave"], "Brave", &["Brave"], false, false, false),
    known(&["opera"], "Opera", &["Opera"], false, false, false),
    known(&["vivaldi"], "Vivaldi", &["Vivaldi"], false, false, false),
    known(&["arc"], "Arc", &["Arc"], false, false, false),
];

const BROWSER_SUFFIXES: &[&str] = &[
    "Google Chrome",
    "Microsoft Edge",
    "Microsoft\u{200b} Edge",
    "Mozilla Firefox",
    "Brave",
    "Opera",
    "Vivaldi",
    "Arc",
    "Safari",
];

const SEPARATORS: &[&str] = &[" - ", " – ", " — ", " ｜ ", " | "];

const STATUS_PREFIXES: &[&str] = &[
    "▶ ",
    "⏸ ",
    "► ",
    "[Playing] ",
    "[Paused] ",
    "[正在播放] ",
    "[已暂停] ",
    "[暂停] ",
    "正在播放：",
    "正在播放: ",
];

static CUSTOM_PLAYERS: OnceLock<Mutex<Vec<CustomMediaPlayer>>> = OnceLock::new();
static CUSTOM_PLAYERS_PATH: OnceLock<PathBuf> = OnceLock::new();

fn custom_store() -> &'static Mutex<Vec<CustomMediaPlayer>> {
    CUSTOM_PLAYERS.get_or_init(|| Mutex::new(Vec::new()))
}

pub(crate) fn init_custom_players(app: &AppHandle) {
    if let Ok(home) = crate::home_dir::fuyu_home(app.path()) {
        let path = home.join(CUSTOM_PLAYERS_FILE);
        let loaded = read_custom_players_file(&path);
        let _ = CUSTOM_PLAYERS_PATH.set(path);
        *custom_store().lock().unwrap_or_else(PoisonError::into_inner) = loaded;
    }
}

fn ensure_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = CUSTOM_PLAYERS_PATH.get() {
        return Ok(path.clone());
    }
    let home = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?;
    let path = home.join(CUSTOM_PLAYERS_FILE);
    let loaded = read_custom_players_file(&path);
    let _ = CUSTOM_PLAYERS_PATH.set(path.clone());
    *custom_store().lock().unwrap_or_else(PoisonError::into_inner) = loaded;
    Ok(path)
}

pub(crate) fn read_custom_players_file(path: &Path) -> Vec<CustomMediaPlayer> {
    let Ok(raw) = fs::read_to_string(path) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<Vec<CustomMediaPlayer>>(&raw) else {
        return Vec::new();
    };
    normalize_custom_list(parsed)
}

fn write_custom_players_file(path: &Path, list: &[CustomMediaPlayer]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(list).map_err(|error| error.to_string())?;
    crate::fs_write::replace_file(path, json.as_bytes()).map_err(|error| error.to_string())
}

pub(crate) fn normalize_player_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim().trim_matches('"');
    let base = trimmed.rsplit(['\\', '/']).next().unwrap_or(trimmed).trim();
    if base.is_empty() {
        return None;
    }
    Some(base.to_lowercase())
}

pub(crate) fn default_player_label(id: &str) -> String {
    let base = id.rsplit(['\\', '/']).next().unwrap_or(id).trim();
    let stem = base
        .strip_suffix(".exe")
        .or_else(|| base.strip_suffix(".EXE"))
        .or_else(|| base.strip_suffix(".app"))
        .unwrap_or(base);
    let mut chars = stem.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => id.to_string(),
    }
}

fn normalize_custom_list(entries: Vec<CustomMediaPlayer>) -> Vec<CustomMediaPlayer> {
    let mut out: Vec<CustomMediaPlayer> = Vec::new();
    for entry in entries {
        let Some(id) = normalize_player_id(&entry.id) else {
            continue;
        };
        if out.iter().any(|item| item.id == id) {
            continue;
        }
        let label = entry.label.trim();
        let label = if label.is_empty() {
            default_player_label(&id)
        } else {
            label.to_string()
        };
        out.push(CustomMediaPlayer { id, label });
    }
    out
}

pub(crate) fn custom_players_snapshot() -> Vec<CustomMediaPlayer> {
    custom_store().lock().unwrap_or_else(PoisonError::into_inner).clone()
}

pub(crate) fn get_custom_players(app: &AppHandle) -> Result<Vec<CustomMediaPlayer>, String> {
    let _ = ensure_path(app)?;
    Ok(custom_players_snapshot())
}

pub(crate) fn add_custom_player(
    app: &AppHandle,
    id: &str,
    label: Option<&str>,
) -> Result<Vec<CustomMediaPlayer>, String> {
    let path = ensure_path(app)?;
    let normalized_id = normalize_player_id(id).ok_or_else(|| "Player name cannot be empty.".to_string())?;
    let resolved_label = label
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| friendly_app_label(&normalized_id));
    let mut guard = custom_store().lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(existing) = guard.iter_mut().find(|item| item.id == normalized_id) {
        existing.label = resolved_label;
    } else {
        guard.push(CustomMediaPlayer {
            id: normalized_id,
            label: resolved_label,
        });
    }
    let snapshot = guard.clone();
    drop(guard);
    write_custom_players_file(&path, &snapshot)?;
    Ok(snapshot)
}

pub(crate) fn remove_custom_player(
    app: &AppHandle,
    id: &str,
) -> Result<Vec<CustomMediaPlayer>, String> {
    let path = ensure_path(app)?;
    let normalized = normalize_player_id(id).unwrap_or_default();
    let mut guard = custom_store().lock().unwrap_or_else(PoisonError::into_inner);
    guard.retain(|item| item.id != normalized && !item.id.eq_ignore_ascii_case(id.trim()));
    let snapshot = guard.clone();
    drop(guard);
    write_custom_players_file(&path, &snapshot)?;
    Ok(snapshot)
}

fn id_matches_custom(lowered_id: &str, custom: &CustomMediaPlayer) -> bool {
    let custom_stem = custom.id.strip_suffix(".exe").unwrap_or(&custom.id);
    let id_base = lowered_id.rsplit(['\\', '/']).next().unwrap_or(lowered_id);
    let id_stem = id_base.strip_suffix(".exe").unwrap_or(id_base);
    lowered_id == custom.id
        || id_base == custom.id
        || (!custom_stem.is_empty() && id_stem == custom_stem)
}

pub(crate) fn friendly_app_label_with_custom(id: &str, custom: &[CustomMediaPlayer]) -> String {
    let lowered = id.to_lowercase();
    for item in custom {
        if id_matches_custom(&lowered, item) {
            return item.label.clone();
        }
    }
    for player in KNOWN_PLAYERS {
        if player.needles.iter().any(|needle| lowered.contains(needle)) {
            return player.label.to_string();
        }
    }
    if lowered.ends_with(".exe") {
        return default_player_label(&lowered);
    }
    id.to_string()
}

pub(crate) fn friendly_app_label(id: &str) -> String {
    friendly_app_label_with_custom(id, &custom_players_snapshot())
}

pub(crate) fn is_browser_executable(exe_or_id: &str) -> bool {
    let lowered = exe_or_id.to_lowercase();
    let stem = lowered
        .rsplit(['\\', '/'])
        .next()
        .unwrap_or(&lowered)
        .strip_suffix(".exe")
        .unwrap_or(&lowered);
    matches!(
        stem,
        "chrome" | "msedge" | "edge" | "firefox" | "brave" | "opera" | "vivaldi" | "arc" | "safari" | "google chrome" | "microsoft edge"
    )
}

pub(crate) fn match_music_player(
    exe_or_id: &str,
    window_title: &str,
    custom: &[CustomMediaPlayer],
) -> Option<(String, String)> {
    let base = exe_or_id.rsplit(['\\', '/']).next().unwrap_or(exe_or_id).trim();
    let lowered = base.to_lowercase();

    for item in custom {
        if id_matches_custom(&lowered, item) {
            let id = if base.is_empty() { item.id.clone() } else { base.to_string() };
            return Some((id, item.label.clone()));
        }
    }

    if !is_browser_executable(&lowered) {
        for player in KNOWN_PLAYERS.iter().filter(|player| player.standalone) {
            if player.needles.iter().any(|needle| lowered.contains(needle)) {
                return Some((base.to_string(), player.label.to_string()));
            }
        }
    }

    let cleaned_title = strip_browser_suffix(window_title.trim());
    if !cleaned_title.is_empty() {
        for player in KNOWN_PLAYERS.iter().filter(|player| player.web_title_match) {
            if title_mentions_player(cleaned_title, player) {
                let id = if is_browser_executable(&lowered) || base.is_empty() {
                    format!("{}.exe", player.needles[0])
                } else {
                    base.to_string()
                };
                return Some((id, player.label.to_string()));
            }
        }
    }

    None
}

fn title_mentions_player(title: &str, player: &KnownPlayer) -> bool {
    for suffix in player.title_suffixes {
        if title.eq_ignore_ascii_case(suffix) {
            return true;
        }
        for sep in SEPARATORS {
            let tail = format!("{sep}{suffix}");
            let head = format!("{suffix}{sep}");
            if ends_with_ignore_case(title, &tail) || starts_with_ignore_case(title, &head) {
                return true;
            }
        }
    }
    false
}

fn ends_with_ignore_case(text: &str, suffix: &str) -> bool {
    text.len() >= suffix.len()
        && text
            .get(text.len() - suffix.len()..)
            .is_some_and(|tail| tail.eq_ignore_ascii_case(suffix))
}

fn starts_with_ignore_case(text: &str, prefix: &str) -> bool {
    text.len() >= prefix.len()
        && text
            .get(..prefix.len())
            .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
}

fn strip_browser_suffix(mut title: &str) -> &str {
    loop {
        let mut changed = false;
        for browser in BROWSER_SUFFIXES {
            for sep in SEPARATORS {
                let suffix = format!("{sep}{browser}");
                if ends_with_ignore_case(title, &suffix) {
                    title = title[..title.len() - suffix.len()].trim();
                    changed = true;
                }
            }
        }
        for profile_tag in ["Personal", "Work", "个人", "工作", "无痕", "InPrivate"] {
            for sep in SEPARATORS {
                let suffix = format!("{sep}{profile_tag}");
                if ends_with_ignore_case(title, &suffix) {
                    title = title[..title.len() - suffix.len()].trim();
                    changed = true;
                }
            }
        }
        if !changed {
            break;
        }
    }
    title
}

fn strip_player_affixes<'a>(mut text: &'a str, app_label: &str) -> &'a str {
    if let Some(bracket_pos) = text.rfind(" [foobar2000") {
        text = text[..bracket_pos].trim();
    }
    let mut suffixes: Vec<&str> = Vec::new();
    if !app_label.is_empty() {
        suffixes.push(app_label);
    }
    for player in KNOWN_PLAYERS {
        suffixes.extend_from_slice(player.title_suffixes);
    }

    for suffix in &suffixes {
        for sep in SEPARATORS {
            let tail = format!("{sep}{suffix}");
            if ends_with_ignore_case(text, &tail) {
                text = text[..text.len() - tail.len()].trim();
                return text;
            }
            if let Some(pos) = text.rfind(sep) {
                let right = text[pos + sep.len()..].trim();
                let prefix_ver = format!("{suffix} v");
                if starts_with_ignore_case(right, &prefix_ver) {
                    text = text[..pos].trim();
                    return text;
                }
            }
        }
    }

    for suffix in &suffixes {
        for sep in SEPARATORS {
            let head = format!("{suffix}{sep}");
            if starts_with_ignore_case(text, &head) {
                let rest = text[head.len()..].trim();
                if SEPARATOR_CHARS.iter().any(|mark| rest.contains(mark)) {
                    return rest;
                }
            }
        }
    }

    text
}

const SEPARATOR_CHARS: &[&str] = &[" - ", " – ", " — ", " / "];

fn strip_leading_track_number(text: &str) -> &str {
    let bytes = text.as_bytes();
    let digits = bytes.iter().take_while(|byte| byte.is_ascii_digit()).count();
    if (1..=3).contains(&digits) {
        if let Some(rest) = text[digits..].strip_prefix(". ") {
            let trimmed = rest.trim();
            if !trimmed.is_empty() {
                return trimmed;
            }
        }
    }
    text
}

fn is_artist_first_player(app_label: &str) -> bool {
    KNOWN_PLAYERS.iter().any(|player| {
        player.artist_first
            && (player.label.eq_ignore_ascii_case(app_label)
                || player.needles.iter().any(|needle| app_label.to_lowercase().contains(needle)))
    })
}

fn is_bare_player_title(text: &str, app_label: &str) -> bool {
    if text.is_empty() || text.eq_ignore_ascii_case(app_label) {
        return true;
    }
    for player in KNOWN_PLAYERS {
        if player.label.eq_ignore_ascii_case(text)
            || player.title_suffixes.iter().any(|suffix| suffix.eq_ignore_ascii_case(text))
            || player.needles.iter().any(|needle| needle.eq_ignore_ascii_case(text))
        {
            return true;
        }
    }
    let lowered = text.to_lowercase();
    lowered.starts_with("foobar2000 v")
        || lowered == "暂停"
        || lowered == "paused"
        || lowered == "未在播放"
}

pub(crate) fn parse_window_track(
    window_title: &str,
    app_label: &str,
) -> Option<(String, Option<String>)> {
    let mut text = window_title.trim();
    for prefix in STATUS_PREFIXES {
        if let Some(rest) = text.strip_prefix(prefix) {
            text = rest.trim();
        }
    }
    text = strip_browser_suffix(text);
    text = strip_player_affixes(text, app_label);
    text = strip_leading_track_number(text);
    if is_bare_player_title(text, app_label) {
        return None;
    }

    let artist_first = is_artist_first_player(app_label);
    for sep in [" - ", " – ", " — "] {
        if let Some((first, rest)) = text.split_once(sep) {
            let left = first.trim();
            let right = rest.split(sep).next().unwrap_or(rest).trim();
            if !left.is_empty() && !right.is_empty() && !is_bare_player_title(right, app_label) {
                return if artist_first {
                    Some((right.to_string(), Some(left.to_string())))
                } else {
                    Some((left.to_string(), Some(right.to_string())))
                };
            }
        }
    }

    Some((text.to_string(), None))
}

pub(crate) fn normalize_metadata_track(
    title: Option<String>,
    artist: Option<String>,
    source_app: Option<&str>,
) -> (Option<String>, Option<String>) {
    let Some(raw_title) = title.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()) else {
        return (None, artist);
    };
    let app_label = source_app.map(friendly_app_label).unwrap_or_default();
    if artist.as_ref().is_some_and(|value| !value.trim().is_empty()) {
        let cleaned = strip_player_affixes(strip_browser_suffix(&raw_title), &app_label).trim();
        let final_title = if cleaned.is_empty() { raw_title } else { cleaned.to_string() };
        return (Some(final_title), artist);
    }
    if let Some((parsed_title, parsed_artist)) = parse_window_track(&raw_title, &app_label) {
        return (Some(parsed_title), parsed_artist);
    }
    (Some(raw_title), None)
}

#[cfg(test)]
#[path = "players_tests.rs"]
mod tests;
