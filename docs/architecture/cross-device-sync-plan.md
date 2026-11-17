# 跨设备同步：落地计划

> 组长「[任务] 跨设备同步」写于 2026-11-15，由「Fuyu-[总控] 功能」开出。方案和取舍见调研 [cross-device-sync.md](/docs/research/cross-device-sync.md)，这里只写怎么分给任务会话做。任务会话开工前读这一份和调研的「结论」「五、推荐方案的细节」。

## 现状（读代码得出，2026-11-15）

| 数据 | 谁写 | 怎么写 | 对同步意味着什么 |
|---|---|---|---|
| 待办、以后的待办、每日笔记、归档 | Rust `src-tauri/src/todos/`（`service.rs` 的 `apply` 和插件 / 本地接口走的 `call`） | 前端每次把整个数组传过来（`TodosChange`），Rust 整份写 `todos.json`（`version: 1`） | 两个入口都经过 `service.rs`，**在这里对比新旧数组给变了的条目打 HLC、给消失的条目留墓碑**，前端不用改 |
| 常用短语 | Rust `clipboard_history/snippets.rs` | `save_snippet` / `delete_snippet`，存在 `clipboard-history.json` | 单条增删改，直接在这两个函数里打时间、留墓碑 |
| 链接书签 | Rust `clipboard_history/links.rs`（`links_transfer.rs` 导入导出） | 单条操作，`clipboard-links.json`（`version: 1`） | 同上；顺序也是数据，要排序键 |
| 设置、外观预设、`todoProjects` | 前端 localStorage | 前端每 2 秒把 `BACKUP_KEYS` 整份写到家目录的 `settings.json`（`write_settings_file`），启动时读回 | **Rust 的 `write_settings_file` 是唯一的入口**：在这里按白名单逐个 key / 字段比对、打 HLC，存到旁边的元数据文件；预设按条（`id`）比对。合并后的设置要能在运行中推回前端（C92 做） |
| 设备 id | 没有（锁文件里只有电脑名） | — | 新建，放**应用数据目录**（`home.json` 所在处，不随家目录搬），复制家目录到另一台不会同 id |
| 升级前的备份（D58） | 已有 | — | C92「第一次并入前自动本地备份」复用它 |

## 顺序

```text
C91.1 ──▶ C91.2 ┐
      └─▶ C91.3 ┴─▶ C92.1 ──▶ C92.2 ──▶ C93 ┐
                                        C95 ┴─▶ C94          C96（等 G1.12）
```

- **C91 拆成 3 个子任务、C92 拆成 2 个**（建议，见「要你定的」第 1 条）。拆开后每个会话一次只改一块，diff 好审，交接点清楚。
- C91.1 先独占：它建公共的 `src-tauri/src/sync/`（HLC、设备 id、墓碑类型），后面全用它。
- C91.2（短语、书签）和 C91.3（设置、预设）改的文件不重叠，C91.1 合进本地 `main` 后**可以并行**。
- C92.1 → C92.2 串行：界面要等引擎的命令定下来。
- C92.2 做完后 C93（WebDAV）和 C95（剪贴板收藏）并行：C93 只加后端，C95 只加一个数据类别。
- C94（加密）放在 C93 之后：它要改引擎读写远端的那一层，和 C93 同时改容易撞。
- C96（局域网直连）这一轮不派：要等 Mac 正式签名（G1.12，只有用户本人能做），而且量最大（估 1500–2500 行 Rust）。到时再单独规划。

## 每批派什么

同时最多 2 个要编译的会话；派之前看 ListAgents，全机器改代码的会话超过 6 个就往后排。

| 批 | 任务会话 | 并行 |
|---|---|---|
| 1 | `[C91.1]` | 1 个 |
| 2 | `[C91.2]` + `[C91.3]` | 2 个 |
| 3 | `[C92.1]` | 1 个 |
| 4 | `[C92.2]` | 1 个 |
| 5 | `[C93]` + `[C95]` | 2 个 |
| 6 | `[C94]` | 1 个 |
| 以后 | `[C96]` | 等 G1.12 |

每批验完的提交交给「Fuyu-[总控] 全局」整批合入；下一批不必等 PR 合入，只要上一批的提交在本地 `main` 上、验证通过。

## 各任务

