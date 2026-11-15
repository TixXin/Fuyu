# 语音输入（说话转文字）

> 日期：2026-11-15。问题：按快捷键说话、识别结果显示在岛上、可编辑后存成待办 / 笔记或复制（参考 eIsland 的语音转文字），两个系统各用什么识别、怎么录音和拿麦克风权限、怎么保证默认不上传云端。范围：Apple Speech 文档和 WWDC、微软 Learn 的语音识别和 Windows AI 文档、whisper.cpp / SenseVoice / sherpa-onnx / Vosk 的仓库和模型发布页、OpenAI / Azure / 阿里云 / 腾讯云 / 讯飞的计价页、cpal 和 wry / Tauri 的权限相关 PR，GitHub 上的 eIsland、Handy、VoiceInk、Buzz；本仓库 `src-tauri/src/device_use/`、`src-tauri/src/win32/audio_capture`（录屏的麦克风采集）。相关任务：C80（#335）。

## 结论

**推荐：两个系统都用本机模型 SenseVoice-Small（int8，约 160 MB），经 sherpa-onnx 在 Rust 里跑；模型第一次用时下载；录音在 Rust 里做。在线服务不内置，以后要也只做成用户自己填密钥、明确打开的选项。**

理由：

1. **系统自带的识别都不合适**：
   - Windows 的 `Windows.Media.SpeechRecognition` 要 MSIX 包身份，浮屿是未打包的应用，用不了；而且自由听写本来就走微软的云端（要用户打开「联机语音识别」，一次最多 10 秒）。Win+H 语音输入也走云端。新的 `Microsoft.Windows.AI.Speech` 是本机的，但还是实验接口、要 MSIX 和 Windows 11 24H2，首发只有英语（中文未核实）。
   - Mac 的 `SFSpeechRecognizer` 默认走 Apple 的服务器，一次最多 1 分钟、每天有次数限制；能不能强制本机（`requiresOnDeviceRecognition`）要看语言和有没有下载听写模型，中文能不能本机识别没有官方清单（未核实）。macOS 26 的 `SpeechAnalyzer` 全在本机、首发支持普通话和粤语（第三方博客，未核实），但只有 macOS 26 以上，而且是纯 Swift 接口，要写一层 Swift 桥接。系统听写（Fn）没有给应用调的接口（未核实）。
2. **SenseVoice-Small 中文最好、最小最快**：普通话、粤语、英语、日语、韩语，非自回归，官方称比 Whisper-Small 快 5 倍以上，中文（AISHELL、WenetSpeech）优于 Whisper；int8 模型约 160 MB。Whisper 中文常简繁混杂（Handy 专门加了 OpenCC），small 量化后也要 190–264 MB、large-v3-turbo q5 要 574 MB。代码 MIT，权重是 FunASR 模型许可，维护者说明可商用。
3. **sherpa-onnx**（Apache-2.0）有 Rust 接口（crate `sherpa-onnx` 2.0.1），同一套代码还能跑 Paraformer（中文小模型 77 MB）、流式模型，以后要边说边出字可以换模型不换框架。
4. **默认不上传云端靠「代码里没有上传的路」来保证**，不是靠开关：见下文「怎么保证默认不上传」。

备选（要用户定）：Mac 上 macOS 26 以上优先用系统的 `SpeechAnalyzer`（不用下载我们的模型，系统管模型），其余情况用 SenseVoice。好处是 Mac 新系统上零下载；代价是多一套 Swift 桥接和两套识别结果的差异。建议先只做 SenseVoice，两个系统一样，以后再评估。

Handy（Tauri 2、MIT、3.9 万星，2026-11-14 还在发版）做的就是本机语音转文字，结构可以直接参考（只借思路，不搬代码和品牌素材）。

## 两个系统各自怎么做

