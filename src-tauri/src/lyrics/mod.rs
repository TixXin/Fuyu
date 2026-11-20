mod amll;
mod apple_token;
mod applemusic;
mod found;
mod inflink;
mod krc;
mod kugou;
mod kugou_cache;
mod local;
mod lrclib;
mod matching;
mod netease;
mod qq;
mod qrc;
mod ttml;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use found::{has_word_times, FoundLyrics};
pub use inflink::InflinkState;
use matching::{cache_key, named_in_simplified, stable_hash, traditional_chars};
use crate::user_error::UserError;
#[cfg(windows)]
use crate::win32::chinese::to_simplified;

#[cfg(not(windows))]
fn to_simplified(_text: &str) -> Option<String> {
    None
}

const CACHE_DIR_NAME: &str = "lyrics-cache";
const MISSING_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const MAX_CACHED: usize = 2000;
const CHINESE_KEY: &str = "\u{1f}cn";
const APPLE_KEY: &str = "\u{1f}am";
const APPLE_SOURCE: &str = "apple-music";
const APPLE_TOKEN_EVENT: &str = "apple-music-token-changed";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsQuery {
    title: String,
    #[serde(default)]
    artist: String,
    #[serde(default)]
    album: String,
    #[serde(default)]
    duration_ms: i64,
    #[serde(default)]
    folder: String,
    #[serde(default)]
    online: bool,
    #[serde(default)]
    chinese: bool,
    #[serde(default)]
    track_id: Option<String>,
    #[serde(default)]
    source_app: Option<String>,
    #[serde(default)]
    apple_music: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyrics {
    source: &'static str,
    lrc: String,
    translation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheEntry {
    key: String,
    lrc: Option<String>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    translation: Option<String>,
    #[serde(default)]
    word_times: bool,
    #[serde(default)]
    words_first: bool,
    fetched_at: u64,
}

type Answer = (&'static str, FoundLyrics);

fn source_name(name: &str) -> &'static str {
    match name {
        "kugou" => "kugou",
        "netease" => "netease",
        "qq" => "qq",
        APPLE_SOURCE => APPLE_SOURCE,
        _ => "lrclib",
    }
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |time| time.as_secs())
}

fn cache_path(dir: &Path, key: &str) -> PathBuf {
    dir.join(format!("{:016x}.json", stable_hash(key)))
}

fn read_cache(dir: &Path, key: &str, now: u64) -> Option<Option<Answer>> {
    let entry: CacheEntry = serde_json::from_str(&fs::read_to_string(cache_path(dir, key)).ok()?).ok()?;
    if entry.key != key {
        return None;
    }
    match entry.lrc {
        Some(_) if entry.source.as_deref() == Some("kugou") && !entry.word_times => None,
        Some(_) if entry.source.as_deref() == Some(APPLE_SOURCE) && !key.contains(APPLE_KEY) => None,
        Some(lrc) if key.ends_with(CHINESE_KEY) && !entry.words_first && !has_word_times(&lrc) => None,
        Some(lrc) => {
            let source = source_name(entry.source.as_deref().unwrap_or_default());
            Some(Some((source, FoundLyrics { lrc, translation: entry.translation })))
        }
        None if now.saturating_sub(entry.fetched_at) < MISSING_TTL.as_secs() => Some(None),
        None => None,
    }
}

fn write_cache(dir: &Path, key: &str, answer: Option<&Answer>, now: u64) {
    if fs::create_dir_all(dir).is_err() {
        return;
    }
    let entry = CacheEntry {
        key: key.to_string(),
        lrc: answer.map(|(_, found)| found.lrc.clone()),
        source: answer.map(|(source, _)| (*source).to_string()),
        translation: answer.and_then(|(_, found)| found.translation.clone()),
        word_times: true,
        words_first: true,
        fetched_at: now,
    };
    if let Ok(text) = serde_json::to_string(&entry) {
        let _ = fs::write(cache_path(dir, key), text);
    }
    prune_cache(dir, MAX_CACHED);
}

fn prune_cache(dir: &Path, keep: usize) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut files: Vec<(SystemTime, PathBuf)> = entries
        .flatten()
        .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
        .collect();
    if files.len() <= keep {
        return;
    }
    files.sort();
    for (_, path) in &files[..files.len() - keep] {
        let _ = fs::remove_file(path);
    }
}

