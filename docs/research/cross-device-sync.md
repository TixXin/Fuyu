# 跨设备同步

> 日期：2026-11-15（会变的数字都是这天查的）。问题：用户群希望加 WebDAV 同步，把设置、待办、剪贴板这些带到另一台电脑上。要回答：哪些数据值得同步，能用哪些方式同步，冲突怎么合并，密钥和隐私怎么处理，同类软件怎么做，第一版做什么、分几步落地。范围：本仓库代码（数据结构、存放位置）；坚果云帮助与价格页、Cloudflare / AWS / 阿里云 / 腾讯云 / MinIO 文档、Microsoft Learn、Apple 支持页与 TN3179；用 `gh api` 读了 Joplin、Remotely Save、思源 dejavu、Logseq、Zotero、VS Code、Cherry Studio、SyncClipboard、TieZ、QuickClipboard、EcoPaste、CrossPaste、Ditto、LocalSend、Syncthing、KDE Connect 的文档或源码；crates.io。都是查资料、读源码得出的，**没有用真实的坚果云账号或两台真机实测**。相关任务：C68（issue #319）；之前的 C24.10「跨设备同步」2026-11-10 决定不做。

## 结论

**用户已定（2026-11-15）**：第一版只在 Windows 和 Mac 电脑之间同步，手机端以后再说，但格式要给它留余地；端到端加密可选、默认关，打开时明确提醒「忘了口令数据就找不回来」。

1. **同步什么**。第一版同步：待办（含以后的待办、每日笔记、归档）、常用短语、链接书签，以及设置和外观预设里不和设备相关的项。这些加起来只有几十到几百 KB，改得也不频繁。以下默认关、用户自己打开：剪贴板收藏（只同步文字）、已装插件清单（只做「另一台装了这些」的提示）。永远不同步：所有凭据和 API key、剪贴板普通历史和图片、截图、文件中转、插件私有数据和授权、Agent 运行数据、窗口位置 / 显示器 / 路径 / 快捷键这类本机设置。
2. **设置不能整份同步**。`BACKUP_KEYS` 里有一半是设备相关的（`islandMonitor`、`lyricsFolder`、`fuyu-save-directory`、`fuyu-music-sources`、各种快捷键、`fuyu-update-preferences`），QQ / 微信通知还只在 Windows 上有。要学 VS Code：维护一份「可同步的设置项」白名单，新加的设置默认只留在本机。也**不能把整个家目录放进网盘**：`fuyu.lock` 会让另一台拒绝启动，设备字段还会互相覆盖（思源也明说不支持把数据放进同步盘）。
3. **同步方式**。第一版做两种，共用一套代码：
   - **同步文件夹**：用户选一个由 OneDrive、iCloud Drive、坚果云同步盘、Syncthing 或 SMB 共享管着的目录，浮屿只读写本地文件。实现最简单，局域网里的 Mac + Windows 用户也能用它（Syncthing 或 NAS 共享）。
   - **WebDAV**：坚果云覆盖大多数国内用户，Nextcloud、群晖、InfiniCLOUD 用同一套代码。

   S3 兼容（R2、MinIO、OSS、COS）放第二版。局域网直连以后单做，作为「局域网剪贴板互传」功能，复用同一套记录格式。Gist、自建服务端、各家网盘 API、iCloud CloudKit 暂不做。
4. **远端布局：每台设备只写自己的文件**。远端是 `fuyu-sync/meta.json` 加 `devices/<设备 id>/<类别>.json`。每台设备只整份重写自己的目录，读所有设备的目录，在本地逐条合并（TieZ 的做法）。这样不需要锁，也不需要条件写。坚果云的 LOCK 返回 403，ETag 不带引号；网盘文件夹根本没有条件写；OSS / COS 不支持 If-Match：这个布局对所有这些通道都安全。
5. **冲突：按条后写者赢，用混合逻辑时钟（HLC）比较，再加上次同步的底稿**。
   - 每条记录有 `id`、`updatedAt`（HLC）、`deviceId` 和删除标记（墓碑）。时间戳相同时按设备 id 定胜负。
   - 本地保存上次同步时的快照，用来分辨「对方删了这条」和「这条是我新建的」。
   - 每日笔记是整篇文字，两边都改了时留一份冲突副本，不悄悄丢掉一边。
   - 第一版不用 CRDT。
   - 现在的数据都是整份覆盖，**没有一类同时具备 id、updatedAt 和墓碑**，这是要先补的地方。
