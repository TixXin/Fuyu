use std::{
    collections::HashMap,
    io::Cursor,
    path::{Path, PathBuf},
    sync::{Mutex, PoisonError},
    time::SystemTime,
};

use base64::{engine::general_purpose, Engine};
use image::{codecs::jpeg::JpegEncoder, ImageReader};

pub(crate) const MAX_SIDE: u32 = 960;
const QUALITY: u8 = 85;

type Stamp = (SystemTime, u64);

static CACHE: Mutex<Option<HashMap<PathBuf, (Stamp, String)>>> = Mutex::new(None);

fn stamp(path: &Path) -> Option<Stamp> {
    let meta = std::fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

pub(crate) fn encode(path: &Path) -> Option<String> {
    let image = ImageReader::open(path).ok()?.with_guessed_format().ok()?.decode().ok()?;
    let image = if image.width().max(image.height()) > MAX_SIDE {
        image.thumbnail(MAX_SIDE, MAX_SIDE)
    } else {
        image
    };
    let mut jpeg = Cursor::new(Vec::new());
    JpegEncoder::new_with_quality(&mut jpeg, QUALITY).encode_image(&image.to_rgb8()).ok()?;
    Some(format!("data:image/jpeg;base64,{}", general_purpose::STANDARD.encode(jpeg.into_inner())))
}

pub(crate) fn data_urls(paths: &[PathBuf]) -> Vec<Option<String>> {
    let mut guard = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    let cache = guard.get_or_insert_with(HashMap::new);
    cache.retain(|path, _| paths.contains(path));
    paths
        .iter()
        .map(|path| {
            let stamp = stamp(path)?;
            if let Some((cached, url)) = cache.get(path) {
                if *cached == stamp {
                    return Some(url.clone());
                }
            }
            let url = encode(path)?;
            cache.insert(path.clone(), (stamp, url.clone()));
            Some(url)
        })
        .collect()
}
