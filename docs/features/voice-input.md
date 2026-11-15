# 语音输入

按快捷键说话，识别结果显示在岛的收起条上，改好后存成待办、追加到今天的每日笔记，或复制。任务 C80（#335），调研和取舍见 [voice-input.md](../research/voice-input.md)。

## 用法

1. 设置 → 语音输入：打开「启用语音输入」，在「语音模型」里点「下载」（识别组件和模型一共约 171 MB，只下载一次；不点就不下载，安装包里也没有它们，用户 2026-11-15 定）。
2. 按快捷键（默认 `Ctrl+Shift+Space`，Mac 上是 ⌃⇧Space）开始录音，收起条上显示「正在听」和计时，右边有「结束并识别」和「取消」两个按钮。
3. 再按一次快捷键，或点「结束并识别」，识别完收起条变成一个输入框，里面是识别出的文字，可以直接改。
4. 右边的按钮：存为待办（回车也是）、追加到今天的笔记、复制、关闭；Esc 关闭。

每次最长 2 分钟，到了自动结束并识别；不到 0.3 秒的录音不识别，显示「没听清」。没下载模型时按快捷键，岛上提示去设置下载，带「打开设置」按钮；没有麦克风权限时提示并带「打开隐私设置」按钮。

快捷键在设置 → 快捷键里也能改，和其他快捷键一起做冲突检查。功能关着时不注册快捷键。

## 隐私

- 识别全在本机：录音、识别都在岛屿的 Rust 进程里，音频只在内存里，识别完就丢掉，不写盘、不经过 WebView，代码里没有上传音频的路。
- 唯一的联网是用户在设置里点「下载」：识别组件和模型都只连写死的地址（GitHub Release，连不上时换 `ghfast.top`、`gh-proxy.com` 两个国内镜像），只下载，下载完核对写死的 SHA-256，对不上就丢掉。
- 不做在线识别，不自动粘贴到当前输入框（用户 2026-11-15 定）。

## 识别组件和模型

两样都放在家目录的 `models/voice-input/` 下，设置里能取消下载、整个删除，显示占用的空间。

| 项 | 识别组件 | 模型 |
|---|---|---|
| 内容 | sherpa-onnx 2.0.1 的 C API 动态库和 onnxruntime（Mac：`libsherpa-onnx-c-api.dylib`、`libonnxruntime.dylib`；Windows：`sherpa-onnx-c-api.dll`、`onnxruntime.dll`、`onnxruntime_providers_shared.dll`） | SenseVoice-Small int8（普通话、粤语、英语、日语、韩语，自动判断语言，带标点和数字规整）：`model.int8.onnx`、`tokens.txt` |
| 下载 | sherpa-onnx 发布页 v2.0.1 的 `*-shared-no-tts-lib.tar.bz2`（Mac arm64 / x64）和 `*-shared-MT-Release-no-tts-lib.tar.bz2`（Windows x64 / arm64，静态 CRT，不用装 VC++ 运行库），7–10 MB | `asr-models` 发布页的 `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2`，163,002,883 字节（不用 2025-09-09 的 int8：配 2.0.1 的识别组件时把普通话、英语都认成粤语，没有标点和数字规整，官方命令行也一样） |
| 校验 | 每个平台的 SHA-256 写死在 `voice_input/packs.rs`（取自 GitHub 发布页的 digest） | `7d1efa21…fd347e` |
| 解压后 | `models/voice-input/sherpa-onnx-2.0.1/`，Mac 约 32 MB，Windows 约 22 MB | `models/voice-input/sense-voice-int8/`，约 230 MB |
| 许可 | Apache-2.0（onnxruntime 是 MIT） | FunASR 模型许可（可商用，见 SenseVoice 仓库） |