6. **加密**（可选，默认关）：
   - 口令经 Argon2id（64 MiB、3 轮）派生出一把密钥，用它包住一把随机的数据密钥；数据用 XChaCha20-Poly1305 加密，附加数据（AAD）绑定远端路径和格式版本。
   - 解开的数据密钥存在系统钥匙串里，口令不存。
   - 提供「导出恢复密钥」和「重置远端」。
   - 文件名只用设备 id 和固定的类别名，不泄露内容。
7. **凭据**：WebDAV 账号和应用密码跟现有的邮箱、翻译密钥一样放凭据管理器 / 钥匙串，每台电脑单独填，本身也不同步。
8. **手机端留的余地**：远端文件保持人能读的 JSON，每个文件带 `schemaVersion`；HLC、墓碑、合并规则写成文档；加密用的都是常见算法，没有只在 Rust 里才有的私有格式。以后手机端读写同一个目录就能加入。远端格式版本比自己新时，停止同步这一类并提示升级。

### 分步落地

| 步 | 任务 | 内容 | 依赖 |
|---|---|---|---|
| 1 | [C91](/docs/tasks/C/C91.md) | 数据准备：稳定的设备 id；待办、以后的待办、短语、书签、预设加 `updatedAt`（HLC）；记删除；设置的可同步白名单。属于对外契约（`todos.json` 格式），要升版本、兼容旧文件 | — |
| 2 | [C92](/docs/tasks/C/C92.md) | 同步引擎和「同步文件夹」：远端布局、按条合并、首次并入前自动备份、大量删除时刹车、设置页（选文件夹、立即同步、上次结果） | C91 |
| 3 | [C93](/docs/tasks/C/C93.md) | WebDAV：坚果云、Nextcloud、群晖；凭据进钥匙串；处理坚果云的特殊行为；限制请求频率 | C92 |
| 4 | [C94](/docs/tasks/C/C94.md) | 端到端加密（可选、默认关）：口令、恢复密钥、重置远端 | C92 |
| 5 | [C95](/docs/tasks/C/C95.md) | 剪贴板收藏同步（默认关）：只同步文字，按内容 hash 去重，敏感条目不传；以后再考虑图片 | C92 |
| 6 | [C96](/docs/tasks/C/C96.md) | 局域网直连 / 剪贴板互传：mDNS 发现、配对码、TLS；排在 Mac 有正式签名的包之后 | C92；Mac 签名（G1.12） |

S3 兼容等有用户要时再建任务。到时先评估 Apache OpenDAL，看它值不值得替换手写的 WebDAV。

## 详细

### 一、本地数据：哪些值得同步

数据位置见 [data-storage.md](/docs/architecture/data-storage.md)。下表根据读代码得出（2026-11-15，`main`）。

