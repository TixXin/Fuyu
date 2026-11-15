use std::{
    path::Path,
    sync::{Arc, Mutex, PoisonError},
    thread,
    time::{Duration, Instant},
};

use sherpa_runtime::{Recognizer, Runtime, SenseVoiceOptions};

use super::model;
use super::packs::{MODEL, MODEL_FILE, RUNTIME, TOKENS_FILE};
use crate::user_error::UserError;

const IDLE_UNLOAD: Duration = Duration::from_secs(120);
const UNLOAD_CHECK: Duration = Duration::from_secs(15);
const MAX_THREADS: usize = 4;

struct Loaded {
    recognizer: Recognizer,
    last_used: Instant,
}

struct Engine {
    runtime: Option<Arc<Runtime>>,
    loaded: Option<Loaded>,
    watching: bool,
}

static ENGINE: Mutex<Engine> = Mutex::new(Engine { runtime: None, loaded: None, watching: false });

fn threads() -> i32 {
    let available = thread::available_parallelism().map(|count| count.get()).unwrap_or(2);
    i32::try_from(available.clamp(1, MAX_THREADS)).unwrap_or(2)
}

fn broken(error: String) -> UserError {
    UserError::new("voiceInput.modelBroken", "The speech model could not be loaded; delete it and download it again.").detail(error)
}

fn runtime(engine: &mut Engine, root: &Path) -> Result<Arc<Runtime>, UserError> {
    if let Some(runtime) = &engine.runtime {
        return Ok(Arc::clone(runtime));
    }
    let pack = RUNTIME.as_ref().ok_or_else(|| broken("Voice input is not available on this system.".to_string()))?;
    let dir = model::pack_dir(root, pack);
    model::verify(pack, &dir).map_err(broken)?;
    let runtime = Arc::new(Runtime::load(&dir).map_err(broken)?);
    engine.runtime = Some(Arc::clone(&runtime));
    Ok(runtime)
}

fn load(engine: &mut Engine, root: &Path) -> Result<Recognizer, UserError> {
    let runtime = runtime(engine, root)?;
    let dir = model::pack_dir(root, &MODEL);
    let options = SenseVoiceOptions { model: &dir.join(MODEL_FILE), tokens: &dir.join(TOKENS_FILE), language: "auto", use_itn: true, threads: threads() };
    Recognizer::sense_voice(runtime, &options).map_err(broken)
}

fn watch_idle() {
    thread::spawn(|| loop {
        thread::sleep(UNLOAD_CHECK);
        let mut engine = ENGINE.lock().unwrap_or_else(PoisonError::into_inner);
        let idle = engine.loaded.as_ref().is_none_or(|loaded| loaded.last_used.elapsed() >= IDLE_UNLOAD);
        if idle {
            engine.loaded = None;
            engine.watching = false;
            return;
        }
    });
}

pub(crate) fn tidy(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

pub(crate) fn transcribe(root: &Path, samples: &[f32], sample_rate: u32) -> Result<String, UserError> {
    let mut engine = ENGINE.lock().unwrap_or_else(PoisonError::into_inner);
    if engine.loaded.is_none() {
        let recognizer = load(&mut engine, root)?;
        engine.loaded = Some(Loaded { recognizer, last_used: Instant::now() });
    }
    if !engine.watching {
        engine.watching = true;
        watch_idle();
    }
    let Some(loaded) = engine.loaded.as_mut() else {
        return Ok(String::new());
    };
    let text = loaded.recognizer.transcribe(i32::try_from(sample_rate).unwrap_or(16_000), samples).map_err(broken)?;
    loaded.last_used = Instant::now();
    Ok(tidy(&text))
}

pub(crate) fn unload() {
    let mut engine = ENGINE.lock().unwrap_or_else(PoisonError::into_inner);
    engine.loaded = None;
    engine.runtime = None;
}
