use super::session::media_error;
use crate::win32::audio::CachedRenderAudio;

pub(super) const AUDIO_ACTIVE_THRESHOLD: f32 = 0.000015;

fn ensure_audio(slot: &mut Option<CachedRenderAudio>) -> Result<&mut CachedRenderAudio, String> {
    if slot.is_none() {
        let opened = CachedRenderAudio::open().map_err(|error| {
            media_error("Failed to open the Windows audio device manager", error)
        })?;
        *slot = Some(opened);
    }
    slot.as_mut()
        .ok_or_else(|| "Windows audio device manager is unavailable.".to_string())
}

pub(super) fn read_master_volume(slot: &mut Option<CachedRenderAudio>) -> Option<f32> {
    ensure_audio(slot).ok()?.master_volume().ok()
}

pub(super) fn set_master_volume(
    slot: &mut Option<CachedRenderAudio>,
    level: f32,
) -> Result<(), String> {
    let audio = ensure_audio(slot)?;
    audio
        .set_master_volume(level)
        .map_err(|error| media_error("Failed to change the system volume", error))
}

pub(super) fn read_system_audio_peak(
    slot: &mut Option<CachedRenderAudio>,
) -> Result<f32, String> {
    let audio = ensure_audio(slot)?;
    audio
        .peak()
        .map_err(|error| media_error("No default Windows audio output was available", error))
}