| 数据 | 位置 | 有 id | 有修改时间 | 删除 | 大小 / 频率 | 结论 |
|---|---|---|---|---|---|---|
| 待办、以后的待办 | `todos.json` | 有 | 只有 `createdAt`、`startedAt` | 直接从数组拿掉 | 很小；每次操作整份重写 | **同步** |
| 每日笔记 | `todos.json` 的 `dailyNote` | 无（整篇一个字符串） | 无 | — | 小 | **同步**，整篇 LWW，两边都改留冲突副本 |
| 归档 | `todos.json` 的 `archives` | 以 `date` 为键 | `savedAt` | — | 一年几百 KB 内 | **同步**，按日期取并集；`filePath` 是本机路径，去掉 |
| `activeTodoId`、`date`、`revision`、`migration` | `todos.json` | — | — | — | — | 本机状态，不同步 |
| 常用短语 | `clipboard-history.json` 的 `snippets` | 有 | 无 | 硬删 | ≤100 条，很少改 | **同步** |
| 链接书签 | `clipboard-links.json` | 有 | `addedAt` | 硬删 | ≤1000 条；已有导入导出 | **同步**；顺序也是数据，需要排序键 |
| 设置 | localStorage，`BACKUP_KEYS` 24 个 key，另写 `settings.json` | — | 无 | — | 约 6 KB | **按白名单同步** |
| 外观预设 | `fuyu-setting-presets` | 有 | `createdAt` | 硬删；默认预设靠 `isDefault` 补回 | 几 KB | **同步**，预设里的设备字段也要去掉 |
| 剪贴板收藏 | `clipboard-history.json` 的 `items` | 有（`时间戳-hash`） | `copiedAt`；收藏本身没有时间 | 硬删 | 整份 500 条约 5.4 MB（缩略图 base64） | **可选，默认关**，只同步文字；两台复制同一段字 id 不同、hash 相同，按 hash 去重；`pinKey` 全局唯一，合并后要裁决 |
| 剪贴板普通历史、图片 | 同上、`clipboard-images/` | | | | 每次复制都变，体积大，最敏感 | **不同步** |
| 已装插件清单、启用状态 | `plugins.json` | 插件 id | 无 | — | 小 | **可选**：只做「另一台装了这些」的提示；授权、撤销名单、插件包都不同步，每台各自下载验签 |
| 插件私有数据、插件秘密 | `plugins-data/`、钥匙串 | | | | | 不同步（宿主看不懂内容；以后由插件自己声明） |
| 日历订阅、邮箱账号 | `calendar-sources.json`、`fuyu-qq-mail-settings` | 有 | 无 | | 小 | 名称、地址、用户名可选同步，作为「要重新登录」的提示；订阅链接（常带私密令牌）和密码不同步 |
| 截图、文件中转、计时器、Agent 相关、SSH 隧道、cc-connect | 家目录各文件 | | | | | 不同步（体积大、敏感，或本身就是本机的进程 / 路径） |
| 全部凭据 | 凭据管理器 / 钥匙串 | | | | | **永不同步**（和 C24.10 当时的倾向一致） |

代码出处：`TodoItem` 在 `src-tauri/src/todos/model.rs`（`id, title, completed, created_at, project, started_at`，没有修改时间）；`BACKUP_KEYS` 在 `src/features/settings-backup/backup.ts`；短语在 `src-tauri/src/clipboard_history/snippets.rs`；书签在 `clipboard_history/links.rs`。

**`BACKUP_KEYS` 逐个判断**：

| 同步 | 不同步（设备或平台相关） | 可选 |
|---|---|---|
| `fuyu-locale`、`fuyu-qq-mail-remote-images`、`fuyu-plugin-market-favorites`、`fuyu-screenshot-annotation`、`fuyu-agent-sounds`、`fuyu-agent-session-filters`、`fuyu-agent-approval`、`fuyu-lyrics-offsets`；`fuyu-settings` 和 `fuyu-setting-presets` 的通用字段；`fuyu-translation-settings` 除快捷键外；`fuyu-screenshot-settings` 除快捷键和保存目录外；`fuyu-agent-push` 的 `events` | `fuyu-music-sources`、`fuyu-save-directory`、`fuyu-update-preferences`、QQ / 微信的四个开关（只在 Windows 上有）、`fuyu-agent-push` 的 `server` / `mutedHosts` / `ccConnect` | `fuyu-qq-mail-settings`、`fuyu-collapsed-items`、`fuyu-plugin-pages`、`fuyu-update-channel` |

`fuyu-settings` 约 130 个字段里，设备相关的有：`islandMonitor`、`marginY`、`lyricsFolder`、`menuBarPlacement`、`windowsDark`、翻页快捷键、`topEdgeLayoutVersion`；和屏幕尺寸有关、建议默认不同步的有：`collapsedWidthExtra`、`collapsedScale`、`expandedScale`、`panelWidth`、`maxPanelHeight`。各模块的总开关（`musicEnabled`、`mailEnabled`……）两台不一定想一样，建议只在第一次并入时带过去。字段的判断是按名字和 `src/features/appearance/types.ts` 做的，实现时要逐个追到使用处再确认。`todoProjects`（待办项目列表）有 id，应当和待办一样按条合并。

**要按条合并，数据结构还缺**：
- 每条的修改时间（HLC），而且只在内容真的变了时才更新：打开、选中、展开都不能刷新时间。Raycast 的手册里记着这个坑：打开一篇没改过的笔记，会覆盖另一台上更新的编辑。
- 删除记录：要么在条目上加 `deleted` 和删除时间，要么在同步状态里保存上次同步时的 id 集合，用差集判断。
- 稳定的设备 id：现在只有锁文件里的电脑名。
- `todos.json` 的 `version` 要升级并兼容旧文件，这属于对外契约。

