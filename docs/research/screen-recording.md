# 录屏：优秀的开源项目怎么做到不卡、流畅

> 日期：2026-11-13。问题：做录屏（C41.11）之前，先看优秀的开源录屏软件怎么实现，重点是录的时候不卡、录出来流畅；用户同日定了要能出 GIF、要录系统声音和麦克风。范围：GitHub 上的 Cap（读了 `crates/` 下采集、编码、帧节奏、混音、时间戳的源码）、windows-capture（读了 `encoder.rs`）、微软的 SimpleRecorder 和 Microsoft Learn「Screen capture to video」、ShareX 更新日志和源码目录、ScreenToGif 的发布说明、OBS 的 NVENC 说明、FFmpeg 的 ddagrab 文档、WASAPI loopback 的微软博客和 GStreamer 的修复；crates.io 上的候选库和授权。star 数、版本号都是当天查的。相关任务：[C41.11](/docs/tasks/C/C41.11.md)。

## 结论

1. **不卡的关键是画面全程留在 GPU 里**。截到的帧是 D3D11 纹理，在 GPU 上裁剪、缩放、转成 NV12，再直接交给显卡的硬件编码器，中间不拷回内存。OBS 23 起自己的 NVENC 就是这样省掉了「GPU → 内存 → GPU」两次搬运 [1]；Cap 的 Windows 管线、微软官方示例、FFmpeg 的 ddagrab 都是这个路子 [2][3][4][5]。我们现在截图用的 GDI `BitBlt`（`src-tauri/src/win32/screen_capture.rs`）每帧都走 CPU，**录屏不能沿用**。
2. **采集用 Windows Graphics Capture（WGC），编码用 Media Foundation 的硬件 H.264，不带 FFmpeg**。WGC 是 Win10 1903 起的系统接口，Cap、windows-capture、微软示例都用它 [2][3][5]；ShareX 22.0（2026-10-20）也加了不依赖 FFmpeg 的原生录屏 [6]。带 FFmpeg 会让安装包大几十 MB，Cap 用它只是为了封装 MP4 和软件编码兜底 [7]，我们可以用 Media Foundation 自己的 Sink Writer 完成封装和 AAC 音频。
3. **采集和编码分开线程，中间是有界队列**。编码跟不上时丢新来的帧并计数，而不是让队列无限变长吃内存、越录越卡：Cap 队列 240 帧，5 秒内丢帧超过 5% 就告警 [7]；windows-capture 用的是无界队列，没有背压 [3]，这一点不要学。
4. **帧节奏决定"看着流不流畅"**。WGC 只在画面变化时才给帧，静止时一帧都没有。正确做法是保留每帧真实的采集时间戳，只在静止超过 **3 个帧间隔**后才补重复帧；Cap 原来静止 1 个间隔就补，结果和稍晚到的真帧抢同一个时间位，出现"重复一帧 + 一帧只显示 11 微秒"的抖动，后来改成 3 个间隔才修好 [8]。`MinUpdateInterval` 只能限制上限帧率，不保证恒定帧率 [3]。
5. **音画同步靠统一的时钟**。WGC 帧的 `SystemRelativeTime` 和 WASAPI 的设备时间都是 QPC，全部减去同一个起点换算成偏移，不在不同时钟之间换算 [9]。
6. **系统声音有个大坑：没有声音在播时 WASAPI loopback 一个包都不给**，录出来的音轨会断、和画面错位。解决办法是在同一个输出设备上开一路一直播放静音的渲染流，或者自己按时间补零 [10][11]。系统声音和麦克风混成 48 kHz 立体声，Cap 的规则是：偏差 2 ms 以内当抖动不管，2–10 ms 慢慢修正（听不出来），超过 10 ms 直接对齐、空缺补静音 [12]。
7. **GIF 单独一路编码，画质靠好的调色板**。Cap 用 gifski，放在单独的写文件线程里 [13]；ScreenToGif 提供 gifski、KGy SOFT、FFmpeg 几种编码器 [14]；ShareX 22.1 加了不依赖 FFmpeg 的原生 GIF [6]。**授权要注意**：浮屿是 GPL-3.0-or-later，gifski 是 AGPL-3.0-or-later，按 GPLv3 第 13 条可以合在一起发布，但 gifski 那部分仍按 AGPL；它底下的 imagequant 是 GPL-3.0，和我们完全一致 [15]。
8. **别把浮屿自己录进去**。岛上要显示录制时长和停止按钮，这些窗口用 `WDA_EXCLUDEFROMCAPTURE` 排除，仓库里已经有现成的封装（`src-tauri/src/win32/window.rs`）。WGC 默认会在被录的屏幕上画黄框，Win11 上可以用 `IsBorderRequired = false` 关掉，旧系统不支持时要能降级 [5]。