fn for_display(source: &'static str, found: FoundLyrics, title: &str, artist: &str) -> Lyrics {
    let simplify = |text: String| {
        if named_in_simplified(title, artist) && traditional_chars(&text) > 2 {
            to_simplified(&text).unwrap_or(text)
        } else {
            text
        }
    };
    Lyrics { source, lrc: simplify(found.lrc), translation: found.translation.map(simplify) }
}

fn source_order(query: &LyricsQuery, apple: bool) -> Vec<&'static str> {
    let chinese_named = format!("{}{}", query.title, query.artist).chars().any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c));
    let rest = match (query.chinese, netease::track_id(query.track_id.as_deref()).is_some(), chinese_named) {
        (false, _, _) => vec!["lrclib"],
        (true, true, _) => vec!["netease", "kugou", "qq", "lrclib"],
        (true, false, true) => vec!["kugou", "qq", "netease", "lrclib"],
        (true, false, false) => vec!["lrclib", "kugou", "qq", "netease"],
    };
    if apple {
        [vec![APPLE_SOURCE], rest].concat()
    } else {
        rest
    }
}

fn apple_wanted(query: &LyricsQuery) -> bool {
    query.online && query.apple_music && applemusic::is_apple_music(query.source_app.as_deref())
}

fn lyrics_cache_key(query: &LyricsQuery, apple: bool) -> String {
    let mut key = cache_key(&query.title, &query.artist, query.duration_ms);
    if apple {
        key.push_str(APPLE_KEY);
    }
    if query.chinese {
        key.push_str(CHINESE_KEY);
    }
    key
}

async fn fetch_online(query: &LyricsQuery, apple_token: Option<&str>) -> Result<(Option<Answer>, bool), String> {
    let (title, artist) = (query.title.as_str(), query.artist.as_str());
    let mut errors = Vec::new();
    let mut apple_failed = false;
    let mut answered = false;
    let mut line_timed = None;
    for source in source_order(query, apple_token.is_some()) {
        let result = match source {
            APPLE_SOURCE => applemusic::fetch(title, artist, query.duration_ms, apple_token.unwrap_or_default()).await,
            "kugou" => kugou::fetch(title, artist, query.duration_ms).await,
            "qq" => qq::fetch(title, artist, query.duration_ms).await,
            "netease" => netease::fetch(title, artist, query.duration_ms, query.track_id.as_deref()).await,
            _ => lrclib::fetch(title, artist, &query.album, query.duration_ms)
                .await
                .map(|lrc| lrc.map(|lrc| FoundLyrics { lrc, translation: None })),
        };
        match result {
            Ok(Some(found)) if !query.chinese || has_word_times(&found.lrc) => return Ok((Some((source, found)), !apple_failed)),
            Ok(Some(found)) => {
                line_timed.get_or_insert((source, found));
            }
            Ok(None) => answered = true,
            Err(error) => {
                apple_failed |= source == APPLE_SOURCE;
                errors.push(error);
            }
        }
    }
    if line_timed.is_some() || answered {
        Ok((line_timed, !apple_failed))
    } else {
        Err(errors.join("; "))
    }
}

#[tauri::command]
pub async fn get_lyrics(app: AppHandle, query: LyricsQuery) -> Result<Option<Lyrics>, String> {
    if query.title.trim().is_empty() {
        return Ok(None);
    }
    let folder = query.folder.trim().to_string();
    if !folder.is_empty() {
        let (title, artist) = (query.title.clone(), query.artist.clone());
        let found = tauri::async_runtime::spawn_blocking(move || local::find(Path::new(&folder), &title, &artist))
            .await
            .map_err(|error| format!("Failed to join the lyrics folder search: {error}"))?;
        if let Some(found) = found {
            return Ok(Some(for_display("local", found, &query.title, &query.artist)));
        }
    }
    if query.chinese {
        let (title, artist, duration_ms) = (query.title.clone(), query.artist.clone(), query.duration_ms);
        let cached = tauri::async_runtime::spawn_blocking(move || kugou_cache::find(&title, &artist, duration_ms)).await.ok().flatten();
        if let Some(found) = cached {
            return Ok(Some(for_display("kugou-local", found, &query.title, &query.artist)));
        }
    }
    if !query.online {
        return Ok(None);
    }
    let cache_dir = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?.join(CACHE_DIR_NAME);
    let apple_token = if apple_wanted(&query) { apple_token::read().ok().flatten() } else { None };
    let key = lyrics_cache_key(&query, apple_token.is_some());
    let answer = match read_cache(&cache_dir, &key, now_secs()) {
        Some(cached) => cached,
        None => {
            let (fetched, keep) = fetch_online(&query, apple_token.as_deref()).await?;
            if keep {
                write_cache(&cache_dir, &key, fetched.as_ref(), now_secs());
            }
            fetched
        }
    };
    Ok(answer.map(|(source, found)| for_display(source, found, &query.title, &query.artist)))
}