### 二、同步方式

| 方式 | 国内可用 | 免费额度 | 配置门槛 | 并发安全 | 实现成本 | 排在 |
|---|---|---|---|---|---|---|
| 同步文件夹（OneDrive、iCloud Drive、坚果云同步盘、Syncthing、SMB） | OneDrive 国际版、iCloud（云上贵州）、坚果云能用；Dropbox、Google Drive 不能直连（未核实） | 看网盘 | 最低：选个文件夹 | 没有条件写，两边改同一个文件会产生冲突副本；靠「每台设备只写自己的文件」避开 | 低 | 第一版 |
| WebDAV · 坚果云 | 好 | 上传 1 GB/月、下载 3 GB/月；请求 600 次/30 分钟（付费 1500） | 低：网页生成应用密码 | LOCK 返回 403；ETag 不带引号 | 低 | 第一版 |
| WebDAV · Nextcloud / 群晖 / InfiniCLOUD | 看自建或线路 | 自建；InfiniCLOUD 免费 20 GB | 中 | Nextcloud（sabre/dav）支持 If-Match；群晖的 ETag 要带引号，和坚果云相反 | 和坚果云同一份代码 | 第一版 |
| S3 · R2 / AWS / MinIO | R2 能连，速度看线路（未核实） | R2 10 GB 存储，出流量免费 | 高：开账号、建桶、建令牌 | 写入支持 If-Match / If-None-Match | 中 | 第二版 |
| S3 · 阿里云 OSS / 腾讯云 COS | 好 | COS 新用户 50 GB / 6 个月；OSS 额度未核实 | 高（要实名） | 不支持 If-Match，只有「禁止覆盖」 | 中 | 第二版 |
| 局域网直连 | 好（不出网） | — | 中：配对 | 自己设计 | 高 | 以后单做 |
| GitHub Gist / 仓库 | 不稳（未核实） | 免费 | 中：要建 token | Gist 更新不做版本校验 | 中 | 不做 |
| 自建服务端、OneDrive Graph、iCloud CloudKit | — | — | 高（OAuth、开发者账号） | — | 高 | 不做 |

**坚果云要注意的几处**（都来自第三方项目的 PR，坚果云没有公开文档）：
- 单次 PROPFIND 最多返回 750 项，要分页；
- 读写都带 `Accept-Encoding: identity`，否则 nginx 会把强 ETag 降成弱 ETag；
- If-Match 要用不带引号的原值；群晖正好相反，两种写法都要兼容；
- 请求过多会返回 503，要退避重试。

按「每台设备一个文件」估算，两台设备同步一次约 5–10 个请求；每 5 分钟同步一次，30 分钟约 60 次，离 600 次的上限很远。但不能每改一次就推，要防抖几秒再推送，定时拉取。

**同步文件夹要注意的几处**：
- 写文件时先写同目录下 `.` 开头的临时文件，再原子改名覆盖；
- 读到解析不了的文件，当作「对方写到一半」，下一轮再读；
- 冲突副本（OneDrive 的「文件名-电脑名」、Syncthing 的 `.sync-conflict-*`）和临时文件（`.syncthing.*.tmp`、`~syncthing~*.tmp`、Mac 的 `._*`）都忽略；
- Windows 上读一个还没下载的占位文件，会等网盘客户端下载完；客户端没在运行时报 `0x8007016A`。所以读写放在后台线程，并且要容忍失败；
- **目录暂时不存在（SMB 没挂载、休眠刚醒）时，跳过这一轮，绝不能当作「对方的文件都被删了」**；
- Mac 的 SMB 客户端会缓存目录列表，SMB 也不保证有文件变化通知，所以要定时轮询。

**Rust 实现**：项目已经有 `reqwest` 0.13 和 `keyring` 4.2。
- WebDAV：自己用 reqwest 写，只需要 PROPFIND（Depth: 1）、GET、PUT、DELETE、MKCOL，再加一个 XML 解析库，几百行；`reqwest_dav` 0.3.3 用的也是 reqwest 0.13，可以参考。
- 同步文件夹：直接用 `std::fs`。
- 两者实现同一个「列目录 / 读 / 写 / 删」接口。
- 以后加 S3 时再评估 Apache OpenDAL 0.59。注意它的 WebDAV 后端写入不支持 If-Match。不用 `aws-sdk-s3`（依赖太多）；`rust-s3` 用的是 reqwest 0.12，会多出一份 reqwest。

