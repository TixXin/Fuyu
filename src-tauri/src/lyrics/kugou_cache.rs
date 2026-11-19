use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::SystemTime,
};

use super::found::FoundLyrics;
use super::krc;
use super::matching::same_track;

const MAX_INI_BYTES: u64 = 64 * 1024;
const MAX_KRC_BYTES: u64 = 2 * 1024 * 1024;
const MAX_TRIED: usize = 6;

fn read_limited(path: &Path, limit: u64) -> Option<Vec<u8>> {
    let mut bytes = Vec::new();
    fs::File::open(path).ok()?.take(limit + 1).read_to_end(&mut bytes).ok()?;
    (bytes.len() as u64 <= limit).then_some(bytes)
}

fn ini_text(bytes: &[u8]) -> String {
    let utf16 = |bytes: &[u8], little: bool| {
        let units: Vec<u16> = bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| if little { u16::from_le_bytes([pair[0], pair[1]]) } else { u16::from_be_bytes([pair[0], pair[1]]) })
            .collect();
        String::from_utf16_lossy(&units)
    };
    match bytes {
        [0xff, 0xfe, rest @ ..] => utf16(rest, true),
        [0xfe, 0xff, rest @ ..] => utf16(rest, false),
        [_, 0, ..] => utf16(bytes, true),
        _ => String::from_utf8_lossy(bytes).trim_start_matches('\u{feff}').to_string(),
    }
}

pub(super) fn lyric_folder_in_ini(bytes: &[u8]) -> Option<PathBuf> {
    ini_text(bytes).lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        let value = value.trim().trim_matches('"');
        (key.trim().eq_ignore_ascii_case("LyricPath") && !value.is_empty()).then(|| PathBuf::from(value))
    })
}

pub(super) fn name_in_file(stem: &str) -> Option<(&str, &str)> {
    let (artist, rest) = stem.split_once(" - ")?;
    let cut = rest.match_indices('-').map(|(at, _)| at).find(|&at| {
        let mut parts = rest[at + 1..].split('-');
        let hash_like = parts.next().is_some_and(|hash| hash.len() == 32 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()));
        hash_like && parts.all(|part| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_hexdigit()))
    })?;
    let title = rest[..cut].trim();
    (!title.is_empty()).then_some((title, artist.trim()))
}

fn candidates(folder: &Path, title: &str, artist: &str) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(folder) else {
        return Vec::new();
    };
    let mut found: Vec<(SystemTime, PathBuf)> = entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.extension()?.eq_ignore_ascii_case("krc") {
                return None;
            }
            let (name, singer) = name_in_file(path.file_stem()?.to_str()?)?;
            if !same_track((title, artist, 0), (name, singer, 0)) {
                return None;
            }
            let metadata = entry.metadata().ok()?;
            (metadata.is_file() && metadata.len() <= MAX_KRC_BYTES).then(|| (metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH), path))
        })
        .collect();
    found.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    found.into_iter().take(MAX_TRIED).map(|(_, path)| path).collect()
}

pub(super) fn lyrics_in_file(text: &str, title: &str, artist: &str, duration_ms: i64) -> Option<FoundLyrics> {
    let name = krc::header(text, "ti").filter(|name| !name.is_empty()).unwrap_or(title);
    let singer = krc::header(text, "ar").filter(|singer| !singer.is_empty()).unwrap_or(artist);
    let total = krc::header(text, "total").and_then(|total| total.parse().ok()).unwrap_or(0);
    if !same_track((title, artist, duration_ms), (name, singer, total)) {
        return None;
    }
    krc::to_lyrics(text, title)
}

fn find_in(folder: &Path, title: &str, artist: &str, duration_ms: i64) -> Option<FoundLyrics> {
    candidates(folder, title, artist).into_iter().find_map(|path| {
        let text = krc::decrypt_bytes(&read_limited(&path, MAX_KRC_BYTES)?)?;
        lyrics_in_file(&text, title, artist, duration_ms)
    })
}

fn folders() -> Vec<PathBuf> {
    let mut folders = Vec::new();
    if let Some(app_data) = std::env::var_os("APPDATA") {
        let ini = PathBuf::from(app_data).join("KuGou8").join("KuGou.ini");
        if let Some(folder) = read_limited(&ini, MAX_INI_BYTES).and_then(|bytes| lyric_folder_in_ini(&bytes)) {
            folders.push(folder);
        }
    }
    if let Some(drive) = std::env::var_os("SystemDrive") {
        let folder = PathBuf::from(format!("{}\\", drive.to_string_lossy())).join("KuGou").join("Lyric");
        if !folders.contains(&folder) {
            folders.push(folder);
        }
    }
    folders
}

pub(super) fn find(title: &str, artist: &str, duration_ms: i64) -> Option<FoundLyrics> {
    folders().iter().find_map(|folder| find_in(folder, title, artist, duration_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_lyric_folder_is_read_from_the_kugou_ini_in_any_encoding() {
        let ini = "[Lyric]\r\nShow=1\r\nLyricPath=D:\\KuGou\\Lyric\\\r\n";
        let expected = Some(PathBuf::from("D:\\KuGou\\Lyric\\"));
        assert_eq!(lyric_folder_in_ini(ini.as_bytes()), expected);
        let utf16: Vec<u8> = [0xff, 0xfe].into_iter().chain(ini.encode_utf16().flat_map(u16::to_le_bytes)).collect();
        assert_eq!(lyric_folder_in_ini(&utf16), expected);
        let bare: Vec<u8> = ini.encode_utf16().flat_map(u16::to_le_bytes).collect();
        assert_eq!(lyric_folder_in_ini(&bare), expected);
        assert_eq!(lyric_folder_in_ini(b"[Lyric]\nLyricPath=\n"), None);
    }

    #[test]
    fn cached_file_names_carry_the_artist_and_title() {
        let hash = "0123456789abcdef0123456789ABCDEF";
        assert_eq!(name_in_file(&format!("周杰伦 - 晴天-{hash}-12345678-00000000")), Some(("晴天", "周杰伦")));
        assert_eq!(name_in_file(&format!("A - Back-Home-{hash}-1f")), Some(("Back-Home", "A")));
        assert_eq!(name_in_file("周杰伦 - 晴天-1234-5678"), None);
        assert_eq!(name_in_file(&format!("晴天-{hash}")), None);
    }

    #[test]
    fn the_header_must_name_the_playing_song() {
        let krc = "[ti:晴天]\n[ar:周杰伦]\n[total:269000]\n[1000,1200]<0,600,0>故事的<600,600,0>小黄花\n";
        let found = lyrics_in_file(krc, "晴天", "周杰伦", 269_500).unwrap();
        assert_eq!(found.lrc, "[00:01.00]<00:01.00>故事的<00:01.60>小黄花<00:02.20>\n");
        assert_eq!(lyrics_in_file(krc, "晴天", "周杰伦", 200_000), None);
        assert_eq!(lyrics_in_file(krc, "晴天", "五月天", 0), None);
        let headerless = "[1000,1200]<0,600,0>故事的<600,600,0>小黄花\n";
        assert!(lyrics_in_file(headerless, "晴天", "周杰伦", 0).is_some());
    }
}