#[tauri::command]
pub async fn get_inflink_state(check_latest: bool) -> Result<InflinkState, String> {
    inflink::state(check_latest).await
}

#[tauri::command]
pub async fn install_inflink() -> Result<InflinkState, crate::user_error::UserError> {
    inflink::install().await
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppleTokenChanged {
    saved: bool,
}

#[tauri::command]
pub async fn has_apple_music_token() -> Result<bool, UserError> {
    Ok(apple_token::read()?.is_some())
}

#[tauri::command]
pub async fn save_apple_music_token(app: AppHandle, token: String) -> Result<(), UserError> {
    apple_token::save(&token)?;
    let _ = app.emit(APPLE_TOKEN_EVENT, AppleTokenChanged { saved: true });
    Ok(())
}

#[tauri::command]
pub async fn delete_apple_music_token(app: AppHandle) -> Result<(), UserError> {
    apple_token::delete()?;
    let _ = app.emit(APPLE_TOKEN_EVENT, AppleTokenChanged { saved: false });
    Ok(())
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::lyrics::get_lyrics,
            crate::lyrics::get_inflink_state,
            crate::lyrics::install_inflink,
            crate::lyrics::has_apple_music_token,
            crate::lyrics::save_apple_music_token,
            crate::lyrics::delete_apple_music_token,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;

#[cfg(test)]
mod tests {
    use super::*;

    fn found(lrc: &str, translation: Option<&str>) -> FoundLyrics {
        FoundLyrics { lrc: lrc.into(), translation: translation.map(Into::into) }
    }

    #[test]
    fn the_cache_keeps_lyrics_with_their_source_and_recent_misses() {
        let dir = std::env::temp_dir().join(format!("fuyu-lyrics-cache-{}", std::process::id()));
        let now = 1_800_000_000;
        assert_eq!(read_cache(&dir, "a", now), None);
        write_cache(&dir, "a", Some(&("kugou", found("[00:01.00]x", Some("[00:01.00]译")))), now);
        write_cache(&dir, "b", None, now);
        assert_eq!(read_cache(&dir, "a", now + 999_999_999), Some(Some(("kugou", found("[00:01.00]x", Some("[00:01.00]译"))))));
        assert_eq!(read_cache(&dir, "b", now + 60), Some(None));
        assert_eq!(read_cache(&dir, "b", now + MISSING_TTL.as_secs()), None);
        fs::write(cache_path(&dir, "old"), r#"{"key":"old","lrc":"[00:01.00]y","fetchedAt":1}"#).unwrap();
        assert_eq!(read_cache(&dir, "old", now), Some(Some(("lrclib", found("[00:01.00]y", None)))));
        fs::write(cache_path(&dir, "k"), r#"{"key":"k","lrc":"[00:01.00]z","source":"kugou","fetchedAt":1}"#).unwrap();
        assert_eq!(read_cache(&dir, "k", now), None);
        let line = |key: &str| format!(r#"{{"key":"{key}","lrc":"[00:01.00]n","source":"netease","wordTimes":true,"fetchedAt":1}}"#);
        fs::write(cache_path(&dir, "n\u{1f}cn"), line("n\u{1f}cn")).unwrap();
        assert_eq!(read_cache(&dir, "n\u{1f}cn", now), None);
        fs::write(cache_path(&dir, "n"), line("n")).unwrap();
        assert_eq!(read_cache(&dir, "n", now), Some(Some(("netease", found("[00:01.00]n", None)))));
        let timed = r#"{"key":"t","lrc":"[00:01.00]<00:01.00>t<00:02.00>","source":"netease","wordTimes":true,"fetchedAt":1}"#;
        fs::write(cache_path(&dir, "t"), timed).unwrap();
        assert_eq!(read_cache(&dir, "t", now).unwrap().unwrap().0, "netease");
        write_cache(&dir, "q", Some(&("qq", found("[00:01.00]q", None))), now);
        assert_eq!(read_cache(&dir, "q", now), Some(Some(("qq", found("[00:01.00]q", None)))));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn traditional_lyrics_are_shown_simplified_for_a_track_named_in_simplified() {
        let lrc = "[00:31.50] 劃一根火柴 將慵倦的夜點亮";
        let shown = for_display("lrclib", found(lrc, Some("[00:31.50] 劃一根火柴 將慵倦的夜點亮")), "余香", "张小九");
        assert_eq!(shown.lrc, "[00:31.50] 划一根火柴 将慵倦的夜点亮");
        assert_eq!(shown.translation.as_deref(), Some("[00:31.50] 划一根火柴 将慵倦的夜点亮"));
        assert_eq!(for_display("lrclib", found(lrc, None), "餘香", "張小九").lrc, lrc);
    }

    fn query(title: &str, chinese: bool, track_id: Option<&str>) -> LyricsQuery {
        LyricsQuery {
            title: title.into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 0,
            folder: String::new(),
            online: true,
            chinese,
            track_id: track_id.map(Into::into),
            source_app: None,
            apple_music: false,
        }
    }

    #[test]
    fn chinese_songs_ask_the_chinese_sources_first() {
        assert_eq!(source_order(&query("余香", false, None), false), ["lrclib"]);
        assert_eq!(source_order(&query("余香", true, None), false), ["kugou", "qq", "netease", "lrclib"]);
        assert_eq!(source_order(&query("Yesterday", true, None), false), ["lrclib", "kugou", "qq", "netease"]);
        assert_eq!(source_order(&query("Yesterday", true, Some("NCM-1")), false), ["netease", "kugou", "qq", "lrclib"]);
        assert_eq!(source_order(&query("余香", true, None), true), [APPLE_SOURCE, "kugou", "qq", "netease", "lrclib"]);
        assert_eq!(source_order(&query("Yesterday", false, None), true), [APPLE_SOURCE, "lrclib"]);
    }

    #[test]
    fn apple_music_is_asked_only_when_switched_on_for_its_own_player_and_cached_apart() {
        let apple = |on: bool, app: Option<&str>| LyricsQuery { apple_music: on, source_app: app.map(Into::into), ..query("晴天", true, None) };
        assert!(apple_wanted(&apple(true, Some("com.apple.Music"))));
        assert!(!apple_wanted(&apple(false, Some("com.apple.Music"))));
        assert!(!apple_wanted(&apple(true, Some("cloudmusic.exe"))));
        assert!(!apple_wanted(&LyricsQuery { online: false, ..apple(true, Some("com.apple.Music")) }));
        let (plain, with_apple) = (lyrics_cache_key(&query("晴天", true, None), false), lyrics_cache_key(&query("晴天", true, None), true));
        assert_ne!(plain, with_apple);
        assert!(with_apple.ends_with(CHINESE_KEY) && with_apple.contains(APPLE_KEY));
        let dir = std::env::temp_dir().join(format!("fuyu-lyrics-apple-{}", std::process::id()));
        let now = 1_800_000_000;
        let timed = found("[00:01.00]<00:01.00>晴天<00:02.00>", Some("[00:01.00]Sunny"));
        write_cache(&dir, &with_apple, Some(&(APPLE_SOURCE, timed.clone())), now);
        assert_eq!(read_cache(&dir, &with_apple, now), Some(Some((APPLE_SOURCE, timed.clone()))));
        write_cache(&dir, &plain, Some(&(APPLE_SOURCE, timed)), now);
        assert_eq!(read_cache(&dir, &plain, now), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn pruning_keeps_the_newest_files() {
        let dir = std::env::temp_dir().join(format!("fuyu-lyrics-prune-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for name in ["1", "2", "3"] {
            fs::write(dir.join(name), name).unwrap();
            std::thread::sleep(Duration::from_millis(20));
        }
        prune_cache(&dir, 2);
        let mut left: Vec<String> = fs::read_dir(&dir).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into()).collect();
        left.sort();
        assert_eq!(left, ["2", "3"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