### 三、局域网（Mac + Windows）

用户 2026-11-15 提到有人在局域网里 Mac 和 Windows 混用，这一节专门查了这种情况。

**第一版靠同步文件夹和 WebDAV 就能覆盖局域网，不用为它单独写代码。** 帮助里写清楚三条路：
- **NAS 的 WebDAV**（群晖、威联通、Nextcloud）：地址填局域网 IP。最稳。
- **Syncthing**：Windows 和 Mac 都有客户端，可以只走局域网（关掉全局发现和中继），传输本身是 TLS 加密的。它写文件也是先写临时文件再改名，配合「每台设备只写自己的文件」，基本不会产生冲突副本。推荐给没有 NAS、又不想用网盘的人。
- **SMB 共享文件夹**：能用，但坑最多（目录缓存、没有变化通知、可能没挂载），只作最后的选择。

覆盖不到的是两台都不想装任何东西、也没有 NAS 的人。他们要的多半是「复制的文字马上到另一台」，而不是待办过几天合并。这正是直连适合做的事。

**直连以后单做**，定位是「局域网剪贴板互传，并能立即触发一次同步」，不替代同步文件夹。原因：
- 两台必须同时开机、在同一网段。
- Windows 第一次监听端口会弹防火墙提示，点取消会生成阻止规则，非管理员点什么都是阻止。浮屿按当前用户安装、不提权，安装时没法预先放行。
- 网络被标成「公用」时发现会失败；路由器开了 AP 隔离时互相看不见。
- macOS 15 起访问本地网络要用户授权（TN3179）。浮屿最低支持 macOS 15，所以每个 Mac 用户都会遇到；只有正式签名的包权限才稳定，从终端跑的开发版测不出来。

最小设计：
- **身份**：自签证书（`rcgen`），设备 id 取公钥的 SHA-256，私钥放钥匙串。
- **发现**：`mdns-sd`（纯 Rust，不用装 Bonjour）注册 `_fuyu._tcp`，并且可以手动填 IP。
- **配对**：一台显示 6 位配对码，另一台输入，用 SPAKE2 把配对码和两边的证书指纹绑在一起（CrossPaste 的做法）；或者退一步，学 KDE Connect 让两边核对校验串。
- **加密**：双向 TLS 1.3，只认配对时记下的指纹。`rustls` 已在依赖树里。
- **传什么**：一是和同步文件夹同一种按设备的记录，对方按序号拉增量，然后走同一套合并（QuickClipboard、Syncthing 都是这样）；二是可选的剪贴板实时推送，敏感条目不推。
- **不做**：打洞、中继、跨网段。

工作量估计 Rust 1500–2500 行，外加一个设置页和配对弹窗（估计，未核实）。排在第一版合入、Mac 有 Developer ID 签名（G1.12）之后。

| 软件 | 发现 | 配对 | 加密 | 离线后补同步 |
|---|---|---|---|---|
| LocalSend | UDP 组播，失败时逐个 IP 注册 | 不配对，每次对方确认；可选 PIN | HTTPS 自签证书，用指纹识别 | 无 |
| Syncthing | UDP 广播或组播，外网用全局发现 | 互相添加设备 id | TLS 1.3，固定指纹 | index id 加序号，重连后只发更新的 |
| KDE Connect | UDP 广播加 mDNS | 首次信任，可核对 8 位校验串 | TLS | 无 |
| CrossPaste | DNS-SD | PIN 加 SPAKE2 | ECDH 后用 AES-CBC（不建议学） | 按对方设备记拉取位置 |
| QuickClipboard | UDP 广播 | 6 位码换长期 token | 明文 HTTP 加 token（按源码推断） | 复用 WebDAV 同步的记录，按 `since` 拉 |
| Ditto | 手填 IP | 共享网络密码 | 用密码做 AES | 无；只有 Windows，安装器用 `netsh` 加防火墙规则 |

### 四、同类软件怎么做

