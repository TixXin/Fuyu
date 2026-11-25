# 剪贴板历史、常用短语与链接书签

剪贴板功能是内置插件 `clipboard`（可在 **设置 → 概览** 或 **设置 → 插件** 开关），支持记录文本、HTML、图片与文件复制历史，提供独立弹出窗口（快捷键唤起）与岛上页面两种使用方式。界面约定见 [docs/design/clipboard.md](../design/clipboard.md)，存储结构见 [data-storage.md](../architecture/data-storage.md) 与 [contracts.md](../architecture/contracts.md)。

## 主要能力

- **独立窗口与岛上页面**：默认快捷键唤起居中弹出窗口（支持模糊搜索、按类型筛选、键盘上下选、回车粘贴、空格打开预览窗 `clipboard-preview`）；也可在设置中切换为在岛上直接打开。
- **常用短语（Snippets）与收藏**：支持将常用文本固定为短语、为收藏条目绑定单键快贴（`pinKey`）、添加备注与标签；常用短语与可选的剪贴板文字收藏支持跨设备同步（详见 [sync.md](sync.md)）。
- **链接书签**：自动或手动收录常用网址，支持自定义排序、站点规则与浏览器书签导入/导出（存放在 `clipboard-links.json`）。
- **图片查看与标注**：支持缩放、OCR 识字、轻量标注编辑后重新复制或保存。
- **文本变换与插件动作**：弹窗内按 `Ctrl+K`（Mac `⌃K`）打开动作面板，内置格式转换、Markdown 转换与 AI 改写，也汇入第三方插件通过 `clipboard.actions` 接缝登记的自定义动作。

## 隐私与容量控制

- **隐私过滤**：忽略带系统隐私/排除剪贴板格式的复制内容、自动识别并打码常见密钥特征，支持配置忽略应用列表；隐私、打码、密钥或非文本条目绝不参与跨设备同步。
- **容量限制**：历史默认上限 500 条，单条文本上限可在设置中调整（256 KB / 1 MB / 4 MB / 不限），超长 HTML 自动跳过，支持随时暂停记录或清空历史。
- **数据位置**：全部历史、短语与缩略图保存在家目录的 `clipboard-history.json`、`clipboard-links.json`、`clipboard-images/` 与 `clipboard-text/` 中，仅存在本机。

## 扩展与实现

- **对外服务**：提供 `clipboard/v1`（`history`、`copyText`、`pasteText`）与扩展接缝 `clipboard.actions`（详见 [services-and-slots.md](../plugins/services-and-slots.md)）。
- **实现位置**：Rust 侧在 `src-tauri/src/clipboard_history/`，前端在 `src/features/clipboard/` 与 `src/windows/clipboard/`。
