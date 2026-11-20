use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, PoisonError,
    },
};

use serde::{Deserialize, Serialize};

use crate::platform::ocr::OcrWord;

const SUFFIX: &str = "words.json";

static ENABLED: AtomicBool = AtomicBool::new(true);
static READING: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryWord {
    pub(crate) text: String,
    pub(crate) x: f32,
    pub(crate) y: f32,
    pub(crate) width: f32,
    pub(crate) height: f32,
}

pub(super) fn set_enabled(enabled: bool) {
    ENABLED.store(enabled, Ordering::SeqCst);
}

pub(super) fn words_file(png: &Path) -> PathBuf {
    png.with_extension(SUFFIX)
}

fn is_words_file(path: &Path) -> bool {
    path.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.to_ascii_lowercase().ends_with(&format!(".{SUFFIX}")))
}

pub(super) fn normalized(lines: Vec<Vec<OcrWord>>, width: u32, height: u32) -> Vec<Vec<HistoryWord>> {
    if width == 0 || height == 0 {
        return Vec::new();
    }
    let (width, height) = (width as f32, height as f32);
    let unit = |value: f32| value.clamp(0.0, 1.0);
    lines
        .into_iter()
        .map(|words| {
            words
                .into_iter()
                .filter(|word| !word.text.trim().is_empty())
                .map(|word| HistoryWord {
                    text: word.text.trim().to_string(),
                    x: unit(word.x / width),
                    y: unit(word.y / height),
                    width: unit(word.width / width),
                    height: unit(word.height / height),
                })
                .collect::<Vec<_>>()
        })
        .filter(|words| !words.is_empty())
        .collect()
}

pub(super) fn write(png: &Path, lines: &[Vec<HistoryWord>]) -> Result<(), String> {
    let json = serde_json::to_vec(lines).map_err(|error| format!("Failed to encode the screenshot text: {error}"))?;
    let path = words_file(png);
    fs::write(&path, json).map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

pub(super) fn read(png: &Path) -> Option<Vec<Vec<HistoryWord>>> {
    serde_json::from_slice(&fs::read(words_file(png)).ok()?).ok()
}

pub(super) fn remove(png: &Path) {
    let _ = fs::remove_file(words_file(png));
}

pub(super) fn orphans(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| is_words_file(path))
        .filter(|path| {
            let name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
            let stem = &name[..name.len() - SUFFIX.len() - 1];
            !path.with_file_name(format!("{stem}.png")).is_file()
        })
        .collect()
}

pub(super) fn index(png: &Path) -> bool {
    if !ENABLED.load(Ordering::SeqCst) {
        return false;
    }
    let _reading = READING.lock().unwrap_or_else(PoisonError::into_inner);
    let Ok(picture) = super::history::read_picture(png) else {
        return false;
    };
    let lines = crate::platform::ocr::recognize_words(picture.width, picture.height, &picture.rgba).unwrap_or_default();
    let lines = normalized(lines, picture.width, picture.height);
    if !png.is_file() {
        return false;
    }
    match write(png, &lines) {
        Ok(()) => true,
        Err(error) => {
            eprintln!("screenshot text not kept: {error}");
            false
        }
    }
}
