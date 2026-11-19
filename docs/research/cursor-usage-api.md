# 读 Cursor 额度的开源做法

> 日期：2026-11-19。问题：B78（#896）本机用 Cursor 的登录调额度接口回 401，开源项目是怎么读 Cursor 额度的：用哪个接口、怎么带认证、Token 从哪个键取、要不要 checksum。范围：GitHub 搜 `cursor usage`，逐个读 steipete/CodexBar（macOS 菜单栏，Swift）、nooblk-98/burnbar（Windows / macOS / Linux 托盘，Rust）的 Cursor 部分，对照上游 fly-island 1e278b32（grok-bot）。相关任务：B78。

## 结论

- **401 的原因是 Token 被加密了**，接口没问题。新版 Cursor 在 macOS 上把 `state.vscdb` 的 `ItemTable` 里 `cursorAuth/accessToken` 存成 `cursor-safe-storage:v1:<base64>`，base64 解开是 `v10` 开头的 Chromium / Electron「Safe Storage」密文，不是 JWT。我们第一版把整串当成 Bearer 发出去，所以回 401。CodexBar 和 burnbar 都先解密再用。
- **macOS 的解密**（两家一致）：钥匙串里通用密码 service `Cursor Safe Storage`，account 先试 `Cursor Key`、再试 `Cursor`；用这个密码做 PBKDF2-HMAC-SHA1（盐 `saltysalt`，1003 轮，16 字节）得到 AES-128 密钥，去掉 `v10` 后 AES-128-CBC 解密，IV 是 16 个空格，PKCS#7 填充，得到 JWT。第一次读钥匙串时系统会问是否允许。
- **接口有两条，都能用**：
  - burnbar：`POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage`，`Authorization: Bearer <JWT>`、`Connect-Protocol-Version: 1`、`Content-Type: application/json`，正文 `{}`，**不带 checksum**。我们第一版用的就是这个接口。
  - CodexBar：`GET https://cursor.com/api/usage-summary`，Cookie `WorkosCursorSessionToken=<userId>%3A%3A<JWT>`，userId 是 JWT 里 `sub` 按 `|` 切开的最后一段。
- **checksum 不需要**：`x-cursor-checksum` 是上游 grok-bot 调另一个客户端（sand）的 `GetSandUsageStatus` 时带的，两家开源工具查 `GetCurrentPeriodUsage` / `usage-summary` 都不带。我们去掉了。
- **返回字段**：`planUsage.totalPercentUsed`（已经是百分数，0.36 表示 0.36%），没有时用 `used` / `limit`（单位都是美分），再没有用 `limit - remaining`；`autoPercentUsed`、`apiPercentUsed` 是 Auto 和指定模型的比例；`billingCycleEnd` 有时是毫秒数字串，有时是 ISO 时间（burnbar 两种都认）。
- **Windows 未核实**：两家都没处理 Windows 上的加密 Token（burnbar 在非 macOS 上遇到 `cursor-safe-storage:` 直接报不支持），不知道 Windows 版 Cursor 是否也加密、用的是不是 Chromium 的 DPAPI + AES-GCM。我们在 Windows 上照读明文 Token，遇到加密的就当没登录、不显示，留实测项。

## 我们怎么改（B78 第二版）

- 新增 `src-tauri/src/claude_usage/cursor_token.rs`：认出明文、`scoped:v1:` 和 `cursor-safe-storage:v1:` 三种存法；macOS 上用已有的 `keyring` 读 `Cursor Safe Storage`，用 `aes`、`cbc`、`pbkdf2`、`sha1`（只在 macOS 编译）解密。
- `cursor.rs` 继续用 `GetCurrentPeriodUsage`，去掉 checksum 和 request id；解析补上 `used` / `remaining` 和 ISO 格式的 `billingCycleEnd`。

## 来源

- steipete/CodexBar，`Sources/CodexBarCore/Providers/Cursor/CursorAppAuth.swift`（读 `cursorAuth/accessToken`、`cursor-safe-storage:v1:` 解密、拼 `WorkosCursorSessionToken`）、`CursorStatusProbe.swift`（`/api/usage-summary` 请求与字段）、`CursorStatusProbe+UsageSummary.swift`（百分比的取法）、`Sources/CodexBarCore/ChromiumSafeStorage.swift`（PBKDF2 和 AES-CBC 参数）：https://github.com/steipete/CodexBar （2026-11-19 读 main）
- nooblk-98/burnbar，`rust/crates/burnbar-core/src/cursor.rs`（`GetCurrentPeriodUsage` 请求头、Safe Storage 解密、解析 `planUsage`）：https://github.com/nooblk-98/burnbar （2026-11-19 读 main）
- 上游 fly-island 1e278b32 的 `plugins/grok-bot/src/main.rs`（checksum 算法、`GetSandUsageStatus`）：https://github.com/flyl1u/fly-island/commit/1e278b32
