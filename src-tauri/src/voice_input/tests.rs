use std::{fs, io::Write, path::PathBuf};

use sha2::Digest;

use super::engine::tidy;
use super::model;
use super::packs::{file_name, Pack, PackFile, MODEL, MODEL_FILE, RUNTIME, TOKENS_FILE};
use super::session::{long_enough, sample_limit, VoiceInputState, MAX_SECONDS};

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-voice-input-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn archive(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let encoder = bzip2::write::BzEncoder::new(Vec::new(), bzip2::Compression::fast());
    let mut builder = tar::Builder::new(encoder);
    for (path, body) in entries {
        let mut header = tar::Header::new_gnu();
        header.set_size(body.len() as u64);
        header.set_mode(0o644);
        header.set_cksum();
        builder.append_data(&mut header, path, *body).unwrap();
    }
    let mut encoder = builder.into_inner().unwrap();
    encoder.flush().unwrap();
    encoder.finish().unwrap()
}

static NESTED: Pack = Pack {
    dir: "runtime",
    url: "",
    sha256: "",
    bytes: 1,
    files: &[
        PackFile { entry: "lib/core.dll", sha256: Some("2b39f7bbe8fa50b6a5ffc63ea0bba18a7e3cc9b7c3f2d6e9d81d3dbdce3c5f1d") },
        PackFile { entry: "lib/helper.dll", sha256: None },
    ],
};