| 环节 | Windows | Mac |
|---|---|---|
| 录音 | 复用录屏已有的 WASAPI 麦克风采集 `win32::audio_capture`（`AudioSource::Microphone`，出 f32 样本），重采样到 16 kHz 单声道 | 新写：`objc2-av-foundation` 的 `AVAudioEngine` 输入节点，或用 `cpal`（0.18，CoreAudio）；同样重采样到 16 kHz |
| 麦克风权限 | 未打包的程序归在「设置 → 隐私 → 麦克风 → 允许桌面应用访问麦克风」（未核实）；用户关掉时采集失败，提示并用已有的 `open_device_privacy_settings("microphone")` 打开那一页 | `Info.plist` 加 `NSMicrophoneUsageDescription`（中英文），加固运行时的 `Entitlements.plist` 加 `com.apple.security.device.audio-input`；第一次录音时系统弹框（`AVCaptureDevice requestAccessForMediaType:audio`），拒绝后提示去「系统设置 → 隐私与安全性 → 麦克风」。不需要语音识别权限（不用 Apple 的识别） |
| 识别 | sherpa-onnx + SenseVoice-Small int8，CPU 推理 | 同左（sherpa-onnx 在 Apple Silicon 上也是 CPU / 可选 CoreML，未实测） |
| 模型 | 第一次用语音输入时下载到数据目录（例如 `models/sense-voice-int8/`），显示进度、可取消、校验写死的 SHA-256；要有国内能用的镜像（ModelScope 上有 FunASR 的模型，未核实同一个文件） | 同左 |
| 内存 | 模型只在用的时候加载，停止录音后识别完、空闲一段时间（例如 2 分钟）就卸载，平时不占内存（参考 [memory-and-performance.md](memory-and-performance.md) 的约束） | 同左 |
| 快捷键 | 现有的 `global-hotkey`；按一下开始、再按一下结束（或按住说话，要用户定） | 同左 |
| 平台支持表 | `docs/architecture/platforms.md` 加一行「语音输入」 | 同左 |

不用 WebView 里的 `getUserMedia` 录音：WKWebView 的媒体权限在 Tauri 里还没打通（wry 的权限接口 PR 2026-06 合入、Tauri 的 `on_permission_request` 还没合，均未核实），macOS 14 起还有提示框被吞的问题；WebView2 虽然能弹框，但两边做法不一样。原生录音两边都更稳，而且 Windows 已经有现成的采集。

静音检测（自动结束）可以晚点做：Handy 用纯 Rust 的 `earshot`。第一版用快捷键开始和结束就够。

## 怎么保证默认不上传

1. 识别只在本机：录音、重采样、识别都在 Rust 进程里，音频不落盘（只在内存里，识别完丢掉），不经过 WebView。
2. 唯一的联网是**下载模型**：只连写死的模型地址（GitHub Release / Hugging Face / 国内镜像），只下载、不上传；下载前告诉用户大小。
3. 在线识别**不内置**。以后真要加，只做「用户自己填 API 密钥、自己打开」的引擎，打开时明确提示「音频会发给 <服务商>」，岛上录音时显示所用引擎，默认永远是本机。
4. 文档和设置页写明「语音只在本机识别」；`platforms.md`、隐私说明同步。

对比 eIsland：它前端 `getUserMedia` 采音，经 WebSocket 发到作者自己的服务器，再转给腾讯云实时语音识别，要登录账号，音频必然上云。我们不照这个做。

## 详细

### 系统识别

| 接口 | 本机 / 云端 | 中文 | 限制 | 能不能用 |
|---|---|---|---|---|
| Mac `SFSpeechRecognizer` | 默认云端；`supportsOnDeviceRecognition` 为真时可设 `requiresOnDeviceRecognition` 强制本机（要先下载听写模型） | 支持；本机识别是否支持中文未核实 | 云端每次 1 分钟、每天次数有限；要语音识别和麦克风两个授权 | 能用但默认上云，要运行时判断 |
| Mac `SpeechAnalyzer` / `SpeechTranscriber` | 本机，模型经 `AssetInventory` 由系统下载 | 普通话、粤语（第三方博客，未核实） | macOS 26 以上；纯 Swift；有报告列表里的语言实际用不了 | 备选 |
| Mac 系统听写（Fn） | 本机 / 云端视设置 | 支持 | 没有给应用调的接口（未核实） | 不能 |
| Windows `Windows.Media.SpeechRecognition` | 自由听写走云端；只有自定义语法在本机 | 要装中文语言包 | 要 MSIX 包身份；要打开「联机语音识别」；一次 10 秒 | 不能 |
| Windows Win+H | 云端 | 支持 | 没有给应用调的接口 | 不能 |
| Windows `Microsoft.Windows.AI.Speech` | 本机（Copilot+ PC 用 NPU，其余 CPU，模型由 Windows Update 下） | 首发只有英语（第三方报道），中文未核实 | 实验接口、不能用于生产；要 MSIX、Windows 11 24H2、Windows App SDK 2.2 实验版 | 以后再看 |

