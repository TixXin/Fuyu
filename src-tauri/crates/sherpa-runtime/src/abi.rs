#![allow(dead_code)]

use std::os::raw::{c_char, c_float, c_void};

type Text = *const c_char;

#[repr(C)]
pub(crate) struct FeatureConfig {
    pub sample_rate: i32,
    pub feature_dim: i32,
}

#[repr(C)]
pub(crate) struct TransducerModelConfig {
    pub encoder: Text,
    pub decoder: Text,
    pub joiner: Text,
}

#[repr(C)]
pub(crate) struct OneModelConfig {
    pub model: Text,
}

#[repr(C)]
pub(crate) struct WhisperModelConfig {
    pub encoder: Text,
    pub decoder: Text,
    pub language: Text,
    pub task: Text,
    pub tail_paddings: i32,
    pub enable_token_timestamps: i32,
    pub enable_segment_timestamps: i32,
}

#[repr(C)]
pub(crate) struct SenseVoiceModelConfig {
    pub model: Text,
    pub language: Text,
    pub use_itn: i32,
}

#[repr(C)]
pub(crate) struct MoonshineModelConfig {
    pub preprocessor: Text,
    pub encoder: Text,
    pub uncached_decoder: Text,
    pub cached_decoder: Text,
    pub merged_decoder: Text,
}

#[repr(C)]
pub(crate) struct EncoderDecoderConfig {
    pub encoder: Text,
    pub decoder: Text,
}

#[repr(C)]
pub(crate) struct CanaryModelConfig {
    pub encoder: Text,
    pub decoder: Text,
    pub src_lang: Text,
    pub tgt_lang: Text,
    pub use_pnc: i32,
}

#[repr(C)]
pub(crate) struct FunAsrNanoModelConfig {
    pub encoder_adaptor: Text,
    pub llm: Text,
    pub embedding: Text,
    pub tokenizer: Text,
    pub system_prompt: Text,
    pub user_prompt: Text,
    pub max_new_tokens: i32,
    pub temperature: c_float,
    pub top_p: c_float,
    pub seed: i32,
    pub language: Text,
    pub itn: i32,
    pub hotwords: Text,
}

#[repr(C)]
pub(crate) struct Qwen3AsrModelConfig {
    pub conv_frontend: Text,
    pub encoder: Text,
    pub decoder: Text,
    pub tokenizer: Text,
    pub max_total_len: i32,
    pub max_new_tokens: i32,
    pub temperature: c_float,
    pub top_p: c_float,
    pub seed: i32,
    pub hotwords: Text,
}

#[repr(C)]
pub(crate) struct CohereTranscribeModelConfig {
    pub encoder: Text,
    pub decoder: Text,
    pub language: Text,
    pub use_punct: i32,
    pub use_itn: i32,
}

#[repr(C)]
pub(crate) struct ModelConfig {
    pub transducer: TransducerModelConfig,
    pub paraformer: OneModelConfig,
    pub nemo_ctc: OneModelConfig,
    pub whisper: WhisperModelConfig,
    pub tdnn: OneModelConfig,
    pub tokens: Text,
    pub num_threads: i32,
    pub debug: i32,
    pub provider: Text,
    pub model_type: Text,
    pub modeling_unit: Text,
    pub bpe_vocab: Text,
    pub telespeech_ctc: Text,
    pub sense_voice: SenseVoiceModelConfig,
    pub moonshine: MoonshineModelConfig,
    pub fire_red_asr: EncoderDecoderConfig,
    pub dolphin: OneModelConfig,
    pub zipformer_ctc: OneModelConfig,
    pub canary: CanaryModelConfig,
    pub wenet_ctc: OneModelConfig,
    pub omnilingual: OneModelConfig,
    pub medasr: OneModelConfig,
    pub funasr_nano: FunAsrNanoModelConfig,
    pub fire_red_asr_ctc: OneModelConfig,
    pub qwen3_asr: Qwen3AsrModelConfig,
    pub cohere_transcribe: CohereTranscribeModelConfig,
}

#[repr(C)]
pub(crate) struct LmConfig {
    pub model: Text,
    pub scale: c_float,
}

#[repr(C)]
pub(crate) struct HomophoneReplacerConfig {
    pub dict_dir: Text,
    pub lexicon: Text,
    pub rule_fsts: Text,
}

#[repr(C)]
pub(crate) struct CtcFstDecoderConfig {
    pub graph: Text,
    pub max_active: i32,
}

#[repr(C)]
pub(crate) struct RecognizerConfig {
    pub feat_config: FeatureConfig,
    pub model_config: ModelConfig,
    pub lm_config: LmConfig,
    pub decoding_method: Text,
    pub max_active_paths: i32,
    pub hotwords_file: Text,
    pub hotwords_score: c_float,
    pub rule_fsts: Text,
    pub rule_fars: Text,
    pub blank_penalty: c_float,
    pub hr: HomophoneReplacerConfig,
    pub ctc_fst_decoder_config: CtcFstDecoderConfig,
}

#[repr(C)]
pub(crate) struct ResultHead {
    pub text: Text,
}

pub(crate) type CreateRecognizer = unsafe extern "C" fn(*const RecognizerConfig) -> *const c_void;
pub(crate) type DestroyRecognizer = unsafe extern "C" fn(*const c_void);
pub(crate) type CreateStream = unsafe extern "C" fn(*const c_void) -> *const c_void;
pub(crate) type DestroyStream = unsafe extern "C" fn(*const c_void);
pub(crate) type AcceptWaveform = unsafe extern "C" fn(*const c_void, i32, *const c_float, i32);
pub(crate) type Decode = unsafe extern "C" fn(*const c_void, *const c_void);
pub(crate) type GetResult = unsafe extern "C" fn(*const c_void) -> *const ResultHead;
pub(crate) type DestroyResult = unsafe extern "C" fn(*const ResultHead);
pub(crate) type VersionText = unsafe extern "C" fn() -> *const c_char;