`--scope` 里没列的文件不改；要改别人范围里的文件（`lib.rs`、`Cargo.toml` 这类热点文件除外）先告诉组长。热点文件（`lib.rs`、`Cargo.toml`、`contracts.md`、`data-storage.md`、`platforms.md`、`searchIndex.json`、`capabilities/`）改完就单独提交，同一个文件里有别人的改动时用 `pnpm mq:commit-part`。

### C91.1 公共层和待办

- **做什么**
  - 新模块 `src-tauri/src/sync/`：`clock.rs`（HLC：`(物理毫秒, 计数器, 设备 id)`，可序列化成能按字符串排序的形式，收到远端时间时推进本机时钟，时钟回拨时不倒退）、`device.rs`（设备 id：应用数据目录 `sync-device.json`，没有就生成随机 id；第一版不和机器指纹绑定，靠「不在家目录里」防复制）、`record.rs`（墓碑类型 `{ id, deletedAt: HLC, deviceId }`，保留 90 天的清理函数）。
  - `todos.json` 升到 `version: 2`：`todos`、`scheduled`、归档里的待办每条加 `updatedAt`、`deviceId`；新增 `tombstones`（删掉的待办 id）；`dailyNoteUpdatedAt`；归档加 `updatedAt`。旧文件（`version: 1`）读入时补上：`updatedAt` 取 `createdAt` 换成的 HLC。
  - 打时间放在 `service.rs`：新旧两份逐条比较，**只有内容字段变了才更新**（只改 `activeTodoId`、`date` 不算），消失的 id 进墓碑。插件和本地接口走 `call`，也要经过同一个函数。
  - 前端的 `TodosChange` 不传这些字段：Rust 回给前端的数据里带不带它们，前端类型要能容忍（`src/features/todos/` 只在类型上加可选字段，不在前端算时间）。
- **scope**：`src-tauri/src/sync/,src-tauri/src/todos/,src/features/todos/api.ts,src/features/todos/types.ts,docs/architecture/contracts.md,docs/architecture/data-storage.md`（另加 `lib.rs` 注册模块；前端类型文件以实际文件名为准）
- **做完**：旧 `todos.json` 读入、改一条、写回后，其余条目的 `updatedAt` 不变；HLC 比较、时钟回拨、墓碑过期都有单元测试；`contracts.md` 写清 v2 格式和旧版本岛屿读到 v2 时会怎样（现在是报「较新版本写的」并拒绝，要在说明里点明降级不能回读）。
- **验证**：`pnpm heavy -- cargo test --manifest-path src-tauri/Cargo.toml`、`pnpm build:exe`、`pnpm check`、`pnpm build`；动了待办界面的类型时跑 `pnpm test:regression todo`。

### C91.2 常用短语和链接书签

- **做什么**：短语、书签每条加 `updatedAt`、`deviceId`，删除留墓碑（存在各自文件里）；书签的顺序加排序键（例如分数排序值，移动一条只改它自己）。`links_transfer.rs` 的导入算本机改动。两个文件的 `version` 升一级并兼容旧文件。
- **scope**：`src-tauri/src/clipboard_history/snippets.rs,src-tauri/src/clipboard_history/links.rs,src-tauri/src/clipboard_history/links_tests.rs,src-tauri/src/clipboard_history/links_transfer.rs,src-tauri/src/clipboard_history/store.rs`
- **做完**：改一条只动这一条的时间；删除留墓碑；旧文件照读；单元测试。`contracts.md` 一行（热点文件，单独提交）。
- **验证**：`cargo test`、`pnpm build:exe`；动了前端类型时 `pnpm check` + `pnpm build` + `pnpm test:regression clipboard`。

### C91.3 设置白名单和外观预设

- **做什么**
  - 白名单文件 `src-tauri/src/sync/settings_whitelist.json`（`include_str!` 进 Rust，前端测试也读）：`BACKUP_KEYS` 每个 key、`fuyu-settings` 每个字段、`fuyu-translation-settings` 等对象里的每个字段，标 `sync`、`local` 或 `firstMergeOnly`（模块总开关这类只在第一次并入时带过去）。照调研第一节的表，**逐个追到使用处再确认**，拿不准的标 `local`。
  - 新加的设置默认 `local`：加一个 Node 单元测试，读 `settingsDefaults.ts` 的字段和 `BACKUP_KEYS`，没在白名单里出现的报错，逼新加设置的人想一下要不要同步（运行时没列出的一律不同步）。
  - `settings_file.rs` 的 `write_settings_file`：和上一份比较，白名单内变了的 key / 字段打 HLC，存到家目录的 `settings-sync-meta.json`；`fuyu-setting-presets` 按预设 `id` 逐条打时间、删掉的留墓碑，去掉预设里的设备字段。`todoProjects` 按 `id` 逐条处理。