### 建议的做法

- **采集**：WGC，`CreateFreeThreaded` 的帧池（2–4 个缓冲，帧率越高越多，照 Cap [5]），整屏录显示器，选区录在 GPU 上裁剪（`CopySubresourceRegion`）。可以直接用 windows-capture（MIT，2.0.1，2026-08-08 更新 [3][15]），也可以照它和 Cap 的 `scap-direct3d` 自己写进 `src-tauri/src/win32/`。
- **视频编码**：`ID3D11VideoProcessor` 把 BGRA 转成 NV12，用 `MFCreateDXGISurfaceBuffer` 把纹理包成样本，交给通过 `IMFDXGIDeviceManager` 拿到 D3D 设备的硬件 H.264 编码器（Cap 的 `enc-mediafoundation` 就是这样 [2]）。
  - 宽高取偶数，任一边超过 4096 就等比缩小（硬件 H.264 的常见上限，Cap 和 ShareX 22.4 都处理了这个 [6][16]）。
  - 硬件编码器创建失败或录制中卡住（Cap：输入 30 帧没有输出、5 秒没有输出）就换软件编码器，并且记住，下次直接用软件的 [2][7]。
  - 码率按「宽 × 高 × 帧率系数」算（Cap 的公式 [2]），显式设码率控制模式，不全靠驱动默认值。
- **帧节奏**：真实时间戳 + 静止 3 个间隔后补重复帧 + 暂停时扣掉暂停时长，照 Cap 的 `frame_pacing.rs` [8]。默认 30 fps，可选 60。
- **音频**：WASAPI loopback 录系统声音（同时开一路静音渲染流），WASAPI 录麦克风，各自带 QPC 时间戳，混成 48 kHz 立体声后编 AAC，和视频一起写进 MP4。Rust 有 `wasapi` 库（MIT，0.27.0，2026-11-06 更新）可用，也可以直接用 `windows` crate 写 [15]。
- **GIF**：录完从 MP4 转，或者录的时候另开一路低帧率（10–15 fps）、限宽度的帧交给 GIF 编码线程。编码库在 gifski 和 imagequant + `gif` 之间选，见上面的授权说明。
- **崩溃也能留下文件**（可选）：Cap 用分片 MP4，录到一半崩溃也能播 [7]。Media Foundation 有分片 MP4 容器，是否适合我们未核实，开工时再看。

## 详细

### 各项目怎么做

| 项目 | 采集 | 编码 / 封装 | 音频 | 授权 |
|---|---|---|---|---|
| **Cap**（2.5 万 star）[2][5][7][17] | WGC，帧是 GPU 纹理，只在需要时拷到内存 | Media Foundation 硬件 H.264（输入 NV12 纹理）；AMD 显卡或 MF 出过问题时换 FFmpeg 软件编码；FFmpeg 封装 MP4 | cpal 采集，FFmpeg filter 混音成 48 kHz 立体声，AAC | `scap-*`、`cap-camera*` 是 MIT，其余 AGPL-3.0 |
| **windows-capture**（527 star）[3] | WGC，2.0 起也支持 DXGI Desktop Duplication | `MediaStreamSource` + `MediaTranscoder`，开硬件加速，GPU 表面直接给编码器；默认 HEVC 15 Mbps 60 fps | 调用方自己推 PCM，时间戳按样本数算 | MIT |
| **SimpleRecorder / Microsoft Learn** [4][18] | WGC，每帧拷到一张新纹理，免得编码时被覆盖 | `MediaStreamSource` + `MediaTranscoder`，硬件加速 | 示例里没有 | MIT |
| **ShareX 22** [6] | 更新日志没写用什么接口 | 22.0 原生录屏不依赖 FFmpeg，帧率上限提到 120；22.4 区域太大时改用 HEVC；FFmpeg 路线推荐 ddagrab + NVENC | 22.0 起录系统声音和麦克风 | GPL-3.0 |
| **ScreenToGif**（2.79 万 star）[14] | 2.20 起有 Desktop Duplication 模式，带内存缓存 | GIF 编码器：内置、gifski、KGy SOFT、FFmpeg | — | MS-PL |
| **FFmpeg ddagrab** [19] | Desktop Duplication，帧留在 GPU | 接 `h264_nvenc` 等硬件编码器；接软件编码器要先 `hwdownload` | — | LGPL / GPL |

