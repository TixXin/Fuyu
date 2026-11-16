# 剪贴板预览增强：计划

组长：[任务] 剪贴板预览（由「Fuyu-[总控] 功能」开出）。方案挑选页：[clipboard-preview-preview.html](../investigations/clipboard-preview-preview.html)。

**状态**：C101.1–C101.4 和小修 C101.6 都已合入 main（PR #648、#649、#651、#658、#660，2026-11-16）。只剩 C101.5（#654）：33 条真机实测，等用户在 Windows 和 Mac 上测。测完后关闭 C101 和 #635。

## 起因

用户原话：「剪贴板 UI 交互优化：按住空格打开预览后，鼠标移到预览窗口，松开空格应该预览继续显示；预览窗口功能需要丰富，图片操作放大缩小，预览窗口放大显示（中等，全屏等），预览支持修改等操作」。

## 现状（读代码得到的）

- 打开：`ClipboardPopup.tsx` 在标准宽度、搜索框为空时按空格进 `look` 模式；`useSpacePeek.ts` 按住超过 350ms（`popupKeys.ts` 的 `PEEK_HOLD_MS`）再松开就退出。`ClipboardWindow.tsx` 的 `onPeek` 用事件 `clipboard-preview-item` 把条目发给预览窗口，再调 `show_clipboard_preview`。
- 窗口：`src-tauri/src/clipboard_history/preview_window.rs`。宽 420、与剪贴板窗口同高，`place_beside` 右边放不下放左边，限制在剪贴板窗口所在显示器的工作区；关闭先发 `clipboard-preview-closing` 再 150ms 后隐藏。`tauri.conf.json` 里 `focus: false`、`focusable: false`。
- 焦点：预览从不拿焦点。Windows 用 `SW_SHOWNOACTIVATE`（窗口带 `WS_EX_NOACTIVATE`）；Mac 是不能成为 key 的 `PreviewPanel`（`macos/island_panel.rs`，G1.18）。键盘一直在剪贴板窗口，剪贴板窗口失焦就关（`hide_clipboard_popup(blurred)`，固定时例外）。
- 内容：`ClipboardPreviewWindow.tsx` → `ClipboardPopupPreview.tsx`（和宽版右栏共用）；图片是 `ClipboardPreviewImage.tsx`，先缩略图再原图。
- 编辑：已有 `ClipboardEditor.tsx`（Ctrl+E，在剪贴板窗口里），Ctrl+Enter 只粘贴这次，Ctrl+S 另存新记录（`add_clipboard_history_text`）。没有改原记录的命令。
- 回归页：`tests/regression/clipboard-preview.tsx`，另有 `clipboard-popup*` 几页。

## 已定方案（用户 2026-11-15）

用户的选择：① A+B+C ② A ③ A+C ④ A ⑤ A，类型 1。

1. 留住（A+B+C 都要）：按住空格期间鼠标进过预览（包括松开时在预览上）就留住，转成常开，空格、Esc、× 都能关。预览顶栏另有图钉：钉住后空格不再关它，只有 Esc、× 或再点图钉才关。鼠标没进过预览时松开，照旧关。
2. 焦点（A）：平时不拿；进入编辑时预览拿焦点，这段时间剪贴板窗口失焦不关，编辑结束还回去。
3. 尺寸（A+C）：预览顶栏放标准 / 中等 / 全屏三个按钮，剪贴板窗口里按 F 循环；跟剪贴板窗口所在的屏；全屏时剪贴板窗口在预览上层。另外可以拖边自由改大小，双击顶栏在「全屏 / 上次大小」间切换；档位和自定义大小都记住（存进剪贴板设置，加可选字段，旧数据兼容读）。无激活窗口拖边会被系统激活，所以拖边改大小要自己画拖拽区、经 Rust 改尺寸。
4. 缩放（A）：滚轮以指针为中心缩放、拖动平移、双击「适应 / 100%」、缩放条、`+` `-` `0`。
5. 编辑（A，类型 1）：Ctrl+S 改这条（带 6 秒撤销），Ctrl+Shift+S 另存；剪贴板窗口的 Ctrl+E 编辑器同步改键位（改掉了已确认的「Ctrl+S 另存」，用户同意）。先做文字，图片（裁剪、旋转、标注）第二批（P4，要做）。

## 任务和顺序

按文件切分，同一时间不让两个会话改同一个文件。编号建任务时由 `pnpm tasks add` 定，下面用 P1–P4 代称。