| 软件 | 做法 | 冲突 | 删除 | 加密 |
|---|---|---|---|---|
| Joplin | 每条一个文件，加 `info.json`；`locks/` 目录放锁，3 分钟过期 | 笔记冲突放进「Conflicts」笔记本；2026-09 起改动不重叠时三方合并 | 推送后就删删除记录，切换同步目标时删除会丢（官方承认） | 可选；随机主密钥用口令包住；AES-256-GCM，PBKDF2 22 万次；文件名和结构是明文 |
| Obsidian Sync | 官方服务 | Markdown 用 diff-match-patch 合并，设置 JSON 按 key 合并，其他文件按修改时间 | — | AES-256-GCM，scrypt，路径也加密 |
| Remotely Save | 本地全量 + 远端全量 + 上次同步记录，查 4×4 决策表；远端不放元数据 | 免费版保留较新或较大的；付费版三方合并 | 删除比例超过阈值就中止 | OpenSSL 兼容或 rclone crypt |
| 思源（dejavu） | 像 git 的快照仓库，内容分块去重 | 以上次同步为底稿，默认本地胜，本地旧 7 分钟以上云端胜 | 一边删一边改时保留改的 | zstd 后 AES-256-GCM；scrypt 的盐由口令算出 |
| VS Code Settings Sync | 每种资源一份 `latest`，写入带 If-Match | settings.json 按 key 三方合并；标成 `machine` 的项不同步；快捷键按平台分开存 | — | 不是端到端加密 |
| Cherry Studio | **备份**（整个 zip），不是同步；文件名带主机名，清理时只删本机的 | 恢复时整体覆盖 | — | 没有加密 |
| SyncClipboard | 只同步当前一条，3 秒轮询 | ETag 条件写；README 明说不能用各端时间判断先后 | — | 没有 |
| TieZ（Tauri） | `devices/<id>.json` 每台一份快照、`ops/` 操作日志、`blobs/` 按内容存放 | 按时间戳后写者赢 | 墓碑表按内容 hash 去重 | 可选，默认关；32 字节随机密钥，用二维码分享；AES-256-GCM；blob 文件名用 HMAC |
| QuickClipboard（Tauri） | 索引加分块（每块 500 条），墓碑单独一个文件 | 按 `updated_at` 后写者赢 | `tombstones.json` | 可选；Argon2id 64 MiB / 3 轮，XChaCha20-Poly1305，AAD 用远端路径；图片默认不同步 |
| EcoPaste（Tauri） | 只有手动导出导入的 `.ecopastebak`（ZIP），**没有 WebDAV** | 导入时选合并或覆盖 | — | 可选；Argon2id 加 XChaCha20-Poly1305 |
| Raycast | Pro 才有，分类开关 | 手册里写着三个已知问题：打开没改的笔记会覆盖别处的新编辑；新设备第一次并入时设置可能被覆盖；关掉同步再打开，已删的会回来 | — | 凭据和剪贴板历史不同步 |

归纳：
- **两类做法分数据用**。整份快照（Cherry Studio、EcoPaste）适合备份和搬家，两台都在用时会互相覆盖。按条记录（Joplin、TieZ、QuickClipboard）适合待办、短语、收藏。设置按 key 合并，再排除本机专属的项（VS Code）。浮屿已有的导入导出（C24.8）就是第一类，作为兜底保留。
- **时钟**：只比本机时间有风险（SyncClipboard、思源都专门处理过）。HLC 是 `(物理毫秒, 计数器, 设备 id)` 三元组，收到远端记录时推进本机时钟，几十行就能写完（也有 `uhlc` crate 0.9.0）。
- **CRDT**（Automerge 0.12、yrs 0.28、Loro 1.17）适合同一篇长文逐字并发编辑。代价是远端存的是人读不了的二进制历史，手机端以后也得带同一个库。浮屿的待办和短笔记不需要。
- **墓碑**：不能一推送就删（Joplin 的教训）。至少保留 90 天，等所有活跃设备都同步过再清；超过 180 天没出现的设备，在界面上提示移除。
- **加密**：AES-GCM 的 nonce 只有 12 字节，随机生成多了有重复风险，所以选 XChaCha20-Poly1305（24 字节）。Argon2id 不能每个文件跑一次，派生一次、解出数据密钥后缓存在钥匙串里。age 的 scrypt 收件人每个文件都要跑一遍 KDF，适合整份加密导出，不适合逐条记录。

### 五、推荐方案的细节

**远端布局**（同步文件夹和 WebDAV 一样）：