### 本机模型

| 模型 | 大小 | 中文 | 速度 / 内存 | 许可 |
|---|---|---|---|---|
| **SenseVoice-Small int8**（sherpa-onnx） | 165 MB（压缩包），Handy 里 152 MB | 好，官方称优于 Whisper | 比 Whisper-Small 快 5 倍以上；内存未实测 | 代码 MIT，权重 FunASR 许可（可商用） |
| SenseVoice fp32 | 886 MB | 同上 | — | 同上 |
| Paraformer-zh-small | 77 MB | 中文为主 | 快 | Apache-2.0（sherpa-onnx） |
| 流式 Paraformer 中英 | 1047 MB（fp32 + int8 合包） | 中英 | 边说边出字 | 同上 |
| Whisper tiny / base / small | 78 / 148 / 488 MB；small q5_1 190 MB、q8_0 264 MB | 小模型中文一般，常简繁混杂 | 内存约 273 / 388 / 852 MB；Apple Silicon 可用 Metal | MIT |
| Whisper large-v3-turbo | 1625 MB；q5_0 574 MB | 好 | 内存 2–4 GB 级 | MIT |
| Vosk small-cn | 42 MB | THCHS CER 17.15 | 很轻 | Apache-2.0 |
| Vosk cn-0.22 | 1.3 GB | THCHS CER 7.43 | — | Apache-2.0 |

Rust 包：`sherpa-onnx` 2.0.1（Apache-2.0）；`whisper-rs` 0.16.0（2026-03，GitHub 已归档、迁到 Codeberg，Unlicense）；Handy 用的 `transcribe-cpp`（ggml / GGUF，一套接口跑 Whisper、SenseVoice、Qwen3-ASR 等）。Handy 的模型目录里带中文的还有 Qwen3-ASR 0.6B / 1.7B、Fun-ASR Nano，比 SenseVoice 大，第一版不考虑。

Whisper 在 AISHELL 上的中文 CER 没查到可靠数字（未核实）。各模型在本机的实际内存、首字延迟要在实现时实测，写进 `docs/investigations/`。

### 在线服务

| 服务 | 价格（2026-11-15 查） | 要什么 |
|---|---|---|
| OpenAI whisper-1 / gpt-4o-transcribe | $0.006 / 分钟；gpt-4o-mini-transcribe $0.003 / 分钟 | 账号、API 密钥，国内不能直连 |
| Azure 语音 | 免费层每月 5 小时实时转写；付费单价未核实 | 账号、密钥 |
| 阿里云智能语音交互 | 实时识别 3.5 元 / 小时；百炼 Paraformer 0.288 元 / 小时；新用户 3 个月试用 | 账号、AccessKey |
| 腾讯云 | 后付费阶梯；「每月 5 小时免费」来源较旧，未核实；一句话识别单次 60 秒 | 账号、密钥 |
| 讯飞 | 免费额度只见于 2018 年的博客，未核实 | 账号、密钥 |

都要用户注册账号、填密钥，音频上传到对方服务器；数据保留政策没有逐家核实。结论：不内置，不做默认。

### 同类应用

| 应用 | 做法 |
|---|---|
| eIsland | 云端：`getUserMedia` → 16 kHz PCM → 作者服务器 → 腾讯云实时识别；要登录 |
| Handy（Tauri 2，MIT） | 本机：`transcribe-cpp`（Apple Silicon 用 Metal，Intel Mac 只用 CPU，Windows 用 Vulkan）；自研录音（cpal 分支 + objc2-av-foundation + windows，rubato 重采样到 16 kHz）；`earshot` 静音检测；OpenCC 简繁转换；模型从 Hugging Face 下载，可取消、断点续传、SHA-256 校验、有镜像；权限是麦克风和辅助功能（自动粘贴用） |
| VoiceInk（Mac，GPL-3.0） | whisper.cpp，Parakeet 走 FluidAudio |
| Buzz（MIT） | 离线 Whisper，跨平台 |

