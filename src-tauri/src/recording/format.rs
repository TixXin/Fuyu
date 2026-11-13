use std::path::{Path, PathBuf};

pub(crate) const MAX_SIDE: u32 = 4096;
pub(crate) const DEFAULT_FPS: u32 = 30;
pub(crate) const MAX_FPS: u32 = 60;

pub(crate) fn even(value: u32) -> u32 {
    (value & !1).max(2)
}

pub(crate) fn fit(width: u32, height: u32) -> (u32, u32) {
    let (width, height) = (even(width), even(height));
    let longest = width.max(height);
    if longest <= MAX_SIDE {
        return (width, height);
    }
    let scale = |side: u32| even((u64::from(side) * u64::from(MAX_SIDE) / u64::from(longest)) as u32);
    (scale(width), scale(height))
}

pub(crate) fn fps(wanted: Option<u32>) -> u32 {
    wanted.unwrap_or(DEFAULT_FPS).clamp(1, MAX_FPS)
}

pub(crate) fn bitrate(width: u32, height: u32, fps: u32) -> u32 {
    let weight = 30 + fps.saturating_sub(30) / 2;
    let bits = u64::from(width) * u64::from(height) * u64::from(weight) / 10;
    bits.clamp(2_000_000, 80_000_000) as u32
}

pub(crate) fn capture_buffers(fps: u32) -> u32 {
    (fps * 2).div_ceil(30).clamp(2, 4)
}

pub(crate) fn file_name_in(folder: &Path, now: chrono::DateTime<chrono::Local>) -> PathBuf {
    let stem = format!("Fuyu_{}", now.format("%Y-%m-%d_%H-%M-%S"));
    let mut path = folder.join(format!("{stem}.mp4"));
    let mut next = 2;
    while path.exists() {
        path = folder.join(format!("{stem}_{next}.mp4"));
        next += 1;
    }
    path
}
