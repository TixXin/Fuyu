# 快捷翻译

内置插件 `translation`（默认开启；设置 → 概览里开关，关掉时独立翻译窗口、岛内翻译页、全局快捷键与 `translator/v1` 服务一并撤除）。支持独立窗口与岛内页面两种打开位置、选中文字快捷翻译、剪贴板 AI 改写，以及通过插件注册外部翻译引擎。

## 打开方式与快捷键

- **打开位置**（设置 → 翻译 → 翻译打开在）：
  - **独立窗口**（默认）：点岛顶栏翻译按钮、托盘菜单「翻译」或按快捷键时弹出 `translation` 窗口；收起时隐藏，空闲 10 分钟后自动销毁。
  - **岛内页面**：展开主岛并切到「翻译」页（`Alt+数字` 也可切换），不弹独立窗口。
- **全局快捷键**（设置 → 翻译 → 快捷键，或 设置 → 快捷键 → 快捷翻译）：
  - **打开快捷翻译**：默认 `Ctrl+Shift+F`（macOS 显示 `⌃⇧F`）。
  - **翻译选中文字**：默认 `Ctrl+Alt+T`（macOS 显示 `⌃⌥T`）。在其他窗口选中文字后按下，临时复制选中内容、还原剪贴板（不记入剪贴板历史），在岛收起条上显示单行译文 8 秒，点击可带入翻译窗口或岛内翻译页；未选中文字时翻译当前剪贴板文本。
  - **单条置空关闭**（C110，#815）：每条快捷键录制按钮旁提供清除按钮（`×`），清空后保存为空字符串 `""` 并立即释放该系统全局热键，重启或切换开关后保持关闭，不回退默认值；点击「恢复默认」可重新绑回默认组合键。两条快捷键可各自独立关闭，仍可通过岛顶栏按钮或托盘打开翻译。

## 翻译服务与凭据

- **内置服务**（OpenAI 兼容 Chat Completions）：硅基流动（默认）、DeepSeek（默认模型 `deepseek-flash`）、火山方舟、通义千问、Kimi、OpenAI、自定义（`custom`）。
- **密钥存储**：API 密钥保存在系统凭据库（Windows 凭据管理器 / macOS 钥匙串，服务名 `com.tixxin.fuyu.translation`，按提供商 ID 分条目），不进 `localStorage`、设置文件或备份，也不会返回给前端或插件。
- **自定义接口（`custom`）**：
  - 接口地址存在 `fuyu-translation-settings.customBaseUrl`，并由窗口同步写入凭据条目 `custom-address`，供宿主侧 `translator/v1` 调用（不接受调用方临时传入地址，防止将密钥发往未授权端点）。
  - 远端地址必须使用 `https://`，且不得包含用户名密码或查询参数，调用前要求已保存 API 密钥。
  - **本机回环免密钥**（C110，#815）：当自定义接口地址的主机为本机回环（`localhost`、`127.0.0.1`、`[::1]`，支持 `http://` 或 `https://`，如本机 Ollama `http://localhost:11434/v1` 或 MTranServer）时，无需保存 API 密钥即可直接用于快捷翻译、划词翻译、自动翻译与改写，未保存密钥时请求不附带 `Authorization` 头；若本机服务开启了鉴权并保存了密钥，仍照常附带 `Bearer` 头。
- **插件扩展引擎**（E36.4.2）：插件可通过 `ctx.translatorEngines.register(spec)` 注册自定义翻译/改写引擎（如离线词典或免配翻译插件），自动出现在翻译服务下拉列表中。

## 数据与实现

| 部分 | 位置 |
|---|---|
| 原生命令、凭据、`translator.*` 宿主方法 | `src-tauri/src/translation/mod.rs`、`address.rs`、`provider.rs`、`request.rs`、`rewrite.rs`、`stream.rs` |
| 全局快捷键与后台窗口生命周期 | `src-tauri/src/translation/background.rs`、`hotkey.rs`（Windows）、`hotkey_macos.rs`（macOS） |
| 宿主插件与引擎注册表 | `src/features/translation/host/index.mjs`、`host/engines.mjs` |
| 前端设置、面板、独立窗口与接线 | `src/features/translation/`、`src/windows/translation/TranslationWindow.tsx` |
| 单元测试 | `src-tauri/src/translation/tests.rs`、`tests/unit/translation.test.mjs`、`tests/unit/translation-host.test.mjs` |