- **scope**：`src-tauri/src/settings_file.rs,src-tauri/src/sync/settings_whitelist.json,src-tauri/src/sync/settings_meta.rs,tests/unit/sync-settings-whitelist.test.mjs`
- **做完**：白名单覆盖全部现有设置（测试证明）；改一个设置只动这个 key 的时间；单元测试；白名单的结果抄一份进计划文件末尾供 C92.2 的界面用。
- **验证**：`cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`。

### C92.1 同步引擎和同步文件夹（后端）

- **做什么**
  - `src-tauri/src/sync/` 里加：`backend.rs`（「列目录 / 读 / 写 / 删」接口，C93 的 WebDAV 实现同一个接口）、`backend_folder.rs`（同步文件夹：写 `.` 开头的临时文件再改名；忽略冲突副本和网盘临时文件；目录不在时整轮跳过）、`layout.rs`（`fuyu-sync/meta.json`、`devices/<id>/<类别>.json`、`schemaVersion`）、`merge.rs`（按条 HLC 后写者赢、墓碑、上次同步的底稿；每日笔记两边都改时留冲突副本）、`categories/`（每类一个文件：待办、短语、书签、设置、预设；C95 往这里加剪贴板收藏）、`engine.rs`（拉 → 合并 → 写回本地 → 写自己的目录 → 存底稿；防抖推送、定时拉取、启动拉一次）、`codec.rs`（远端文件的编码这一层先是原样 JSON，**留给 C94 插加密**）。
  - 安全阀：第一次并入前做本地备份（复用 D58）；一次要删掉大部分数据或远端被清空时停下来，状态里报「需要确认」；读不了的文件跳过；远端 `schemaVersion` 比本机新时这一类停止。
  - 合并结果写回：待办、短语、书签经各自的 service（不重新打时间）；设置写回 `settings.json` 并发事件，前端收到后应用（运行中生效，不只启动时读）。
  - 命令：取同步状态、设置同步文件夹和类别、立即同步、确认大量删除；事件：状态变化。同步配置（文件夹路径、开了哪些类别）是本机设置，不同步。
- **scope**：`src-tauri/src/sync/`（C91 的文件除外，要改先说）、`src-tauri/src/todos/service.rs`、`src-tauri/src/clipboard_history/service.rs`、`src-tauri/src/settings_file.rs`、`src/features/sync/api.ts`、`src/features/settings-backup/`、`docs/architecture/contracts.md`、`docs/architecture/data-storage.md`、`docs/architecture/platforms.md`
- **做完**：用两个临时目录模拟两台设备的测试：增、改、删、并发改同一条、每日笔记冲突、首次并入、大量删除刹车、目录不在、远端版本更新；`api.ts` 的类型写好给 C92.2 用。
- **验证**：`cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`。

### C92.2 同步设置页

- **做什么**：设置里新加「同步」页（`src/windows/settings/SyncSettingsPage.tsx`，分节放进 `src/features/sync/`）：选文件夹、同步哪几类、立即同步、上次结果、设备列表、大量删除时的确认；帮助写 OneDrive / iCloud / 坚果云同步盘 / Syncthing / NAS 共享的用法；中英文。**分节拆成单独的文件**，后端选择留成可扩展的列表，给 C93（WebDAV 表单）、C94（加密开关）各留一个位置，它们只加自己的文件、在列表里加一行。
- **scope**：`src/features/sync/`（`api.ts` 归 C92.1）、`src/windows/settings/SyncSettingsPage.tsx`、`src/windows/settings/slots/`（注册分类）、`src/i18n/sections/sync.ts`、`src/windows/settings/searchIndex.json`、`tests/regression/sync-settings.*`
- **做完**：`pnpm settings:index`；新回归页（深浅两色、窄窗口不溢出）和快照。
- **验证**：`pnpm check`、`pnpm build`、`pnpm test:regression`。