| 批 | 任务 | 内容 | 依赖 | 编译 |
|---|---|---|---|---|
| 1 | P1 预览窗口：留住、图钉、尺寸档位和拖边、工具栏 | ①③，以及给后面用的「预览命令」通道 | — | Rust |
| 2 | P2 图片查看器：缩放和平移 | ④ | P1 | 只前端 |
| 2 | P3 文字编辑：改这条 / 另存、焦点交接 | ②⑤ | P1 | Rust |
| 3 | P4 图片编辑：裁剪、旋转、标注 | ⑤ 第二批 | P2、P3 | Rust |

P2、P3 并行，同时最多 2 个要编译的会话。

### P1 预览窗口：留住、图钉、尺寸档位和拖边、工具栏

- `--scope`：`src-tauri/src/clipboard_history/preview_window.rs`、新建 `src-tauri/src/clipboard_history/preview_size.rs`（档位、拖边、摆放，纯函数可单测）、`src-tauri/src/clipboard_history/mod.rs`（只注册命令、设置里加尺寸字段）、`src-tauri/src/macos/island_panel.rs`（只动预览面板的 level）、`src/features/clipboard/useSpacePeek.ts`、`src/features/clipboard/popupKeys.ts`、`src/features/clipboard/ClipboardPopup.tsx`、`src/windows/clipboard/ClipboardWindow.tsx`、`src/windows/clipboard/ClipboardPreviewWindow.tsx`、`src/windows/clipboard/ClipboardPreviewWindow.css`、`src/features/clipboard/api.ts`、新建 `src/i18n/sections/clipboardPreview.ts`（及注册它的 locale / types 文件）、`tests/regression/clipboard-preview.*`、`tests/regression/snapshots/clipboard-preview.html`、`docs/design/clipboard.md`「空格预览」一条
- 做什么：预览窗口把鼠标进出发给剪贴板窗口，按住期间进过预览就留住；顶栏放图钉、尺寸三按钮和 ×；Rust 加尺寸档位（`set_clipboard_preview_size` 一类命令，多显示器跟剪贴板窗口那块屏）；拖边改大小（自己画拖拽区，不让系统激活窗口）、双击顶栏切全屏 / 上次大小；档位和自定义大小存进剪贴板设置；剪贴板窗口始终压在预览上；F 循环档位；加一个「预览命令」事件（剪贴板窗口 → 预览：缩放、编辑等），P2、P3 只往里加处理。
- 做完：新命令有前端封装和权限；摆放函数的单测覆盖三档、自定义大小、左右翻转和超出工作区；回归页覆盖留住、图钉和三档按钮；`docs/design/clipboard.md`、`platforms.md` 剪贴板一行、`contracts.md`（新命令、事件、设置字段）、`data-storage.md` 更新；新加的窗口配置和 `clipboard_history` 入口的改动写进任务文件的备注，给 E36.3.34 迁移用。
- 验证：`pnpm check`、`pnpm build`、`pnpm heavy -- cargo test --manifest-path src-tauri/Cargo.toml`、`pnpm build:exe`、`pnpm test:regression clipboard`。

### P2 图片查看器：缩放和平移

- `--scope`：`src/features/clipboard/ClipboardPreviewImage.tsx`、新建 `src/features/clipboard/ClipboardImageViewer.tsx` / `.css`、`src/features/clipboard/ClipboardPopupPreview.tsx`（只动图片分支）、`src/i18n/sections/clipboardPreview.ts` 的 `zoom` 段、新建回归页 `tests/regression/clipboard-image-viewer.*` 及快照
- 做什么：④ 的全部；接 P1 的预览命令（`+` `-` `0`）；换条回到「适应」；宽版右栏共用同一组件时只给它「适应」和双击，不出缩放条（避免挤）。
- 做完：缩放计算是纯函数并有单元测试（`tests/unit/`）；回归页覆盖缩放条和双击。
- 验证：`pnpm check`、`pnpm build`、`pnpm test:regression clipboard`。

### P3 文字编辑：改这条 / 另存、焦点交接

