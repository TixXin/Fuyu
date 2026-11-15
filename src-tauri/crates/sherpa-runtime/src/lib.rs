mod abi;

use std::{
    ffi::{CStr, CString},
    os::raw::c_void,
    path::Path,
    sync::Arc,
};

use libloading::Library;

use abi::{
    AcceptWaveform, CreateRecognizer, CreateStream, Decode, DestroyRecognizer, DestroyResult, DestroyStream, GetResult, RecognizerConfig,
    SenseVoiceModelConfig, VersionText,
};

pub const VERSION: &str = "2.0.1";

#[cfg(target_os = "windows")]
pub const LIBRARY_FILE: &str = "sherpa-onnx-c-api.dll";
#[cfg(target_os = "macos")]
pub const LIBRARY_FILE: &str = "libsherpa-onnx-c-api.dylib";
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub const LIBRARY_FILE: &str = "libsherpa-onnx-c-api.so";

struct Api {
    create_recognizer: CreateRecognizer,
    destroy_recognizer: DestroyRecognizer,
    create_stream: CreateStream,
    destroy_stream: DestroyStream,
    accept_waveform: AcceptWaveform,
    decode: Decode,
    get_result: GetResult,
    destroy_result: DestroyResult,
}

pub struct Runtime {
    api: Api,
    _library: Library,
}

unsafe impl Send for Runtime {}
unsafe impl Sync for Runtime {}

unsafe fn symbol<T: Copy>(library: &Library, name: &str) -> Result<T, String> {
    let mut bytes = name.as_bytes().to_vec();
    bytes.push(0);
    unsafe { library.get::<T>(&bytes) }.map(|found| *found).map_err(|error| format!("{name}: {error}"))
}

#[cfg(target_os = "windows")]
fn open(path: &Path) -> Result<Library, String> {
    use libloading::os::windows::{Library as WindowsLibrary, LOAD_LIBRARY_SEARCH_DEFAULT_DIRS, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR};
    unsafe { WindowsLibrary::load_with_flags(path, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_DEFAULT_DIRS) }
        .map(Library::from)
        .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "windows"))]
fn open(path: &Path) -> Result<Library, String> {
    unsafe { Library::new(path) }.map_err(|error| error.to_string())
}

impl Runtime {
    pub fn load(dir: &Path) -> Result<Self, String> {
        let library = open(&dir.join(LIBRARY_FILE))?;
        let version: VersionText = unsafe { symbol(&library, "SherpaOnnxGetVersionStr")? };
        let found = unsafe { text(version()) };
        if found != VERSION {
            return Err(format!("Expected sherpa-onnx {VERSION}, found {found}"));
        }
        let api = unsafe {
            Api {
                create_recognizer: symbol(&library, "SherpaOnnxCreateOfflineRecognizer")?,
                destroy_recognizer: symbol(&library, "SherpaOnnxDestroyOfflineRecognizer")?,
                create_stream: symbol(&library, "SherpaOnnxCreateOfflineStream")?,
                destroy_stream: symbol(&library, "SherpaOnnxDestroyOfflineStream")?,
                accept_waveform: symbol(&library, "SherpaOnnxAcceptWaveformOffline")?,
                decode: symbol(&library, "SherpaOnnxDecodeOfflineStream")?,
                get_result: symbol(&library, "SherpaOnnxGetOfflineStreamResult")?,
                destroy_result: symbol(&library, "SherpaOnnxDestroyOfflineRecognizerResult")?,
            }
        };
        Ok(Self { api, _library: library })
    }
}

unsafe fn text(pointer: *const std::os::raw::c_char) -> String {
    if pointer.is_null() {
        return String::new();
    }
    unsafe { CStr::from_ptr(pointer) }.to_string_lossy().into_owned()
}

fn c_text(value: &str) -> Result<CString, String> {
    CString::new(value).map_err(|_| format!("Text contains a NUL byte: {value}"))
}

fn c_path(path: &Path) -> Result<CString, String> {
    path.to_str().ok_or_else(|| format!("The path is not valid Unicode: {}", path.display())).and_then(c_text)
}

pub struct SenseVoiceOptions<'a> {
    pub model: &'a Path,
    pub tokens: &'a Path,
    pub language: &'a str,
    pub use_itn: bool,
    pub threads: i32,
}

pub struct Recognizer {
    runtime: Arc<Runtime>,
    handle: *const c_void,
}

unsafe impl Send for Recognizer {}

impl Recognizer {
    pub fn sense_voice(runtime: Arc<Runtime>, options: &SenseVoiceOptions) -> Result<Self, String> {
        let model = c_path(options.model)?;
        let tokens = c_path(options.tokens)?;
        let language = c_text(options.language)?;
        let mut config: RecognizerConfig = unsafe { std::mem::zeroed() };
        config.model_config.sense_voice = SenseVoiceModelConfig { model: model.as_ptr(), language: language.as_ptr(), use_itn: i32::from(options.use_itn) };
        config.model_config.tokens = tokens.as_ptr();
        config.model_config.num_threads = options.threads.max(1);
        config.model_config.provider = c"cpu".as_ptr();
        let handle = unsafe { (runtime.api.create_recognizer)(&config) };
        if handle.is_null() {
            return Err("sherpa-onnx could not load the model".to_string());
        }
        Ok(Self { runtime, handle })
    }

    pub fn transcribe(&self, sample_rate: i32, samples: &[f32]) -> Result<String, String> {
        let count = i32::try_from(samples.len()).map_err(|_| "The recording is too long".to_string())?;
        let api = &self.runtime.api;
        unsafe {
            let stream = (api.create_stream)(self.handle);
            if stream.is_null() {
                return Err("sherpa-onnx could not create a stream".to_string());
            }
            (api.accept_waveform)(stream, sample_rate, samples.as_ptr(), count);
            (api.decode)(self.handle, stream);
            let result = (api.get_result)(stream);
            let recognized = if result.is_null() { String::new() } else { text((*result).text) };
            if !result.is_null() {
                (api.destroy_result)(result);
            }
            (api.destroy_stream)(stream);
            Ok(recognized)
        }
    }
}

impl Drop for Recognizer {
    fn drop(&mut self) {
        unsafe { (self.runtime.api.destroy_recognizer)(self.handle) }
    }
}

#[cfg(test)]
mod tests {
    use std::mem::{offset_of, size_of};

    use super::abi::{ModelConfig, RecognizerConfig};

    #[test]
    fn config_layout_matches_the_2_0_1_header() {
        assert_eq!(size_of::<RecognizerConfig>(), 624);
        assert_eq!(size_of::<ModelConfig>(), 504);
        assert_eq!(offset_of!(RecognizerConfig, model_config), 8);
        assert_eq!(offset_of!(RecognizerConfig, lm_config), 512);
        assert_eq!(offset_of!(RecognizerConfig, decoding_method), 528);
        assert_eq!(offset_of!(RecognizerConfig, hr), 584);
        assert_eq!(offset_of!(RecognizerConfig, ctc_fst_decoder_config), 608);
        assert_eq!(offset_of!(ModelConfig, tokens), 96);
        assert_eq!(offset_of!(ModelConfig, num_threads), 104);
        assert_eq!(offset_of!(ModelConfig, provider), 112);
        assert_eq!(offset_of!(ModelConfig, sense_voice), 152);
        assert_eq!(offset_of!(ModelConfig, cohere_transcribe), 472);
    }
}