### C93 WebDAV

- **做什么**：`src-tauri/src/sync/backend_webdav.rs`（加 `webdav/` 子目录也行）：PROPFIND（Depth: 1，750 条分页）、GET、PUT、DELETE、MKCOL；`Accept-Encoding: identity`；ETag 带不带引号都认；不用 LOCK；503 退避；请求预算（600 次 / 30 分钟内留余量）。地址、用户名是本机设置，应用密码进凭据管理器 / 钥匙串（走已有的 `keyring`）。设置页加 WebDAV 表单和「测试连接」，帮助写坚果云应用密码、Nextcloud、群晖。
- **scope**：`src-tauri/src/sync/backend_webdav*.rs`（或 `src-tauri/src/sync/webdav/`）、`src/features/sync/WebdavSection.tsx`（以 C92.2 留的位置为准）、新文案文件 `src/i18n/sections/syncWebdav.ts`、`Cargo.toml`（XML 解析库）
- **做完**：用本地起的 WebDAV 服务（例如测试里起一个最小的 mock 服务器）跑通两台设备的合并；坚果云分页、ETag、503 有单元测试；断网、密码错、超频率的提示。
- **验证**：`cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`、`pnpm test:regression sync`。
- **只能人测**：真坚果云账号、Nextcloud 或群晖（见实测清单）。

### C95 剪贴板收藏（默认关）

- **做什么**：`sync/categories/clip_favorites.rs`；收藏 / 取消收藏带时间（`clipboard_history/pins.rs`）；只同步文字，按内容 hash 去重；`pinKey` 合并后重复时按 HLC 裁决、输的那条去掉固定键；敏感、打码、带排除格式的不上传也不被覆盖。设置页类别列表里加一行（默认不勾）和说明。
- **scope**：`src-tauri/src/sync/categories/clip_favorites.rs`、`src-tauri/src/clipboard_history/pins.rs`、`src-tauri/src/clipboard_history/privacy.rs`（只读，要改先说）、C92.2 类别列表文件里的一行、新文案文件 `src/i18n/sections/syncFavorites.ts`
- **做完**：两台各收藏、取消、删除、复制同一段字后的合并测试；开关和说明中英文。
- **验证**：`cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`、`pnpm test:regression sync`。

### C94 端到端加密（可选，默认关）

- **做什么**：`src-tauri/src/sync/crypto/`：Argon2id（64 MiB、3 轮）派生密钥包住随机数据密钥，放 `meta.json`；XChaCha20-Poly1305，AAD 绑定远端路径和 `schemaVersion`；数据密钥进钥匙串，口令不存；密钥校验值；恢复密钥导出；重置远端；开关加密时远端整体重写。插进 C92.1 留的 `codec.rs`。设置页加密分节：打开时明确提醒「忘了口令数据就找不回来」。
- **scope**：`src-tauri/src/sync/crypto/`、`src-tauri/src/sync/codec.rs`、`src-tauri/src/sync/layout.rs`（`meta.json` 字段）、`src/features/sync/EncryptionSection.tsx`、新文案文件 `src/i18n/sections/syncEncryption.ts`、`Cargo.toml`（`argon2`、`chacha20poly1305`）
- **做完**：加解密、口令错、改口令、恢复密钥、开关加密的迁移测试；同步文件夹和 WebDAV 两种后端都过一遍。
- **验证**：`cargo test`、`pnpm build:exe`、`pnpm check`、`pnpm build`、`pnpm test:regression sync`。

### C96 局域网直连（这一轮不派）

等 G1.12（Mac 正式签名）。到时组长或总控另写计划：自签证书、mDNS、配对码 + SPAKE2、双向 TLS、Windows 防火墙和 Mac 本地网络权限。

## 只能在别的机器或真账号上测的（实测清单）

本机是 Mac；下面这些各任务会话做完时写进自己任务的 `tasks note`，再由组长汇总成一个 `--needs user` 的任务（先提 issue）。

