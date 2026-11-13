use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU32, Ordering},
        Mutex, PoisonError,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;

use super::output::{self, Picture};

pub(super) const DEFAULT_KEEP_DAYS: u32 = 7;
pub(super) const KEEP_DAY_CHOICES: [u32; 4] = [1, 7, 30, 90];

static KEEP_DAYS: AtomicU32 = AtomicU32::new(DEFAULT_KEEP_DAYS);
static THUMBNAILS: Mutex<Option<HashMap<PathBuf, (SystemTime, String)>>> = Mutex::new(None);

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryItem {
    pub(crate) path: String,
    pub(crate) taken_at: i64,
    pub(crate) thumbnail: Option<String>,
}

pub(super) fn set_keep_days(days: u32) {
    let days = if KEEP_DAY_CHOICES.contains(&days) { days } else { DEFAULT_KEEP_DAYS };
    KEEP_DAYS.store(days, Ordering::SeqCst);
}

pub(super) fn keep_for() -> Duration {
    Duration::from_secs(u64::from(KEEP_DAYS.load(Ordering::SeqCst)) * 24 * 60 * 60)
}

pub(super) fn png_files(dir: &Path) -> Vec<(SystemTime, PathBuf)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files: Vec<(SystemTime, PathBuf)> = entries
        .flatten()
        .filter(|entry| entry.path().extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png")))
        .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
        .collect();
    files.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    files
}

fn millis(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH).map_or(0, |since| i64::try_from(since.as_millis()).unwrap_or(i64::MAX))
}

pub(super) fn read_picture(path: &Path) -> Result<Picture, String> {
    let image = image::open(path).map_err(|error| format!("Failed to read {}: {error}", path.display()))?.into_rgba8();
    let (width, height) = image.dimensions();
    Ok(Picture { width, height, rgba: image.into_raw() })
}

fn thumbnail_of(path: &Path, modified: SystemTime) -> Option<String> {
    let mut cache = THUMBNAILS.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = cache.get_or_insert_with(HashMap::new);
    if let Some((when, data)) = cache.get(path) {
        if *when == modified {
            return Some(data.clone());
        }
    }
    let data = output::thumbnail(&read_picture(path).ok()?)?;
    cache.insert(path.to_path_buf(), (modified, data.clone()));
    Some(data)
}

pub(super) fn list(dir: &Path) -> Vec<HistoryItem> {
    let files = png_files(dir);
    if let Some(cache) = THUMBNAILS.lock().unwrap_or_else(PoisonError::into_inner).as_mut() {
        cache.retain(|path, _| files.iter().any(|(_, file)| file == path));
    }
    files
        .into_iter()
        .map(|(modified, path)| HistoryItem {
            thumbnail: thumbnail_of(&path, modified),
            taken_at: millis(modified),
            path: path.display().to_string(),
        })
        .collect()
}

pub(super) fn history_file(dir: &Path, path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let inside = path.parent() == Some(dir) && path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    if inside && path.is_file() {
        Ok(path)
    } else {
        Err("This screenshot is no longer in the history.".to_string())
    }
}

pub(super) fn pin_origin(pointer: Option<(i32, i32)>, monitor: (i32, i32, u32, u32), size: (u32, u32)) -> (i32, i32) {
    let (left, top, width, height) = monitor;
    let span = |start: i32, extent: u32, inner: u32, at: Option<i32>| {
        let extent = i64::from(extent);
        let inner = i64::from(inner);
        let centre = at.map_or(i64::from(start) + extent / 2, i64::from);
        let lowest = i64::from(start);
        let highest = (lowest + extent - inner).max(lowest);
        i32::try_from((centre - inner / 2).clamp(lowest, highest)).unwrap_or(start)
    };
    (span(left, width, size.0, pointer.map(|point| point.0)), span(top, height, size.1, pointer.map(|point| point.1)))
}
