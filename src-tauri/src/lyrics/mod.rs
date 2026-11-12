mod found;
mod inflink;
mod krc;
mod kugou;
mod local;
mod lrclib;
mod matching;
mod netease;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use found::FoundLyrics;
pub use inflink::InflinkState;
use matching::{cache_key, named_in_simplified, stable_hash, traditional_chars};
use crate::win32::chinese::to_simplified;

const CACHE_DIR_NAME: &str = "lyrics-cache";
const MISSING_TTL: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const MAX_CACHED: usize = 2000;

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
    fetched_at: u64,
}

type Answer = (&'static str, FoundLyrics);

fn source_name(name: &str) -> &'static str {
    match name {
        "kugou" => "kugou",
        "netease" => "netease",
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

fn source_order(query: &LyricsQuery) -> Vec<&'static str> {
    if !query.chinese {
        return vec!["lrclib"];
    }
    let chinese_named = format!("{}{}", query.title, query.artist).chars().any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c));
    match (netease::track_id(query.track_id.as_deref()).is_some(), chinese_named) {
        (true, _) => vec!["netease", "kugou", "lrclib"],
        (false, true) => vec!["kugou", "netease", "lrclib"],
        (false, false) => vec!["lrclib", "kugou", "netease"],
    }
}

async fn fetch_online(query: &LyricsQuery) -> Result<Option<Answer>, String> {
    let (title, artist) = (query.title.as_str(), query.artist.as_str());
    let mut errors = Vec::new();
    let mut answered = false;
    for source in source_order(query) {
        let result = match source {
            "kugou" => kugou::fetch(title, artist, query.duration_ms).await,
            "netease" => netease::fetch(title, artist, query.duration_ms, query.track_id.as_deref()).await,
            _ => lrclib::fetch(title, artist, &query.album, query.duration_ms)
                .await
                .map(|lrc| lrc.map(|lrc| FoundLyrics { lrc, translation: None })),
        };
        match result {
            Ok(Some(found)) => return Ok(Some((source, found))),
            Ok(None) => answered = true,
            Err(error) => errors.push(error),
        }
    }
    if answered {
        Ok(None)
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
        if let Some(lrc) = found {
            return Ok(Some(for_display("local", FoundLyrics { lrc, translation: None }, &query.title, &query.artist)));
        }
    }
    if !query.online {
        return Ok(None);
    }
    let cache_dir = crate::home_dir::fuyu_home(app.path()).map_err(|error| error.to_string())?.join(CACHE_DIR_NAME);
    let mut key = cache_key(&query.title, &query.artist, query.duration_ms);
    if query.chinese {
        key.push_str("\u{1f}cn");
    }
    let answer = match read_cache(&cache_dir, &key, now_secs()) {
        Some(cached) => cached,
        None => {
            let fetched = fetch_online(&query).await?;
            write_cache(&cache_dir, &key, fetched.as_ref(), now_secs());
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
pub async fn install_inflink() -> Result<InflinkState, String> {
    inflink::install().await
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::lyrics::get_lyrics,
            crate::lyrics::get_inflink_state,
            crate::lyrics::install_inflink,
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
        let dir = std::env::temp_dir().join(format!("focusd-lyrics-cache-{}", std::process::id()));
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
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn traditional_lyrics_are_shown_simplified_for_a_track_named_in_simplified() {
        let lrc = "[00:31.50] 劃一根火柴 將慵倦的夜點亮";
        let shown = for_display("lrclib", found(lrc, Some("[00:31.50] 劃一根火柴 將慵倦的夜點亮")), "余香", "张小九");
        assert_eq!(shown.lrc, "[00:31.50] 划一根火柴 将慵倦的夜点亮");
        assert_eq!(shown.translation.as_deref(), Some("[00:31.50] 划一根火柴 将慵倦的夜点亮"));
        assert_eq!(for_display("lrclib", found(lrc, None), "餘香", "張小九").lrc, lrc);
    }

    #[test]
    fn chinese_songs_ask_the_chinese_sources_first() {
        let query = |title: &str, chinese: bool, track_id: Option<&str>| LyricsQuery {
            title: title.into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 0,
            folder: String::new(),
            online: true,
            chinese,
            track_id: track_id.map(Into::into),
        };
        assert_eq!(source_order(&query("余香", false, None)), ["lrclib"]);
        assert_eq!(source_order(&query("余香", true, None)), ["kugou", "netease", "lrclib"]);
        assert_eq!(source_order(&query("Yesterday", true, None)), ["lrclib", "kugou", "netease"]);
        assert_eq!(source_order(&query("Yesterday", true, Some("NCM-1"))), ["netease", "kugou", "lrclib"]);
    }

    #[test]
    fn pruning_keeps_the_newest_files() {
        let dir = std::env::temp_dir().join(format!("focusd-lyrics-prune-{}", std::process::id()));
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