1. **Windows 上的同步文件夹**（C92）：OneDrive 文件夹里放同步目录，Windows 和 Mac 互改待办、短语、设置；OneDrive 占位文件（只在线）第一次读会触发下载，客户端退出时报 `0x8007016A` 要能跳过这一轮。
2. **Mac 的 iCloud Drive / 坚果云同步盘**（C92）：两台 Mac 或 Mac + Windows（坚果云客户端）互改；休眠唤醒后目录暂时不在，不能当成全删。
3. **Syncthing 或 SMB 共享**（C92）：Windows ↔ Mac，SMB 没挂载时跳过。
4. **真坚果云账号**（C93）：应用密码、两台同步、超过 750 个文件时分页、请求频率；**Nextcloud 或群晖**各一遍（群晖的 ETag 带引号）。
5. **Windows 凭据管理器 / Mac 钥匙串**（C93、C94）：WebDAV 密码和数据密钥存进去、重启后能读、卸载重装后的提示。
6. **两台真机的加密同步**（C94）：一台打开加密，另一台输口令加入；口令输错的提示；恢复密钥。
7. **QQ / 微信那几个只在 Windows 上有的设置**（C91.3）：Windows 改了不会让 Mac 出错（它们应标 `local`）。

## 用户的决定（2026-11-15）

用户在「Fuyu-[总控] 功能」里回复「可以,按你推荐来即可」：下面 5 条都照建议做。子任务和 issue：C91.1 #559、C91.2 #560、C91.3 #561、C92.1 #562、C92.2 #563；C94 加了依赖 C93。


1. **拆子任务**：C91 拆成 C91.1 / C91.2 / C91.3，C92 拆成 C92.1 / C92.2（每个子任务各提一个 issue，C91、C92 原 issue 作为父任务的 issue，最后一个子任务做完时一起关）。还是不拆，C91、C92 各一个会话做到底？
2. **同步文件夹的默认位置**：不给默认，第一次打开时必须自己选（建议）；还是预先填一个（Mac 填 iCloud Drive 下的 `Fuyu`，Windows 填 OneDrive 下的 `Fuyu`，存在才填）？
3. **设置白名单的边界**（调研第一节的建议）：
   - 外观里和屏幕大小有关的（`collapsedWidthExtra`、`collapsedScale`、`expandedScale`、`panelWidth`、`maxPanelHeight`）默认**不同步**；
   - 各模块总开关（`musicEnabled`、`mailEnabled` 等）**只在第一次并入时带过去**，之后各台自己定；
   - 快捷键一律不同步（两台平台不同，快捷键也不同）。
   照这个来吗？
4. **同步频率**：本地改动 5 秒防抖后推送，每 5 分钟拉一次，启动时和打开同步页时各拉一次（坚果云的请求额度够用）。照这个来吗？
5. **C96 局域网直连**：这一轮不派，等 Mac 签名（G1.12）之后再规划。同意吗？

## 设置白名单（C91.3）

> c91-3 写于 2026-11-15，抄自 `src-tauri/src/sync/settings_whitelist.json`（以那份为准）。给 C92.1 合并、C92.2 设置页用。`sync` 照常按时间合并；`firstMergeOnly` 只在这台第一次并入时从远端带过来，之后各台自己定；`byId` 按 `id` 逐条合并（有墓碑和顺序时间）；`local` 不出本机。白名单没列的设置一律 `local`，`tests/unit/sync-settings-whitelist.test.mjs` 要求新加的 key 和字段都列进去。

| 整个 key | 取值 |
|---|---|
| sync | `fuyu-settings`（按字段，见下）、`fuyu-locale`、`fuyu-translation-settings`（按字段，见下）、`fuyu-qq-mail-remote-images`、`fuyu-plugin-market-favorites`、`fuyu-screenshot-annotation`、`fuyu-screenshot-settings`（按字段，见下）、`fuyu-agent-sounds`（按字段，见下）、`fuyu-agent-session-filters`、`fuyu-agent-approval`（按字段，见下）、`fuyu-agent-push`（按字段，见下）、`fuyu-lyrics-offsets` |
| byId | `fuyu-setting-presets` |
| local | `fuyu-music-sources`、`fuyu-qq-notifications-enabled`、`fuyu-wechat-reminders-enabled`、`fuyu-wechat-expose-ui`、`fuyu-wechat-hide-taskbar-button`、`fuyu-qq-mail-settings`、`fuyu-collapsed-items`、`fuyu-plugin-pages`、`fuyu-save-directory`、`fuyu-update-channel`、`fuyu-update-preferences` |