下载先识别组件、后模型，进度条按两样的总字节数走；源依次是 GitHub、`ghfast.top`、`gh-proxy.com`（共用 `system/download_mirrors.rs`，带更新设置里的代理）。下载中的文件是 `<目录名>.tar.bz2.part`，解压中是 `<目录名>.partial/`，完成或失败都删掉。

识别组件第一次识别时才加载（`libloading`），加载前每次都核对每个库文件写死的 SHA-256（不只是下载时），对不上就不加载，提示删除后重新下载；之后留在进程里；模型识别完空闲 2 分钟就卸载。关掉语音输入或删除时两样都卸载。

## 实现

| 部分 | 位置 |
|---|---|
| 命令、快捷键回调 | `src-tauri/src/voice_input/mod.rs` |
| 录音状态机（开始、结束、取消、2 分钟上限、发 `voice-input-state`） | `voice_input/session.rs` |
| 录音 | Windows：`voice_input/capture.rs` 复用录屏的 WASAPI 麦克风采集 `win32/audio_capture.rs`（48 kHz 立体声，混成单声道）；Mac：`voice_input/capture_macos.rs` → `macos/microphone.rs`（`AVAudioEngine` 输入节点取第一个声道，`AVAudioApplication` 申请麦克风权限） |
| 识别 | `voice_input/engine.rs` 调 `src-tauri/crates/sherpa-runtime`：运行时加载 sherpa-onnx 的 C API，只包了离线识别用到的函数和配置结构体（布局按 2.0.1 的 `c-api.h`，有测试核对大小和偏移），CPU，最多 4 个线程，采样率由 sherpa-onnx 自己转成 16 kHz |
| 下载、校验、解压 | `voice_input/packs.rs`（每个平台的下载地址、大小、SHA-256、要留的文件）、`voice_input/download.rs`、`voice_input/model.rs` |
| 全局快捷键 | Windows：`voice_input/hotkey.rs`（隐藏消息窗口 + `RegisterHotKey`）；Mac：`voice_input/hotkey_macos.rs`（共用 `macos/hotkeys.rs` 的管理器） |
| 前端 | `src/features/voice-input/`：`api.ts`、设置（`settings.ts`、`storage.ts`、`VoiceInputSettingsSection.tsx`、`VoiceShortcutRow.tsx`、`VoiceInputShortcutGroup.tsx`）、岛上（`useVoiceInput.ts`、`VoiceInputNotice.tsx`）；岛的接线在 `src/windows/island/useIslandVoiceInput.tsx`，收起条上的提示按 `islandNotice.tsx` 的优先级排在录屏之后；设置页是 `src/windows/settings/VoiceInputSettingsPage.tsx` |

Mac 上 `Info.plist` 有 `NSMicrophoneUsageDescription`（中英文在 `src-tauri/macos/*.lproj/InfoPlist.strings`），`Entitlements.plist` 有 `com.apple.security.device.audio-input`，还有 `com.apple.security.cs.disable-library-validation`：发布版开了 hardened runtime，不关库校验就加载不了下载来的识别组件（原因、风险和约束见 [macos-port-plan.md](../architecture/macos-port-plan.md) 2026-11-15 那行）。第一次录音时系统弹框问麦克风权限。

## 依赖

- `crates/sherpa-runtime`（本仓库）：只依赖 `libloading` 0.8。构建时不下载、不链接 sherpa-onnx，安装包不变大。
- `bzip2` 0.6（纯 Rust 后端 `libbz2-rs-sys`）、`tar` 0.4：解压下载的包。
- Mac：`objc2-avf-audio` 0.3（AVAudioEngine、AVAudioApplication）。

## 已知限制

- 不是边说边出字：结束录音后整段识别（实测见任务文件）。
- 开发版和正式版同时开时，语音输入的快捷键谁先注册归谁，不跟随「开发版优先」切换（没有接 `coexist` 的刷新通知）。
- Windows 上的录音、麦克风隐私开关、含中文的用户目录路径还没在真机上验过，清单见任务文件。