### Cap 里值得照抄的细节

- **帧池大小**：`ceil(fps / 30 × 2)`，限制在 2–4 之间 [5]。
- **尺寸变化**：被录窗口改变大小时重建帧池，跳过那一帧；先检查 D3D 设备有没有被移除，因为 WGC 拿到失效设备会直接崩 [5]。
- **编码器健康检查**：连续 30 个输入没有输出、连续 5 次输入失败、5 秒没有输出、连续 20 个空输出，任一条都判定硬件编码器坏了；但暂停时等不到帧不算 [2]。
- **混音**：音源超过 960 ms 没数据就告警，超过 1920 ms 重置这一路；开头 1 秒内有音源还没出数据就先不输出，免得开头错位；停止时最多等 1 秒把缓冲区排空 [12]。
- **时间戳**：同一时刻记下每种时钟的值作为起点，每个时间戳只和自己那种时钟的起点相减，避免不同时钟之间的漂移 [9]。

### WASAPI loopback 的注意点

- 没有声音在播时不出包，不是出静音包 [10][11]。
- 带 `AUDCLNT_BUFFERFLAGS_SILENT` 标志的包要按帧数写零，忽略里面的数据 [11]。
- 每次都要把缓冲区读空（循环到 `GetNextPacketSize` 返回 0）[10]。
- 独占模式播放的应用录不到 [11]。

## 来源

1. OBS Forum，NVENC Guide：https://obsproject.com/forum/resources/nvidia-nvenc-guide.740/
2. Cap，`crates/enc-mediafoundation/src/video/h264.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/enc-mediafoundation/src/video/h264.rs
3. windows-capture：https://github.com/NiiightmareXD/windows-capture （`src/encoder.rs`）
4. robmikh/SimpleRecorder：https://github.com/robmikh/SimpleRecorder
5. Cap，`crates/scap-direct3d/src/lib.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/scap-direct3d/src/lib.rs
6. ShareX 更新日志（22.0.0 2026-10-20、22.1.0 2026-11-02、22.4.0 2026-11-08）：https://getsharex.com/changelog
7. Cap，`crates/recording/src/output_pipeline/win.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/recording/src/output_pipeline/win.rs
8. Cap，`crates/recording/src/output_pipeline/frame_pacing.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/recording/src/output_pipeline/frame_pacing.rs
9. Cap，`crates/timestamp/src/lib.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/timestamp/src/lib.rs
10. Matthew van Eerde，Draining the WASAPI capture buffer fully：https://learn.microsoft.com/en-us/archive/blogs/matthew_van_eerde/draining-the-wasapi-capture-buffer-fully
11. Matthew van Eerde，Sample - WASAPI loopback capture；GStreamer `wasapisrc` 的修复：https://learn.microsoft.com/en-us/archive/blogs/matthew_van_eerde/sample-wasapi-loopback-capture-record-what-you-hear 、https://git.fasttube.de/FaSTTUBe/GST-Tensordecoder-ov_ep/commit/a668de747fd3bffb78550c37f82a33a30d489b27
12. Cap，`crates/recording/src/sources/audio_mixer.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/recording/src/sources/audio_mixer.rs
13. Cap，`crates/enc-gif/src/lib.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/enc-gif/src/lib.rs
14. ScreenToGif：https://github.com/NickeManarin/ScreenToGif ；发布说明 2.20、2.37、2.39：https://github.com/NickeManarin/ScreenToGif/releases
15. crates.io（2026-11-13 查）：gifski 1.34.0 AGPL-3.0-or-later；imagequant 4.4.1 GPL-3.0-or-later；gif 0.14.2 MIT/Apache-2.0；windows-capture 2.0.1 MIT；wasapi 0.27.0 MIT；cpal 0.18.2 Apache-2.0
16. Cap，`crates/recording/src/resolution_limits.rs`：https://github.com/CapSoftware/Cap/blob/main/crates/recording/src/resolution_limits.rs
17. Cap：https://github.com/CapSoftware/Cap
18. Microsoft Learn，Screen capture to video：https://learn.microsoft.com/en-us/windows/uwp/audio-video-camera/screen-capture-video
19. FFmpeg Wiki，Capture/Desktop：https://trac.ffmpeg.org/wiki/Capture/Desktop