| 对象设置 | sync | firstMergeOnly | byId | local |
|---|---|---|---|---|
| `fuyu-settings` | `appearanceMode`、`fontFamily`、`glassIntensity`、`opacity`、`topFilletRadius`、`islandCornerRadius`、`islandCornerShape`、`islandMotion`、`agentHostDisplay`、`agentSessionView`、`agentSessionSort`、`agentSessionGroup`、`agentArchiveMotion`、`agentCardEffects`、`agentSessionHours`、`agentHiddenProviders`、`agentHideFinished`、`agentHideClosed`、`agentShowElapsed`、`agentShowModel`、`agentShowActivity`、`agentShowUsage`、`agentExpandChildren`、`agentAlertCompleted`、`agentAlertFailed`、`agentAlertWaiting`、`agentAlertStarted`、`agentAlertSeconds`、`agentRemindSeconds`、`agentQuotaAlertPercent`、`taskTextColor`、`pulseColor`、`pulseBrightness`、`islandBackgroundColor`、`collapsedDark`、`panelDark`、`accentMode`、`accentColor`、`themeMode`、`darkBackgroundColor`、`darkTextColor`、`darkPulseColor`、`lightBackgroundColor`、`lightTextColor`、`lightPulseColor`、`darkInkColor`、`lightInkColor`、`inkColor`、`showTitle`、`showCollapsedText`、`showIdleTodoCount`、`carryOverIncompleteTodos`、`enableTodoReorder`、`rotateTodos`、`todoRotationSeconds`、`autoTuck`、`autoTuckSeconds`、`autoTuckHoldTodo`、`autoTuckHoldAgent`、`autoTuckHoldMusic`、`autoTuckHoldMessages`、`autoTuckRetract`、`autoTuckRetractDelayMs`、`revealOnMessage`、`messageNotice`、`messagePanelSeconds`、`expandTrigger`、`hoverExpandDelayMs`、`hoverCollapseDelayMs`、`hoverSwitchPage`、`hoverSwitchDelayMs`、`minimizeAction`、`tuckedHoverAction`、`agentTitleMode`、`agentLightStyle`、`translationTarget`、`screenshotGuides`、`shelfExpandOnDrop`、`shelfAutoCleanupDays`、`shelfRemoveMissing`、`shelfRemoveAfterDragOut`、`shelfMaxItems`、`shelfDoubleClick`、`shelfShowCount`、`sideMusicCover`、`lyricsOnline`、`lyricsChinese`、`lyricsOffsetMs`、`lyricsOnIsland`、`lyricsIslandPriority`、`lyricsIntro`、`lyricsKaraoke`、`lyricsKaraokeFallback`、`lyricsKaraokeFill`、`lyricsKaraokeColor`、`lyricsKaraokeCustomColor`、`lyricsKaraokeDim`、`lyricsKaraokeGlow`、`lyricsKaraokeFollow`、`lyricsCoverColor`、`calendarRemindMinutes`、`calendarShowTitle`、`glassStyle`、`glassColorSource`、`glassColor1`、`glassColor2`、`glassColor3`、`glassColorStrength`、`glassFlowSpeed`、`glassBlobScale`、`glassFlowWhen`、`glassRim`、`glassRimWidth`、`glassSheen`、`glassSpecular`、`glassMorph`、`glassContrastGuard` | `todoEnabled`、`musicEnabled`、`agentStatusEnabled`、`agentTitleEnabled`、`shelfEnabled`、`translationEnabled`、`screenshotEnabled`、`deviceUseIndicator`、`levelPopup`、`deviceAlerts`、`calendarEnabled`、`mailEnabled` | `todoProjects` | `topEdgeLayoutVersion`、`collapsedScale`、`expandedScale`、`marginY`、`islandMonitor`、`menuBarPlacement`、`islandForm`、`maxPanelHeight`、`panelWidth`、`collapsedWidthExtra`、`windowsDark`、`pageDigitModifiers`、`pageNextShortcut`、`pagePreviousShortcut`、`lyricsFolder`、`gameDoNotDisturb`、`gameAutoTuck`、`hoverTakesKeyboard` |
| `fuyu-translation-settings` | `direction`、`pasteClipboardOnOpen`、`autoTranslate` | — | — | `shortcut`、`selectionShortcut`、`provider`、`customBaseUrl`、`models` |
| `fuyu-screenshot-settings` | `cardSeconds`、`historyDays` | — | — | `shortcuts`、`printScreen`、`saveFolder`、`record`、`version` |
| `fuyu-agent-sounds` | `events`、`quietWhenInFront`、`quietHours` | `enabled` | — | `volume`、`pack` |
| `fuyu-agent-approval` | `onIsland`、`whenInFront` | — | — | — |
| `fuyu-agent-push` | `events`、`awayMinutes` | — | — | `enabled`、`server`、`channel`、`mutedHosts`、`ccConnect` |