```text
fuyu-sync/
  meta.json                     # 明文：schemaVersion、是否加密、KDF 参数、包好的数据密钥、密钥校验值
  devices/<设备 id>/
    device.json                 # 设备名、平台、应用版本、最后同步时间
    todos.json                  # 待办、以后的待办、每日笔记、归档、todoProjects（按条，含墓碑）
    snippets.json               # 常用短语
    links.json                  # 链接书签
    settings.json               # 白名单内的设置项，每个 key 带 HLC
    presets.json                # 外观预设（去掉设备字段）
    clip-favorites.json         # 默认关
  blobs/<HMAC>.bin              # 以后放图片，第一版不用
```

- 每个文件带 `schemaVersion`，记录是 `{id, updatedAt: HLC, deviceId, deleted?, ...内容}`。
- 加密时每个文件整体加密，文件名不变。
- `meta.json` 只在第一台设备创建，或重置远端时写。支持 If-Match 时用条件写；不支持时写完回读确认。

**合并流程**：
1. 拉取所有设备的目录。
2. 对每一类数据，用「本地、各设备的远端、上次同步的底稿」逐条比较 HLC。
3. 合并结果写回本地数据（`todos.json` 等）。
4. 整份重写自己的设备目录。
5. 保存新的底稿。

**安全阀**：
- 第一次并入（新设备、重新打开同步、离线超过墓碑保留期）一律按「合并」处理，先自动做一份本地备份；
- 远端被清空或一次要删掉大部分数据时停下来问用户（Joplin 的 `wipeOutFailSafe`、Remotely Save 的删除比例阈值）；
- 解不开或读不了的文件跳过并提示，不让整次同步失败；
- 远端格式版本比本机高时，这一类停止同步并提示升级。

**时机**：本地改动防抖几秒后推送；每几分钟拉取一次；启动和打开同步页时各拉一次。VS Code 是 3 秒防抖加 5 分钟定时，TieZ 默认 120 秒。

**界面**（设置里一页）：
- 选同步方式：文件夹或 WebDAV；
- 选同步哪几类：默认勾选待办、短语、书签、设置和预设；剪贴板收藏默认不勾；
- 「立即同步」按钮、上次同步的时间和结果、看到的设备列表；
- 加密开关，带提醒和恢复密钥导出；
- 帮助里写坚果云应用密码、Syncthing、NAS 的设置方法。

## 来源

各子调研的完整来源列表和原始笔记在本机（主 agent 会话的共享笔记文件夹 `~/Library/Application Support/Claude/side-session-notes/local_996d98a9-…/c68-{a,b,c,d}-*.md`，不进仓库）。下面是正文用到的主要来源。

