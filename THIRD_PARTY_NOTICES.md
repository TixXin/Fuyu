# Third-party notices / 第三方声明

FocuSD Island includes material derived from the following projects. Their licenses apply to that material.

本项目包含源自以下项目的内容，这些内容适用各自的许可证。

## fly-island (flyl1u)

- Used in: the whole app; this project started from fly-island 0.2.14.
- 用于：整个应用；本项目最初基于 fly-island 0.2.14。
- License: MIT. The original notice, kept as the license requires / 按许可要求保留的原声明：

```text
MIT License

Copyright (c) 2026 flyl1u and contributors
Copyright (c) 2026 TixXin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## wechatauto-replica

- Used in: `src-tauri/src/wechat_reminders/gate.rs` — the approach of switching on WeChat 4.x's Qt accessibility by setting one byte in `Weixin.dll`, and the instruction pattern used to find that byte (from `wake_uia.py`).
- 用于：`src-tauri/src/wechat_reminders/gate.rs`——通过改 `Weixin.dll` 里一个字节打开微信 4.x 的 Qt 辅助功能的做法，以及查找这个字节用的指令特征（来自 `wake_uia.py`）。
- License: Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0

The code in `gate.rs` was rewritten in Rust and changed (address cache, restoring the byte, one candidate tried); it is not a copy of the original file.

`gate.rs` 是用 Rust 重写并修改过的（地址缓存、写回原值、只试一个候选），不是原文件的拷贝。

## gifski (ImageOptim / Kornel Lesiński)

- Used in: screen recording to GIF (`src-tauri/src/recording/gif.rs`), linked as the Rust library `gifski` from crates.io, unmodified.
- 用于：录屏出 GIF（`src-tauri/src/recording/gif.rs`），以 crates.io 上的 Rust 库 `gifski` 原样链接。
- License: AGPL-3.0-or-later. Fuyu is GPL-3.0-or-later; GPLv3 section 13 allows the two to be combined, and the gifski part stays under the AGPL. Source: https://github.com/ImageOptim/gifski
- 许可证：AGPL-3.0-or-later。浮屿是 GPL-3.0-or-later，按 GPLv3 第 13 条可以合在一起发布，gifski 那部分仍按 AGPL。源码：https://github.com/ImageOptim/gifski
