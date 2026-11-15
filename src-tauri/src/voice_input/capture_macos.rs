use crate::macos::microphone::{Microphone, MicrophoneError};
use crate::user_error::UserError;

pub(crate) struct Capture {
    _microphone: Microphone,
}

pub(crate) fn start<F>(on_samples: F) -> Result<(Capture, u32), UserError>
where
    F: FnMut(&[f32]) + Send + 'static,
{
    match Microphone::start(on_samples) {
        Ok((microphone, rate)) => Ok((Capture { _microphone: microphone }, rate)),
        Err(MicrophoneError::Denied) => Err(UserError::new("voiceInput.micDenied", "The island is not allowed to use the microphone.")),
        Err(MicrophoneError::Failed(detail)) => Err(UserError::new("voiceInput.micFailed", "Could not use the microphone.").detail(detail)),
    }
}