- 本仓库：`src-tauri/src/todos/model.rs`、`src/features/settings-backup/backup.ts`、`src/features/settings-backup/settingsFile.ts`、`src-tauri/src/clipboard_history/{store,snippets,links,pins}.rs`、`src-tauri/src/plugin_host/store.rs`、`src-tauri/tauri.conf.json`、`src-tauri/tauri.macos.conf.json`、[data-storage.md](/docs/architecture/data-storage.md)、[data-home.md](/docs/features/data-home.md)、[clipboard-managers.md](/docs/research/clipboard-managers.md)
- 坚果云：[第三方应用授权 WebDAV](https://help.jianguoyun.com/?p=2064)、[价格页](https://www.jianguoyun.com/s/pricing)、[pipidu/markQ#1（ETag 不带引号）](https://github.com/pipidu/markQ/pull/1)、[cwuom/NeriPlayer#524（LOCK 403、gzip 弱 ETag）](https://github.com/cwuom/NeriPlayer/pull/524)
- WebDAV：[RFC 4918](https://datatracker.ietf.org/doc/html/rfc4918)、[sabre/dav Server.php](https://github.com/sabre-io/dav/blob/master/lib/DAV/Server.php)、[komikku#1936（群晖 ETag 要引号）](https://github.com/komikku-app/komikku/pull/1936)、[koreader#15707](https://github.com/koreader/koreader/issues/15707)、[InfiniCLOUD](https://infini-cloud.net/en/)、[Zotero WebDAV 服务列表](https://www.zotero.org/support/kb/webdav_services)
- S3：[AWS 条件写](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)、[R2 S3 兼容性](https://developers.cloudflare.com/r2/api/s3/api/)、[R2 价格](https://developers.cloudflare.com/r2/pricing/)、[OSS 不支持 If-Match](https://help.aliyun.com/zh/oss/user-guide/0017-00000245)、[COS PUT Object](https://www.tencentcloud.com/document/api/436/7749)、[COS 免费额度](https://www.tencentcloud.com/zh/document/product/436/6240)
- 同步文件夹：[CF_HYDRATION_POLICY_PRIMARY](https://learn.microsoft.com/windows/win32/api/cfapi/ne-cfapi-cf_hydration_policy_primary)、[0x8007016A](https://learn.microsoft.com/en-us/answers/questions/3842554/error-0x8007016a)、[Eclectic Light：Sonoma 的 iCloud Drive](https://eclecticlight.co/2023/10/25/macos-sonoma-has-changed-icloud-drive-radically/)、[Syncthing 同步原理](https://docs.syncthing.net/users/syncing.html)、[Apple：停用 SMB 目录缓存](https://support.apple.com/101918)
- 局域网：[LocalSend 协议](https://github.com/localsend/protocol/blob/main/README.md)、[Syncthing BEP v1](https://docs.syncthing.net/specs/bep-v1.html)、[KDE Connect 协议](https://invent.kde.org/network/kdeconnect-meta/-/blob/master/protocol.md)、[CrossPaste](https://github.com/CrossPaste/crosspaste-desktop)、[Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)、[Windows 防火墙规则](https://learn.microsoft.com/windows/security/operating-system-security/network-security/windows-firewall/rules)、[Rebex：防火墙弹窗点取消](https://blog.rebex.net/beware-pressing-cancel-on-windows-firewall-security-alert)、[Ditto 安装脚本](https://github.com/sabrogden/Ditto/blob/master/DittoSetup/DittoSetup_10.iss)
- 笔记 / 待办：[Joplin 同步规范](https://joplinapp.org/help/dev/spec/sync)、[Joplin 锁](https://joplinapp.org/help/dev/spec/sync_lock)、[Joplin E2EE](https://joplinapp.org/help/dev/spec/e2ee)、[Obsidian Sync 安全](https://obsidian.md/help/sync/security)、[Remotely Save v3 设计](https://github.com/remotely-save/remotely-save/blob/master/docs/sync_algorithm/v3/design.md)、[思源 dejavu](https://github.com/siyuan-note/dejavu)、[Logseq db-sync](https://github.com/logseq/logseq/blob/master/deps/db-sync/README.md)、[Zotero 同步](https://www.zotero.org/support/sync)
- 设置：[VS Code Settings Sync](https://code.visualstudio.com/docs/configure/settings-sync)、[userDataSync 源码](https://github.com/microsoft/vscode/tree/main/src/vs/platform/userDataSync/common)、[Cherry Studio WebDAV](https://github.com/CherryHQ/cherry-studio/blob/main/docs/website/content/pre-basic/data-settings/webdav.md)、[uTools 数据库](https://github.com/uTools-Labs/utools-docs/blob/HEAD/docs/developer/db.md)、[Raycast Cloud Sync](https://manual.raycast.com/cloud-sync)
- 剪贴板：[SyncClipboard](https://github.com/Jeric-X/SyncClipboard)、[TieZ E2E 加密说明](https://github.com/jimuzhe/tiez-clipboard/blob/main/docs/E2E-ENCRYPTION.md)、[QuickClipboard webdav_sync](https://github.com/mosheng1/QuickClipboard/tree/main/src-tauri/src/services/webdav_sync)、[EcoPaste](https://github.com/EcoPasteHub/EcoPaste)
- 加密与库：[OWASP 口令存储](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[age 规范](https://github.com/C2SP/C2SP/blob/main/age.md)、[HLC 论文](https://cse.buffalo.edu/tech-reports/2014-04.pdf)；crates.io（2026-11-15）：[argon2](https://crates.io/crates/argon2)、[chacha20poly1305](https://crates.io/crates/chacha20poly1305)、[keyring](https://crates.io/crates/keyring)、[uhlc](https://crates.io/crates/uhlc)、[reqwest_dav](https://github.com/niuhuan/reqwest_dav)、[OpenDAL](https://github.com/apache/opendal)、[mdns-sd](https://github.com/keepsimple1/mdns-sd)、[rcgen](https://github.com/rustls/rcgen)、[spake2](https://crates.io/crates/spake2)