拿不准标成 `local` 的，以及和调研的表不一样的地方：

- `fuyu-translation-settings` 的 `provider`、`models`、`customBaseUrl`：密钥各台单独填，自定义地址常是本机的服务（Ollama 之类），同步过去多半用不了。调研原写「除快捷键外都同步」。
- `fuyu-screenshot-settings` 的 `printScreen`（接管 PrtSc 键，和键盘、平台有关）、`record`（系统声音、麦克风、帧率看机器）。
- `fuyu-agent-sounds` 的 `volume`（看音箱）、`pack`（音效包可能是另一台没装的插件）；`enabled` 当作模块总开关，`firstMergeOnly`。
- `fuyu-agent-push`：只同步 `events`、`awayMinutes`；`enabled`、`channel` 也是本机的（两台都开会推两遍）。
- 调研里的「可选」（`fuyu-qq-mail-settings`、`fuyu-collapsed-items`、`fuyu-plugin-pages`、`fuyu-update-channel`）这一版都是 `local`：邮箱要各台登录，收起态和插件页里有插件、用量的 id，两台装的不一样。
- `fuyu-settings` 里另加的 `local`：`islandForm`（刘海形态只在 Mac 上有）、`gameDoNotDisturb` / `gameAutoTuck`（默认值按平台不同）、`hoverTakesKeyboard`（和快捷键一节放在一起）、`topEdgeLayoutVersion`（迁移标记）。
- `firstMergeOnly` 的模块开关：`todoEnabled`、`musicEnabled`、`agentStatusEnabled`、`agentTitleEnabled`、`shelfEnabled`、`translationEnabled`、`screenshotEnabled`、`calendarEnabled`、`mailEnabled`、`deviceUseIndicator`、`levelPopup`、`deviceAlerts`。
- 外观预设：`settings` 里只有标 `sync` 的字段参与比较和同步（应用预设本来只取主题那几项）。

### 可选同步（用户定，2026-11-15）

上面「拿不准标成 `local`」的几项改成**可以同步，默认关**，用户在「同步」设置页按组打开。用户原话：「改成跟着同步,当然了默认是关闭的,可以设置」。`fuyu-settings` 里另加的 `local`（`islandForm`、`gameDoNotDisturb` 等）和 `firstMergeOnly` 的模块开关不变。

- 白名单加一种取值 `optional`，并加 `optionalGroups`（组名 → `key` 或 `key/字段` 的列表）。`optional` 和 `sync` 一样按条打时间（以后打开时已有时间可比），同步引擎在这一组没打开时把它当 `local`：不写进远端，也不并入远端的值。哪几组打开了是本机设置，不同步。
- 分组：

| 组 | 包含 |
|---|---|
| `translationProvider` | `fuyu-translation-settings` 的 `provider`、`models`、`customBaseUrl` |
| `screenshotCapture` | `fuyu-screenshot-settings` 的 `printScreen`、`record` |
| `agentSoundOutput` | `fuyu-agent-sounds` 的 `volume`、`pack` |
| `agentPushDelivery` | `fuyu-agent-push` 的 `enabled`、`channel` |
| `qqMail` | `fuyu-qq-mail-settings`（同步前确认里面没有密码或令牌，有就剔掉） |
| `collapsedItems` | `fuyu-collapsed-items` |
| `pluginPages` | `fuyu-plugin-pages` |
| `updateChannel` | `fuyu-update-channel` |

- 拆分：白名单、`settings_meta.rs` 的 `optional`、引擎按组过滤、本机配置和 `api.ts` 类型归 C92.1；设置页里每组一个开关（默认关，中英文说明各自为什么默认不同步）归 C92.2。