- `--scope`：新建 `src-tauri/src/clipboard_history/edit.rs`（改记录文字命令）、`src-tauri/src/clipboard_history/mod.rs`（注册命令、失焦例外）、`src-tauri/src/clipboard_history/store.rs`（只加改文字的方法）、`src-tauri/src/clipboard_history/preview_window.rs`（P1 合入后：临时可激活）、`src-tauri/src/win32/window.rs`（只在需要时）、`src-tauri/src/macos/island_panel.rs`（可切换的 panel）、`src/windows/clipboard/ClipboardPreviewWindow.tsx`、新建 `src/features/clipboard/ClipboardPreviewEditor.tsx`、`src/features/clipboard/ClipboardEditor.tsx`（键位统一）、`src/features/clipboard/api.ts`、`src/i18n/sections/clipboardActions.ts`（编辑相关文案）、`tests/regression/clipboard-popup*`、`tests/regression/clipboard-preview.*` 及快照
- 和 P2 不共用文件：P2 不碰 `ClipboardPreviewWindow.tsx`、`api.ts`、i18n 的 `clipboardActions.ts`；P3 不碰 `ClipboardPopupPreview.tsx`、`clipboardPreview.ts`。
- 做什么：⑤ 和 ②。改这条保留来源、时间、收藏、标签、固定键，重算预览文字、类型识别、打码判断，带 HTML 的改完只留纯文字，记一个「已编辑」标记（存储格式加可选字段，旧数据兼容读）；撤销 6 秒。编辑时预览拿焦点，剪贴板窗口那段时间失焦不关，结束还焦点；Mac 不能退回 G1.18 以前（预览出现就抢焦点）。
- 做完：Rust 单测覆盖改文字后的字段重算和撤销；回归页覆盖编辑态；`contracts.md`（新命令、新字段）、`data-storage.md`（如存储格式变）、`docs/design/clipboard.md`「编辑后粘贴」一条更新。
- 验证：同 P1。

### P4 图片编辑（第二批）

先派一个 `[调研]` 子代理评估截图的标注代码（`src/features/screenshot/annotations.ts`、`drawAnnotations.ts`）能否直接复用，再定 scope。改这条 = 替换图片文件、重做缩略图和文字识别，撤销要留旧文件。

## 和别的工作的冲突

- **E36.3.34 剪贴板迁成内置插件**（#582，等 E36.3.30，E36.3.30 已完成）会把 `clipboard`、`clipboard-preview` 窗口改成开着才建，改 `tauri.conf.json` 和剪贴板的 Rust 入口。和 P1、P3 改的是同一片文件。**已定（2026-11-15，功能总控和插件系统总控）**：本计划先做，E36.3.34 等 P1–P3 合入后再开工。P1–P3 有了任务编号后，用 SendMessage 告诉「[任务] 第 3 阶段内置功能插件化」（`local_a069677c-95af-46d5-b4ae-022ea427d777`），由它把这几个编号补进 E36.3.34 的 `depends`；本组不改 E36.3.34 的任务文件。P1 如果新加了窗口配置或改了 `clipboard_history` 的入口，要把改了什么写进 P1 的任务文件，E36.3.34 迁移时照着做。P4 不用等它，开工前和插件系统总控打个招呼。C101.1–C101.3 已合入（PR #648、#649、#651）。E36.3.34 改的文件和 C101.4 重叠（`mod.rs`、`edit.rs`、`service.rs`），第 3 阶段组长要等 C101.4 提交后再派它：C101.4 提交后，组长直接把提交号发给「[任务] 第 3 阶段内置功能插件化」（`local_a069677c-95af-46d5-b4ae-022ea427d777`）。
- `docs/design/clipboard.md` 归「Fuyu-[总控] UI 外观」，任务会话只改「空格预览」「编辑后粘贴」两条，改前告诉它。

## 只能在真机上实测的（实测清单）

Windows（另一台机器）：

1. 预览出现、点击、滚轮、拖动时剪贴板窗口不失焦、不关。
2. 按住空格时鼠标进过预览，松开后预览留住；没进过照旧关；图钉钉住后空格不关。
3. 中等、全屏两档的位置和大小：单屏、副屏、不同缩放比例（100% / 150%）、任务栏在侧边；拖边改大小时剪贴板窗口不失焦，重开后记得大小。
4. 全屏时剪贴板窗口在预览上层，↑↓ 换条预览跟着换。
5. 进入编辑时预览拿到键盘焦点（中文输入法能打字），保存或 Esc 后焦点回到剪贴板窗口；编辑过程中剪贴板窗口不关。
6. 编辑后自动粘贴仍贴到弹出前的那个程序。
7. Win+V 打开的剪贴板窗口同样适用以上几条。

Mac（本机，组长收口时可以做）：

1. 非 key 面板里鼠标进出、滚轮、触控板捏合缩放是否收得到。
2. 编辑时预览成为 key、剪贴板窗口不关；结束后剪贴板窗口重新成为 key。
3. 全屏应用所在的桌面里，中等、全屏两档的位置。
4. 外接屏上全屏档跟着剪贴板窗口那块屏。
