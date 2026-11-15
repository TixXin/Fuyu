use std::{path::PathBuf, sync::Arc};

use sherpa_runtime::{Recognizer, Runtime, SenseVoiceOptions};

fn read_wav(path: &str) -> (i32, Vec<f32>) {
    let bytes = std::fs::read(path).unwrap();
    let format = bytes.windows(4).position(|window| window == b"fmt ").unwrap() + 8;
    let rate = i32::from_le_bytes(bytes[format + 4..format + 8].try_into().unwrap());
    let data = bytes.windows(4).position(|window| window == b"data").unwrap() + 8;
    let samples = bytes[data..].as_chunks::<2>().0.iter().map(|pair| f32::from(i16::from_le_bytes(*pair)) / 32768.0).collect();
    (rate, samples)
}

#[test]
#[ignore = "needs FUYU_SHERPA_RUNTIME_DIR (the unpacked runtime), FUYU_VOICE_MODEL_DIR and a 16-bit mono WAV in FUYU_VOICE_WAV"]
fn recognizes_a_wav_with_the_downloaded_runtime() {
    let runtime = Arc::new(Runtime::load(&PathBuf::from(std::env::var("FUYU_SHERPA_RUNTIME_DIR").unwrap())).unwrap());
    let model_dir = PathBuf::from(std::env::var("FUYU_VOICE_MODEL_DIR").unwrap());
    let options = SenseVoiceOptions { model: &model_dir.join("model.int8.onnx"), tokens: &model_dir.join("tokens.txt"), language: "auto", use_itn: true, threads: 4 };
    let (rate, samples) = read_wav(&std::env::var("FUYU_VOICE_WAV").unwrap());
    for _ in 0..2 {
        let started = std::time::Instant::now();
        let recognizer = Recognizer::sense_voice(Arc::clone(&runtime), &options).unwrap();
        let loaded = started.elapsed();
        let text = recognizer.transcribe(rate, &samples).unwrap();
        println!("loaded in {loaded:?}, recognized in {:?}: {text}", started.elapsed() - loaded);
        assert!(!text.is_empty());
    }
}