#[test]
fn unpacking_keeps_only_the_model_and_tokens_from_the_top_folder() {
    let dir = scratch("unpack");
    let target = dir.join("sense-voice-int8");
    let bytes = archive(&[
        ("pack/model.int8.onnx", b"model"),
        ("pack/tokens.txt", b"tokens"),
        ("pack/test_wavs/tokens.txt", b"wrong"),
        ("pack/README.md", b"readme"),
    ]);
    model::unpack(&MODEL, bytes.as_slice(), &target).unwrap();
    assert_eq!(fs::read(target.join(MODEL_FILE)).unwrap(), b"model");
    assert_eq!(fs::read(target.join(TOKENS_FILE)).unwrap(), b"tokens");
    assert_eq!(fs::read_dir(&target).unwrap().count(), 2);
    assert!(model::has_files(&MODEL, &target));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn runtime_libraries_are_taken_from_the_lib_folder_and_flattened() {
    let dir = scratch("runtime");
    let target = dir.join("runtime");
    let bytes = archive(&[("pack/lib/core.dll", b"core"), ("pack/lib/helper.dll", b"helper"), ("pack/lib/core.lib", b"import"), ("pack/core.dll", b"wrong")]);
    model::unpack(&NESTED, bytes.as_slice(), &target).unwrap();
    assert_eq!(fs::read(target.join("core.dll")).unwrap(), b"core");
    assert_eq!(fs::read(target.join("helper.dll")).unwrap(), b"helper");
    assert_eq!(fs::read_dir(&target).unwrap().count(), 2);
    assert!(model::verify(&NESTED, &target).is_err());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn verifying_checks_every_library_against_its_digest() {
    let dir = scratch("verify");
    fs::write(dir.join("core.dll"), b"core").unwrap();
    let digest = model::file_sha256(&dir.join("core.dll")).unwrap();
    assert_eq!(digest, model::sha256_hex(&sha2::Sha256::digest(b"core")));
    let wanted = Box::leak(Box::new([PackFile { entry: "lib/core.dll", sha256: Some(Box::leak(digest.into_boxed_str())) }]));
    let pack = Pack { dir: "runtime", url: "", sha256: "", bytes: 1, files: wanted };
    assert!(model::verify(&pack, &dir).is_ok());
    fs::write(dir.join("core.dll"), b"changed").unwrap();
    assert!(model::verify(&pack, &dir).is_err());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn an_archive_without_the_model_is_rejected_and_leaves_nothing_behind() {
    let dir = scratch("missing");
    let target = dir.join("sense-voice-int8");
    let bytes = archive(&[("pack/tokens.txt", b"tokens")]);
    assert!(model::unpack(&MODEL, bytes.as_slice(), &target).is_err());
    assert!(!target.exists());
    assert!(!target.with_extension("partial").exists());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn a_missing_install_asks_for_both_packs() {
    let dir = scratch("remove");
    let root = dir.join("absent");
    assert!(model::remove(&root).is_ok());
    let status = model::status(&root, false);
    assert!(!status.installed);
    assert_eq!(status.size_bytes, 0);
    assert_eq!(status.supported, RUNTIME.is_some());
    assert_eq!(status.download_bytes, model::packs().iter().map(|pack| pack.bytes).sum::<u64>());
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn pack_files_are_named_by_their_last_part() {
    assert_eq!(file_name("lib/onnxruntime.dll"), "onnxruntime.dll");
    assert_eq!(file_name(MODEL_FILE), MODEL_FILE);
    for pack in model::packs() {
        assert_eq!(pack.sha256.len(), 64);
        assert!(pack.files.iter().all(|file| file.sha256.is_none_or(|digest| digest.len() == 64)));
        assert!(pack.url.starts_with("https://github.com/k2-fsa/sherpa-onnx/releases/download/"));
    }
    for runtime in RUNTIME.iter() {
        assert!(runtime.files.iter().all(|file| file.sha256.is_some()));
    }
}

#[test]
fn digests_are_lowercase_hex() {
    assert_eq!(model::sha256_hex(&[0x00, 0xab, 0x7f]), "00ab7f");
}

#[test]
fn recordings_are_capped_and_very_short_ones_are_skipped() {
    assert_eq!(sample_limit(48_000), 48_000 * MAX_SECONDS as usize);
    assert!(!long_enough(4_800, 48_000));
    assert!(long_enough(14_400, 48_000));
    assert!(!long_enough(100, 0));
}

#[test]
fn recognized_text_is_trimmed() {
    assert_eq!(tidy("  hello   world \n"), "hello world");
    assert_eq!(tidy("今天下午三点开会。"), "今天下午三点开会。");
}

#[test]
fn states_are_tagged_by_phase() {
    let recording = serde_json::to_value(VoiceInputState::Recording { started_at_ms: 5, limit_seconds: 120 }).unwrap();
    assert_eq!(recording, serde_json::json!({ "phase": "recording", "startedAtMs": 5, "limitSeconds": 120 }));
    let result = serde_json::to_value(VoiceInputState::Result { text: "hi".to_string() }).unwrap();
    assert_eq!(result, serde_json::json!({ "phase": "result", "text": "hi" }));
}

#[test]
#[ignore = "records the real microphone for FUYU_VOICE_SECONDS (default 6) and recognizes it with the packs installed under FUYU_VOICE_ROOT"]
fn records_the_microphone_and_recognizes_it() {
    use std::sync::{Arc, Mutex};
    let root = PathBuf::from(std::env::var("FUYU_VOICE_ROOT").unwrap());
    let seconds = std::env::var("FUYU_VOICE_SECONDS").ok().and_then(|value| value.parse().ok()).unwrap_or(6);
    let samples = Arc::new(Mutex::new(Vec::new()));
    let sink = Arc::clone(&samples);
    let (capture, rate) = super::capture::start(move |chunk: &[f32]| sink.lock().unwrap().extend_from_slice(chunk)).unwrap();
    println!("recording at {rate} Hz");
    std::thread::sleep(std::time::Duration::from_secs(seconds));
    drop(capture);
    let samples = samples.lock().unwrap().clone();
    let peak = samples.iter().fold(0.0f32, |peak, sample| peak.max(sample.abs()));
    println!("{} samples, peak {peak:.3}", samples.len());
    let started = std::time::Instant::now();
    let text = super::engine::transcribe(&root, &samples, rate).unwrap();
    println!("recognized in {:?}: {text}", started.elapsed());
    assert!(samples.len() as u64 >= u64::from(rate) * seconds / 2);
}