## 要用户定的

1. **识别引擎**：两个系统都用本机 SenseVoice（推荐）；还是 Mac 的 macOS 26 以上优先用系统的 `SpeechAnalyzer`？
2. **模型下载**：第一次用时下载约 160 MB（推荐，安装包不变大）；还是打进安装包？下载源用 GitHub Release 加国内镜像？
3. **按键方式**：按一下开始、再按一下结束（推荐，配合岛上的停止按钮）；还是按住说话、松开结束？
4. **在线服务**：第一版完全不做（推荐）；还是做一个用户自填密钥的可选引擎？
5. 识别结果除了存待办、笔记、复制，要不要「直接粘贴到当前输入框」（要辅助功能权限，Handy 的主用法）？建议第一版不做。

## 来源

- `SFSpeechRecognizer`：https://developer.apple.com/documentation/speech/sfspeechrecognizer ；`requiresOnDeviceRecognition`：https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition ；本机模型下载后才可用：https://developer.apple.com/forums/thread/731230 ；WWDC19：https://developer.apple.com/videos/play/wwdc2019/256
- `SpeechTranscriber`：https://developer.apple.com/documentation/speech/speechtranscriber ；`AssetInventory`：https://developer.apple.com/documentation/speech/assetinventory ；语言和速度（第三方）：https://blog.addpipe.com/apple-speechanalyzer-api ；语言列表的问题：https://developer.apple.com/forums/thread/797835
- `objc2-speech`：https://crates.io/crates/objc2-speech
- Windows 语音识别（MSIX、云端听写、10 秒）：https://learn.microsoft.com/en-us/windows/apps/develop/input/speech-recognition ；隐私策略错误码：https://docs.unity3d.com/560/Documentation/ScriptReference/Windows.Speech.DictationRecognizer.html ；Win+H 走联机识别：https://support.microsoft.com/en-us/windows/privacy/speech-voice-activation-inking-typing-and-privacy
- Windows AI 语音识别：https://learn.microsoft.com/en-us/windows/ai/apis/speech-recognition ；首发英语（第三方）：https://heise.de/-11318683
- whisper.cpp：https://github.com/ggml-org/whisper.cpp ；模型文件：https://huggingface.co/ggerganov/whisper.cpp ；whisper-rs：https://github.com/tazz4843/whisper-rs 、https://codeberg.org/tazz4843/whisper-rs
- SenseVoice：https://github.com/FunAudioLLM/SenseVoice ；sherpa-onnx 模型：https://github.com/k2-fsa/sherpa-onnx/releases/tag/asr-models 、https://k2-fsa.github.io/sherpa/onnx/pretrained_models/online-paraformer/index.html ；Vosk：https://alphacephei.com/vosk/models
- OpenAI 价格：https://developers.openai.com/api/docs/pricing ；Azure：https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/ ；阿里云：https://help.aliyun.com/zh/isi/product-overview/billing-10 ；腾讯云：https://cloud.tencent.com/developer/techpedia/1242 ；讯飞（旧）：https://blog.csdn.net/yuanlulu/article/details/81947880
- cpal：https://crates.io/crates/cpal ；wry 权限接口：https://github.com/tauri-apps/wry/pull/1654 ；Tauri `on_permission_request`：https://github.com/tauri-apps/tauri/pull/14865 ；macOS 提示框被吞：https://github.com/tauri-apps/wry/issues/1195 、https://developer.apple.com/forums/thread/734363 ；WebView2 权限：https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2permissionkind
- eIsland：https://github.com/JNTMTMTM/eIsland （`src/renderer/components/states/agentVoiceInput/hooks/useAgentVoiceInputRuntime.ts`，后端文档 `web/eisland-web-docs/src/api-backend/server-agent/`）
- Handy：https://github.com/cjpais/Handy （`src-tauri/src/managers/model.rs`、`src-tauri/src/catalog/catalog.json`）；VoiceInk：https://github.com/Beingpax/VoiceInk ；Buzz：https://github.com/chidiwilliams/buzz
