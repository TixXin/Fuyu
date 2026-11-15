pub(crate) struct PackFile {
    pub entry: &'static str,
    pub sha256: Option<&'static str>,
}

pub(crate) struct Pack {
    pub dir: &'static str,
    pub url: &'static str,
    pub sha256: &'static str,
    pub bytes: u64,
    pub files: &'static [PackFile],
}

pub(crate) const MODEL_FILE: &str = "model.int8.onnx";
pub(crate) const TOKENS_FILE: &str = "tokens.txt";

const fn data(entry: &'static str) -> PackFile {
    PackFile { entry, sha256: None }
}

const fn library(entry: &'static str, sha256: &'static str) -> PackFile {
    PackFile { entry, sha256: Some(sha256) }
}

pub(crate) static MODEL: Pack = Pack {
    dir: "sense-voice-int8",
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2",
    sha256: "7d1efa2138a65b0b488df37f8b89e3d91a60676e416f515b952358d83dfd347e",
    bytes: 163_002_883,
    files: &[data(MODEL_FILE), data(TOKENS_FILE)],
};

const RUNTIME_DIR: &str = "sherpa-onnx-2.0.1";

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
pub(crate) static RUNTIME: Option<Pack> = Some(Pack {
    dir: RUNTIME_DIR,
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-osx-arm64-shared-no-tts-lib.tar.bz2",
    sha256: "ac5594ad237db56ec4a6c4b3fc48700441b33a07bb71c235f35530a52a93f2e3",
    bytes: 8_455_084,
    files: &[
        library("lib/libsherpa-onnx-c-api.dylib", "2a169fe29c7e75168cc308b0d5b7f9085efebbb3a7f812d46c3a983d6788759f"),
        library("lib/libonnxruntime.dylib", "3567d114f7299d559993e536d605a6f46d7bc9d2542004accc80ee9bf5457f0b"),
    ],
});

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
pub(crate) static RUNTIME: Option<Pack> = Some(Pack {
    dir: RUNTIME_DIR,
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-osx-x64-shared-no-tts-lib.tar.bz2",
    sha256: "b0107b8166c4131245380bc9b984345c4ea8637c65807f09ca5f501c72926be5",
    bytes: 9_632_197,
    files: &[
        library("lib/libsherpa-onnx-c-api.dylib", "2694b4549db9ecf168b8faf4718913a5b9b6271640abcab92dba349d3f8df15e"),
        library("lib/libonnxruntime.dylib", "2bf27180c09e6fd3f407c9ab25205ebf1ff95f2d53bfa35e35409b5849e0ac70"),
    ],
});

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
pub(crate) static RUNTIME: Option<Pack> = Some(Pack {
    dir: RUNTIME_DIR,
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-win-x64-shared-MT-Release-no-tts-lib.tar.bz2",
    sha256: "21da6a8b92d63ca02ad41dbfc120012343aaaec2e5e02b14819c6b4f38004509",
    bytes: 7_655_517,
    files: &[
        library("lib/sherpa-onnx-c-api.dll", "ee2af9f49b8fc5dae135ad20c0b955cbab90d17b79cc1ad0db91e03b24962f68"),
        library("lib/onnxruntime.dll", "7f66f939a881baf4f46a2216496798edf4a1429878b646d12674aa62f27d8a25"),
        library("lib/onnxruntime_providers_shared.dll", "551d0e1fe4c227d8542314ba718d52f4379e0c7bfe729a37c59833a884e27b4d"),
    ],
});

#[cfg(all(target_os = "windows", target_arch = "aarch64"))]
pub(crate) static RUNTIME: Option<Pack> = Some(Pack {
    dir: RUNTIME_DIR,
    url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.1/sherpa-onnx-v2.0.1-win-arm64-shared-MT-Release-no-tts-lib.tar.bz2",
    sha256: "b3099bec60e6c3958275e90d0803d837cfe3ad6ed08528f29505d713b3a3e1bb",
    bytes: 7_310_187,
    files: &[
        library("lib/sherpa-onnx-c-api.dll", "4bb5212e66d712012b38bd51495480b71652c0b8effc0e61a6e53b83fd2c2a09"),
        library("lib/onnxruntime.dll", "968d081836cad9af537105f59e34d4997bca2ce6d78ff39d3e47660620e8a642"),
        library("lib/onnxruntime_providers_shared.dll", "05fb0cc694b0671db544e77c55c3736d13be850b8b4045145e982e072e6f938f"),
    ],
});

#[cfg(not(any(
    all(target_os = "macos", any(target_arch = "aarch64", target_arch = "x86_64")),
    all(target_os = "windows", any(target_arch = "aarch64", target_arch = "x86_64"))
)))]
pub(crate) static RUNTIME: Option<Pack> = None;

pub(crate) fn file_name(entry: &'static str) -> &'static str {
    entry.rsplit('/').next().unwrap_or(entry)
}
