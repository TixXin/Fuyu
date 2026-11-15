use crate::user_error::UserError;
use crate::win32::audio_capture::{AudioCapture, AudioSource, CHANNELS, SAMPLE_RATE};

pub(crate) struct Capture {
    _capture: AudioCapture,
}

pub(crate) fn start<F>(mut on_samples: F) -> Result<(Capture, u32), UserError>
where
    F: FnMut(&[f32]) + Send + 'static,
{
    let channels = usize::from(CHANNELS).max(1);
    let capture = AudioCapture::start(AudioSource::Microphone, move |samples, _| {
        let mono: Vec<f32> = samples.chunks(channels).map(|frame| frame.iter().sum::<f32>() / frame.len() as f32).collect();
        on_samples(&mono);
    })
    .map_err(|error| UserError::new("voiceInput.micFailed", "Could not use the microphone.").detail(error))?;
    Ok((Capture { _capture: capture }, SAMPLE_RATE))
}
