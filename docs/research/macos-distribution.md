# macOS 版的打包、签名、分发与更新

> 日期：2026-11-13。问题：浮屿要正式发布 Mac 版（用户自己在 Mac 上用，也对外发布），打包、签名、公证、分发、自动更新和 CI 各要做什么、花多少钱、有哪些坑；现有 Windows 发布流程要改哪里。范围：Apple Developer 官方文档（会员、Developer ID 证书、Hardened Runtime、公证）与开发者论坛，Tauri 2 官方文档（macOS 签名、配置参考、updater 插件、WebView 版本、分发）和 `tauri-apps/plugins-workspace` 里 updater 的源码，`tauri-apps/tauri-action` README，GitHub Actions runner 文档与 changelog，Homebrew 官方文档与 5.0 / 6.0 发布公告，几家科技媒体对 macOS 26 / Intel 和 macOS 15 Gatekeeper 变化的报道；GitHub 上看了三个公开的 Tauri 2 应用的 Release 工作流（readest、clash-verge-rev、EcoPaste）。关键词：tauri macos code signing、notarytool、hardened runtime entitlements、darwin-universal latest.json、tauri-action universal-apple-darwin、macos-26-intel runner、homebrew cask gatekeeper、macOS Tahoe last Intel、Sequoia Open Anyway、TCC cdhash ad-hoc。仓库内读了 `docs/features/updater.md`、`docs/research/release-pipeline.md`、`.github/workflows/`、`scripts/release/`、`src-tauri/tauri.conf.json`。相关任务：G1（macOS 适配，计划见 [macos-port-plan.md](../architecture/macos-port-plan.md)）

## 结论

### 推荐方案

| 项目 | 推荐 | 理由（详见下文） |
|---|---|---|
| 账号 | Apple Developer Program **个人**账号 | 99 美元/年；个人账号就能建 Developer ID Application 证书、做公证。组织账号要 D-U-N-S、法人实体、公司域名邮箱和网站，现在没必要 |
| 签名 | Developer ID Application 证书 + hardened runtime（Tauri 默认开）+ 公证 + staple | 不公证的话，macOS 15 起用户只能去「系统设置 → 隐私与安全性」点「仍要打开」再输管理员密码，对外发布体验太差；Homebrew 官方仓库也已不接收过不了 Gatekeeper 的 cask |
| 公证凭据 | App Store Connect API key（`.p8`） | 不依赖个人 Apple ID 密码，CI 里更稳；Tauri 原生支持 `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_PATH` |
| 包格式 | `.dmg`（给人下载）+ `.app.tar.gz` 与 `.sig`（给 updater） | Tauri 直接产出；dmg 能 staple |
| 架构 | **只发 aarch64**，或一个 universal 包；不推荐分别发两套 | Apple 已宣布 macOS 26 是最后支持 Intel 的版本；Homebrew 2026-09 起把 Intel 降为 Tier 3。浮屿是新上 Mac，Intel 用户少，但 universal 几乎零额外工作（推测：主要代价是包体积约翻倍、CI 编译时间约翻倍），可以先出 universal，等 Intel 出问题时再砍 |
| 最低系统 | `minimumSystemVersion` 设为 **13.0**（Ventura）左右，最终取决于用到的原生 API | Tauri 默认写 10.13，但那只是 Info.plist 字段，不代表真能在旧系统上跑；没有能力在旧系统上测，写高一点更诚实。具体版本属于推测，见「最低系统版本」 |
| 渠道 | GitHub Release（主）+ 自建 Homebrew tap（次） | Mac App Store 基本不可行（沙盒禁止辅助功能 API）；官方 homebrew-cask 要有知名度，等用户多了再申请 |
| 自动更新 | 沿用现在的 `latest.json` + minisign 签名，加 `darwin-aarch64`（和 `darwin-x86_64`）条目 | updater 插件在 macOS 上会先找 `darwin-aarch64-app` 再找 `darwin-aarch64`，**不会**自动退回 `darwin-universal`；出 universal 包时把同一个包写进两个键 |
| CI | GitHub Actions `macos-26`（arm64）runner 构建、签名、公证，结果上传到同一个 Release 草稿 | 公开仓库的标准 runner 免费不限时；Mac 的签名公证只能在 macOS 上做，Windows 发布机做不了 |

### 费用（2026-11-13 查询）

- Apple Developer Program：**99 美元 / 会员年**，不同地区按本地货币显示（[Apple](https://developer.apple.com/programs/enroll/)）。人民币价格常见说法是 688 元/年，本次没在 Apple 官方页面上看到人民币数字，**未核实**。
- GitHub Actions：公开仓库用标准 GitHub-hosted runner 免费不限量（[GitHub 文档](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)），macOS runner 也算在内。
- Homebrew 自建 tap：免费（一个 GitHub 仓库）。
- 合计：每年约 99 美元，其它为 0。

### 用户本人必须做的事（代理做不了）

1. 用开了双重认证的 Apple ID 以**个人**身份加入 Apple Developer Program，用真实姓名（Apple 会核实姓名、邮箱、电话、地址），付 99 美元。
2. 在 Mac 上生成 CSR，在开发者网站建 **Developer ID Application** 证书（只有 Account Holder 能建，最多 5 个），装进钥匙串，再导出 `.p12` 并设导出密码。
3. 在 App Store Connect →「用户和访问」→「集成」→「密钥」建一个 API key，记下 Issuer ID、Key ID，下载 `.p8`（**只能下载一次**）。
4. 把 `.p12`（base64）、导出密码、签名身份名、`.p8` 内容、Issuer ID、Key ID 放进仓库 Secrets（或建一个 `release` environment 并设审批）。现有的 updater 私钥三项（`TAURI_SIGNING_PRIVATE_KEY` 等）也要放进 Secrets，因为 Mac 包要在 CI 里签 updater 签名。
5. 决定下面「需要拍板」的几个问题。

### 只自用 vs 对外发布：最少要做什么

**只自用（不买账号）：**

- 在自己的 Mac 上 `pnpm tauri build`，Tauri 默认会做 ad-hoc 签名（`signingIdentity: "-"`，[Tauri](https://v2.tauri.app/distribute/sign/macos/)）。自己本机编出来的 `.app` 没有 quarantine 属性，直接能打开；从网上下载的才要走「仍要打开」。
- **最大的坑**：ad-hoc 签名的「身份」是二进制的 cdhash，每次重编都会变，系统按签名记的辅助功能、屏幕录制等授权会**悄悄失效**（设置里看着还开着，实际调用失败），每次更新都得去设置里删掉重加（[来源](https://nickboy-github-io.pages.dev/posts/tcc-cdhash-trap/)、[OpenClaw 文档](https://docs.openclaw.ai/platforms/mac/signing)，二手来源，机制属于推测但多方一致）。缓解办法：在钥匙串里建一张**自签名代码签名证书**，固定用它签，授权就能跨版本保留；它过不了 Gatekeeper，但自用无所谓。
- 应用内自动更新可以用（minisign 签名与 Apple 签名无关），但每次更新后授权会按上一条失效，除非用自签名证书。

**对外发布（最少）：**

1. 个人开发者账号 + Developer ID Application 证书。
2. hardened runtime（Tauri 默认 `hardenedRuntime: true`）+ 一份最小 entitlements + Info.plist 里的用途说明。
3. 公证并 staple（Tauri 设好环境变量后在 `tauri build` 里自动做）。
4. `.dmg` 放 GitHub Release，`latest.json` 加 macOS 条目。
5. 一个 macOS 的 CI job 出包。

不公证就对外发：能发，但每个用户都要「仍要打开」+ 管理员密码，很多人会以为是病毒；进不了官方 Homebrew；自建 tap 的用户也会卡在 Gatekeeper 上（Homebrew 已废弃 `--no-quarantine`，见下文）。**不推荐**。

### 需要拍板的问题

1. 现在就买 99 美元的个人账号，还是先自用一段时间（用自签名证书）再买？
2. Intel：出 universal 包，还是只发 Apple Silicon？
3. 最低系统版本定在哪（建议 13.0，或更激进的 14.0）？
4. Mac 包在 CI 里出、Windows 包继续在本机出，还是把整个发布搬到 GitHub Actions？（见「对现有流程的改动」）
5. Windows 和 Mac 是否必须同版本同时发布？如果允许 Mac 落后，就需要给 Mac 单独一份清单（见「自动更新」的坑）。

## 详细

### 1. Apple Developer Program

事实：

- 99 美元/会员年，按地区显示本地货币；非营利、教育机构、政府可申请免费（[Apple Enroll](https://developer.apple.com/programs/enroll/)，2026-11-13 查询）。
- **个人**：本人或一人公司；要双重认证、成年、用法定姓名；卖家名显示为本人姓名（同上）。
- **组织**：必须是能和 Apple 签合同的法人实体（不收个体商号、分支机构）；要 D-U-N-S 编号、公司域名邮箱、正常运作的公司网站；报名人要有代表公司签约的权限；卖家名显示为公司名（同上）。
- 免费 Apple 账号只能在 Xcode 里用 Personal Team 在自己设备上测，**不能公证**，也拿不到证书管理（[Apple 会员对比](https://developer.apple.com/support/compare-memberships/)、[Tauri](https://v2.tauri.app/distribute/sign/macos/)）。
- Developer ID Application 证书只能由 Account Holder 建，Application 和 Installer 各最多 5 个（[Apple](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)）。
- 证书过期后：签名时证书有效的 app 仍能下载运行，但新版本要用新证书签；**证书被吊销则已装的也打不开**；会员到期后已签的 app 照常运行，只是要续费才能拿新证书（同上）。证书的有效期这页没写，常见说法是 5 年，**未核实**。

分析：浮屿是个人项目，个人账号足够。将来要以公司名义发布、或多人共同管理证书，再考虑组织账号（要先办 D-U-N-S，周期未核实）。

### 2. 不买账号时：ad-hoc 签名与用户手动放行

事实：

- Apple Silicon 上所有可执行代码都必须有签名，Tauri 可用 `"signingIdentity": "-"` 做 ad-hoc 签名，但这不能免去用户在「隐私与安全性」里放行（[Tauri](https://v2.tauri.app/distribute/sign/macos/)）。
- macOS 15 Sequoia 起，**按住 Control 点「打开」不再能绕过 Gatekeeper**；要先打开一次被拦下，再去「系统设置 → 隐私与安全性」底部点「仍要打开」，确认并输入管理员密码，只需第一次（[iDownloadBlog](https://www.idownloadblog.com/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/)、[landian.news](https://landian.news/article/3009.html)）。
- 另一条常见做法是 `xattr -d com.apple.quarantine`（[Homebrew 5.0 公告](https://brew.sh/2025/11/12/homebrew-5.0.0) 提到它作为 cask 被禁用前的临时办法），对普通用户门槛太高。
- TCC 授权跟 ad-hoc 的 cdhash 绑定，重编即失效；自签名证书可以让授权跨版本保留（见结论里的来源，二手）。

分析：自用完全可行，建议用自签名证书而不是 `-`。对外只用 ad-hoc 的项目确实存在（例如 EcoPaste 的工作流里没有 Apple 签名变量，见「参考项目」），但浮屿要请求辅助功能、屏幕录制等多个权限，授权每次更新都失效会非常伤体验。

### 3. 签名、公证、hardened runtime 与 entitlements

**Tauri 的配置**（[Tauri macOS 签名](https://v2.tauri.app/distribute/sign/macos/)、[配置参考](https://v2.tauri.app/reference/config/)）：

- `bundle.macOS.signingIdentity` 或环境变量 `APPLE_SIGNING_IDENTITY`；CI 里用 `APPLE_CERTIFICATE`（`.p12` 的 base64）和 `APPLE_CERTIFICATE_PASSWORD`。
- `bundle.macOS.hardenedRuntime` 默认 `true`；`entitlements` 指向一个 plist；`infoPlist` 可合并自定义 Info.plist（Tauri 也会自动找配置文件同目录的 `Info.plist`）；`minimumSystemVersion` 默认 `"10.13"`。
- 公证二选一：
  - API key：`APPLE_API_ISSUER`、`APPLE_API_KEY`（Key ID）、`APPLE_API_KEY_PATH`（`.p8` 路径，CI 里要先把 Secret 写成文件）。
  - Apple ID：`APPLE_ID`、`APPLE_PASSWORD`（应用专用密码）、`APPLE_TEAM_ID`。
- 设好后 `tauri build` 会签名并公证；`--skip-stapling` 可跳过 staple。用 Developer ID 证书时公证是必须的。
- Tauri 官方 CI 示例自己建临时钥匙串导入 `.p12`，再把身份传给 tauri-action；示例 grep 的是 "Apple Development"，发 Developer ID 时要改成 "Developer ID Application"（同上）。readest 和 clash-verge-rev 则只把 `APPLE_CERTIFICATE` 等变量传给 tauri-action，没有手写导入步骤（见「参考项目」）。

**notarytool 与 staple**：`notarytool` 支持 App Store Connect API key（`.p8` + Key ID + Issuer ID）和 Apple ID + 应用专用密码两种认证；staple 能钉在 `.app`、`.dmg`、`.pkg` 上，`.zip` 不能（[Apple：Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)；本次抓取只拿到页面标题，细节来自对该文档的已有了解，**以官方页面为准**）。推荐 API key：不用个人密码，Apple ID 改密码或双重认证变化不会弄坏 CI。

**entitlements（浮屿可能用到的）**：

| 能力 | 需要 entitlement 吗 | Info.plist 用途说明 | 说明 |
|---|---|---|---|
| 辅助功能（读写别的 app 的 UI、模拟按键） | 不需要（非沙盒） | 无专用键 | 授权靠用户在「隐私与安全性 → 辅助功能」勾选，代码用 `AXIsProcessTrustedWithOptions` 提示；与签名身份绑定（推测，基于 TCC 的一般机制与上面的 cdhash 坑） |
| 屏幕录制（截图功能） | 不需要 | 无必填键 | 用户在「屏幕与系统录音」里授权（推测，未在官方文档核实） |
| Apple Events / 自动化（控制「音乐」等） | **需要** `com.apple.security.automation.apple-events` | `NSAppleEventsUsageDescription` | 开 hardened runtime 后不加就发不出 Apple Events；每个目标 app 用户单独批准 |
| 摄像头 / 麦克风**真正使用** | 需要 `com.apple.security.device.camera` / `audio-input` | `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` | hardened runtime 下缺 entitlement 会被系统直接终止 |
| 摄像头 / 麦克风**只检测是否被别的程序占用** | 推测**不需要** | 推测不需要 | 常见做法是读 CoreAudio 的 `kAudioDevicePropertyDeviceIsRunningSomewhere` 和 CoreMediaIO 的 `kCMIODevicePropertyDeviceIsRunningSomewhere`，这类工具（OverSight、Micro Snitch）不需打开设备；但「不需要 TCC 授权」这一点**未核实**，要在干净账户上实测 |
| WebView JIT | Tauri 一般不需要额外 runtime exception | — | WKWebView 的 JIT 在 WebContent 进程里，宿主不需要 `allow-jit`（推测；Tauri 官方签名页没提 entitlements） |

上表 entitlement 名称和「hardened runtime 下缺 entitlement 会被终止」来自 Apple 的 [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime) 文档（本次抓取只拿到标题，内容来自对该文档的已有了解，**以官方页面为准**）。原则：只加用到的，别加 `disable-library-validation` 这类削弱保护的例外。

### 4. 包格式与架构

事实：

- Tauri 在 macOS 上出 `.app` 和 `.dmg`；开 `createUpdaterArtifacts` 后另出 `.app.tar.gz` 和 `.app.tar.gz.sig`，放在 `target/release/bundle/macos/`（[Tauri updater](https://v2.tauri.app/plugin/updater/)）。
- Apple 在 WWDC 2025 宣布 macOS 26 Tahoe 是最后一个支持 Intel Mac 的大版本，之后 Intel 只再拿一段时间安全更新（[9to5Mac](https://9to5mac.com/2025/06/09/apple-will-end-support-for-intel-macs/)、[heise](https://heise.de/-10438678)、[Daring Fireball](https://daringfireball.net/linked/2025/06/11/macos-26-intel-support)）。Homebrew 6.0 公告写的是 macOS 27 不再支持 Intel；Homebrew 自己 2026-09 把 macOS Intel 降为 Tier 3（不再有 CI、不再出 bottle），2027-09 完全移除（[Homebrew 6.0.0](https://brew.sh/2026/06/11/homebrew-6.0.0/)）。安全更新到哪年结束，**未核实**。
- tauri-action README 的示例是 `aarch64-apple-darwin` 和 `x86_64-apple-darwin` 两个矩阵项分开出（[tauri-action](https://github.com/tauri-apps/tauri-action)）；readest 用 `--target universal-apple-darwin` 出一个 universal 包（[readest release.yml](https://github.com/readest/readest/blob/main/.github/workflows/release.yml)）。

分析：

- 新做的 Mac 版，用户绝大多数在 Apple Silicon。universal 包的好处是只有一个下载链接、一个 dmg，用户不会下错；代价是体积约翻倍（推测，两份原生代码，前端资源只有一份）。分开发两套则下载页要让用户自己选架构。
- 推荐：先出 universal（或只出 aarch64），不出两套。Intel 上 WebKit 和 macOS 26 都还能用，但我们没有 Intel 机器可测，出了问题也修不了——这点值得用户拍板。

### 5. 最低系统版本

事实：

- Tauri 的 `minimumSystemVersion` 默认 `"10.13"`，写进 `LSMinimumSystemVersion`（[Tauri 配置参考](https://v2.tauri.app/reference/config/)）。
- Tauri 用系统自带的 WKWebView，WebKit 版本跟着 macOS 走，不支持的旧系统不再收到 WebKit 更新（[Tauri WebView 版本](https://v2.tauri.app/reference/webview-versions/)）。例：macOS 13.0 的 Safari 16.1，macOS 14 对应 Safari 17。
- Tauri 2 官方文档里没找到明确的「最低 macOS 版本」，**未核实**。

分析（推测）：

- 前端用了 React 19 和较新的 CSS，WebKit 太老会出现样式问题。13.0（Safari 16）以上对现代 CSS（`:has()`、容器查询等）支持比较完整。
- 原生侧要用的 API（ScreenCaptureKit 做截图要 12.3+，部分新接口要 14+）也会推高下限。
- 建议先定 13.0，等确定了截图、媒体控制等原生实现再按实际 API 调整；没有旧系统测试机，不要写比实测更低的版本。

### 6. Tauri updater 在 macOS 上

事实（来自 [updater 文档](https://v2.tauri.app/plugin/updater/)和 [plugins-workspace 源码 `updater.rs`](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/updater/src/updater.rs)，2026-11-13 读的 `v2` 分支）：

- 平台键是 `{os}-{arch}`，macOS 的 os 是 `darwin`，arch 是 `aarch64` 或 `x86_64`。客户端先找 `darwin-aarch64-app` 再找 `darwin-aarch64`；**没有 `darwin-universal` 回退**。只有在代码里用 `UpdaterBuilder::target("darwin-universal")` 自定义 target 时才会读那个键（且只读那一个）。所以出 universal 包时，`latest.json` 里把它同时写进 `darwin-aarch64` 和 `darwin-x86_64`。
- **静态 JSON 整份校验**：每个平台条目都要合法，才会比较版本（updater 文档）。
- 安装过程：把 `.app.tar.gz` 解到和 app 同一卷上的临时目录，用 `renamex_np(RENAME_SWAP)` 原子交换新旧 `.app`；交换或重命名报 `PermissionDenied` 时，才用 AppleScript `with administrator privileges` 弹管理员密码框提权后重做；失败时把旧版本放回原处或放到家目录 `<名字> (previous version).app`；最后 `touch` 让 Finder 刷新。
- 因此：装在 `/Applications` 且当前用户是管理员（这个目录对 admin 组可写）时一般不用输密码；**标准用户**或 app 归属别的用户时会弹密码框（推测，基于 `/Applications` 的默认权限和上面的提权逻辑）。装在 `~/Applications` 永远不需要提权。临时目录和 app 不在同一卷时（比如 app 在外接盘）会退到 app 的父目录做临时目录，都不行就报 `TempDirNotOnSameMountPoint`。
- 安装后要不要重启由应用决定（文档），我们现有流程装完后重启岛屿。`plugins.updater.windows.installMode` 只对 Windows 有效。

坑和分析：

- **macOS 条目缺失 = Mac 用户检查更新报错**。如果某次只发了 Windows，`latest.json` 没有 darwin 键，Mac 客户端会报 `TargetsNotFound`（面板显示失败原因）。所以要么每次两个平台一起发，要么让 Mac 客户端读一份单独的清单（例如自定义 target 或另一个端点）。
- 版本号两个平台必须一致，因为清单只有一个 `version`。
- updater 下载的 `.app.tar.gz` 由我们自己的进程下载，一般不会带 quarantine 属性（推测，未核实），但新版本本身仍要签名公证，否则下次从 Finder 打开或 Gatekeeper 复查时可能被拦。
- 现在的系统代理读取（`src-tauri/src/system/updater.rs`）读的是 Windows 注册表，macOS 要另写（读 `scutil --proxy` 或 SystemConfiguration），属于移植工作，不在本文范围。

### 7. 分发渠道

**GitHub Release（主渠道）**：放 `.dmg`、`.app.tar.gz`、`.sig`，和 Windows 包同一个 Release、同一份 `latest.json`。现有的镜像端点（ghfast.top、gh-proxy.com）对 Mac 一样有效。

**Homebrew cask**：

- 官方 homebrew-cask：Homebrew 5.0（2025-11）把过不了 Gatekeeper 的 cask 标为废弃，并宣布 2026-09 禁用；同时废弃 `--no-quarantine`（[Homebrew 5.0.0](https://brew.sh/2025/11/12/homebrew-5.0.0)）。6.0（2026-06）重申仍按 2026-09 禁用（[Homebrew 6.0.0](https://brew.sh/2026/06/11/homebrew-6.0.0/)）。是否已实际执行，本次没查到确认，**未核实**。总之**不签名公证就进不了官方仓库**。
- 收录条件（[Acceptable Casks](https://docs.brew.sh/Acceptable-Casks)）：下载必须来自开发者或其认可的渠道；可执行文件要过 Homebrew 的 Gatekeeper 检查；没有写死 star 数门槛，但仓库只用来放二进制时通用的知名度指标可能不够，最近的 app 要有「大量、可独立核实的公众关注和多人请求」，且不保证收录；beta 用 `@beta` 这类单独 token。自己提交的门槛是否更高，**未核实**。
- **自建 tap**：建一个 `TixXin/homebrew-tap` 仓库，放 `Casks/fuyu.rb`，用户 `brew install --cask tixxin/tap/fuyu`。Homebrew 6.0 起第三方 tap 要先显式信任才会执行（`brew trust` 等，同上），安装说明里要写这一步。cask 里应写 `auto_updates true`（app 自带更新），这样 `brew upgrade` 不会和应用内更新打架（`auto_updates` 的语义本次没在官方页读到，属于已有了解，**以 Cask Cookbook 为准**）。每次发版要更新 tap 里的版本号和 sha256，可在发布脚本里自动提交。

**Mac App Store**：基本不可行。

- 上架必须开 App Sandbox。Apple DTS 在开发者论坛的回答是：通过辅助功能 API 检查或控制别的 app 的程序与沙盒不兼容，不能上架，应走 Developer ID 直接分发；沙盒里可以做事件监听、输入监控，但创建 `AXUIElement` 不行（[论坛 756130](https://developer.apple.com/forums/thread/756130)、[论坛 707680](https://developer.apple.com/forums/thread/707680)）。
- 浮屿的悬浮岛、剪贴板粘贴（模拟按键也被拒过，[论坛 820594](https://developer.apple.com/forums/thread/820594)）、读取其他 app 状态、AI 代理钩子（写别的程序的配置）、自带更新器等都和沙盒或审核规则冲突。另外 App Store 版本不能自带更新器（推测，基于审核规则的一般了解，未核实具体条款）。
- 结论：不考虑 App Store。

### 8. CI：GitHub Actions macOS runner

事实（[GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)，2026-11-13 查询）：

| 标签 | 架构 | 配置 |
|---|---|---|
| `macos-latest` / `macos-26` / `macos-15` / `xcode-27` | arm64（M1） | 3 核 / 7 GB |
| `macos-26-intel` / `macos-15-intel` | Intel | 4 核 / 14 GB |

- 公开仓库用标准 runner **免费且不限量**（同上）。
- `macos-latest` 目前指向 macOS 26 arm64（同上）。macOS 26 runner 2026-02-26 正式可用，含 `macos-26`（arm64）、`macos-26-intel`、`-large`（x64）和 `-xlarge`（arm64）（[GitHub changelog](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/)）。macOS 14 镜像已宣布下线（同一页列出的公告标题，细节未读）。
- 交叉编译：在 arm64 runner 上加 `x86_64-apple-darwin` target 就能编 Intel 和 universal（readest、clash-verge-rev 都在 `macos-latest` 上编两种架构），不需要 Intel runner。

签名公证的标准做法：

1. Secrets：`APPLE_CERTIFICATE`（`.p12` base64）、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`（例如 `Developer ID Application: <姓名> (<TEAMID>)`）、`APPLE_API_ISSUER`、`APPLE_API_KEY`、`APPLE_API_KEY_P8`（`.p8` 内容，步骤里写成文件后导出 `APPLE_API_KEY_PATH`）、`KEYCHAIN_PASSWORD`，以及 updater 的 `TAURI_SIGNING_PRIVATE_KEY`、`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
2. 建议把这些放进一个 GitHub **environment**（如 `release`），只允许发布工作流使用，并要求人工批准，避免 PR 工作流拿到密钥。
3. 用 `tauri-apps/tauri-action@v1`（[README](https://github.com/tauri-apps/tauri-action)）或直接跑 `pnpm tauri build`；tauri-action 能自动建 Release、上传产物和 `latest.json`（`uploadUpdaterJson` 默认 true），但它生成的 `latest.json` 会和我们自己的 `make-latest-json.mjs` 冲突，**建议不用 tauri-action 的上传**，只用它（或直接 `tauri build`）出包，上传仍由我们的脚本做。
4. 可加 `actions/attest-build-provenance` 给 dmg 出来源证明（readest、clash-verge-rev 都这么做）。

### 9. 参考项目（2026-11-13 读的 Release 工作流）

| 项目 | 架构 | Apple 签名 / 公证 | 公证凭据 | 备注 |
|---|---|---|---|---|
| [readest](https://github.com/readest/readest/blob/main/.github/workflows/release.yml) | universal（`--target universal-apple-darwin`） | 有 | Apple ID（`APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID`） | `macos-latest`；用 `tauri.macos-nonestore.conf.json` 叠加直发版本的 entitlements；tauri-action 固定到提交 SHA，`retryAttempts: 2`；对 dmg 和 updater 包做来源证明 |
| [clash-verge-rev](https://github.com/clash-verge-rev/clash-verge-rev/blob/dev/.github/workflows/release.yml) | aarch64 与 x86_64 分开 | 有 | Apple ID | `macos-latest`；`tauri-action@v1.0.0`；对 dmg 做来源证明 |
| [EcoPaste](https://github.com/EcoPasteHub/EcoPaste/blob/master/.github/workflows/release.yml)（剪贴板工具，与浮屿功能接近） | aarch64 与 x86_64 分开 | 工作流里**没有** Apple 签名变量 | — | 只传 updater 私钥；可见不少开源 Tauri 工具对外发未公证的包 |

观察：三家都在 `macos-latest` 上编，都靠 tauri-action 把签名公证交给 Tauri；两家用 Apple ID 而不是 API key（Apple ID 方案配置更少）。

### 10. 对现有发布流程的改动清单

现状：`pnpm release`（`scripts/release/release.mjs`）在 Windows 本机跑，构建 NSIS + MSI，生成 `latest.json`，建 Release 草稿、上传、核对 SHA-256、触发 Windows 冒烟测试、公开、刷新 beta 通道、读回两个通道核对。Mac 的签名公证只能在 macOS 上做，所以至少要一台 Mac 或 CI 的 macOS runner 参与。

推荐的流程（草稿汇合）：Windows 本机照旧出包并建草稿 → 触发 macOS 工作流，往**同一个草稿**上传 Mac 产物 → 本机合并 `latest.json` → 两个平台的冒烟测试都过了才公开。

逐个文件：

- `src-tauri/tauri.conf.json`：加 `bundle.macOS`（`minimumSystemVersion`、`entitlements`、可选 `signingIdentity` 留空走环境变量）；`bundle.targets: "all"` 在 macOS 上会出 `app` 和 `dmg`，可以保留或改成按平台指定；`icons/icon.icns` 已经在 `bundle.icon` 里。新增 `src-tauri/Entitlements.plist` 和合并用的 `src-tauri/Info.plist`（用途说明文案，含中英文的话要用 `InfoPlist.strings`，属于移植工作）。
- `scripts/release/release.mjs`：
  - 现在写死 `--bundles nsis,msi`、找 `_x64-setup.exe` 和 MSI，要按平台分支，或拆成「建草稿」和「往草稿加平台产物」两步。
  - 公开前要等 macOS 工作流完成，并核对 Mac 产物的 SHA-256。
  - `installLocally()`（把 exe 放到 `target/release`、改桌面快捷方式）和 `build-exe.mjs` 是 Windows 专用；在 Mac 上要么跳过，要么换成把 `.app` 放进 `~/Applications`。
  - `SHA256SUMS.txt` 要包含 dmg。
- `scripts/release/make-latest-json.mjs`：现在只读 `bundle/nsis` 和 `bundle/msi`，写 `windows-*` 三个键，缺 MSI 就退出。要加读 Mac 的 `.app.tar.gz` 与 `.sig`，写 `darwin-aarch64`（及 `darwin-x86_64`，universal 时两键同一个包）；或者加一个「合并」模式，把 CI 上传的 Mac 片段并进本机生成的清单。注意整份清单会被整体校验，Mac 条目里的签名必须是真实的 `.sig` 内容。
- `scripts/release/release-signing.mjs`：本机签名凭据靠 Windows DPAPI，非 Windows 直接报错要求三个环境变量。CI 用 Secrets 没问题；如果用户想在自己的 Mac 上本机发布，要另写一套（例如从 macOS 钥匙串读，`security find-generic-password`）。
- `scripts/release/prepare-release-config.mjs`：可以顺便写入 macOS 相关覆盖（例如只在发布构建里加 `signingIdentity`），保持普通 `tauri build` 不要求证书。
- `scripts/release/smoke-test.mjs` / `smoke-test.ps1` 与 `.github/workflows/release-smoke.yml`：现在只装 `*_x64-setup.exe`。加一个 macOS 冒烟 job：下载草稿里的 dmg，`hdiutil attach`，拷到临时目录，`spctl -a -vv` 和 `stapler validate` 检查公证，启动后确认进程活着，再退出。辅助功能等授权在 runner 上无法给，冒烟只能验证「能启动、签名公证有效」。
- `scripts/release/after-release.mjs`（`verifyChannels` 等）：读回 `latest.json` 时同时核对 darwin 键存在、版本正确。
- `scripts/release/channel.mjs`：`beta-channel` 的清单刷新逻辑不变，但清单内容要包含 Mac 条目。
- `.github/workflows/`：新增 `release-macos.yml`（`workflow_dispatch`，输入 tag；`runs-on: macos-26`；装 Rust 的 `aarch64-apple-darwin` 与 `x86_64-apple-darwin`；`pnpm tauri build --target universal-apple-darwin --config src-tauri/tauri.release.conf.json`；带签名公证环境变量；`gh release upload` 到草稿），密钥放在受保护的 environment 里。`ci.yml` 现在只在 `windows-latest` 跑前端检查，Mac 版开发起来后至少加一个 `macos-latest` 的 `cargo check` / `cargo test`，否则 Windows 专用代码（`src-tauri/src/win32/`）的 cfg 隔离漏了也发现不了。
- `docs/features/updater.md`：补 macOS 部分（平台键、提权行为、发布步骤、密钥位置）。
- 新增 Homebrew tap 仓库（仓库外），以及发布后自动更新 cask 版本与 sha256 的步骤。

## 来源

- Apple：[Apple Developer Program 报名](https://developer.apple.com/programs/enroll/)、[会员对比](https://developer.apple.com/support/compare-memberships/)、[创建 Developer ID 证书](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/)、[Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime)、[Customizing the notarization workflow](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)、[费用减免](https://developer.apple.com/cn/support/membership-fee-waiver/)
- Apple 开发者论坛：[沙盒 app 能否拿辅助功能权限 756130](https://developer.apple.com/forums/thread/756130)、[Accessibility permission in sandboxed app 707680](https://developer.apple.com/forums/thread/707680)、[剪贴板管理器因 CGEvent.post 被拒 820594](https://developer.apple.com/forums/thread/820594)、[检测麦克风是否被使用 741026](https://developer.apple.com/forums/thread/741026)、[kCMIODevicePropertyDeviceIsRunningSomewhere 697124](https://developer.apple.com/forums/thread/697124)
- Tauri：[macOS 签名](https://v2.tauri.app/distribute/sign/macos/)、[配置参考](https://v2.tauri.app/reference/config/)、[Updater 插件](https://v2.tauri.app/plugin/updater/)、[WebView 版本](https://v2.tauri.app/reference/webview-versions/)、[分发](https://v2.tauri.app/distribute/)、[updater.rs 源码](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/updater/src/updater.rs)、[tauri-action](https://github.com/tauri-apps/tauri-action)
- GitHub：[GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)、[macOS 26 runner 正式可用](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/)
- Homebrew：[5.0.0 公告](https://brew.sh/2025/11/12/homebrew-5.0.0)、[6.0.0 公告](https://brew.sh/2026/06/11/homebrew-6.0.0/)、[Acceptable Casks](https://docs.brew.sh/Acceptable-Casks)
- macOS 26 与 Intel：[9to5Mac](https://9to5mac.com/2025/06/09/apple-will-end-support-for-intel-macs/)、[heise](https://heise.de/-10438678)、[Daring Fireball](https://daringfireball.net/linked/2025/06/11/macos-26-intel-support)
- macOS 15 Gatekeeper：[iDownloadBlog](https://www.idownloadblog.com/apple-macos-sequoia-gatekeeper-change-install-unsigned-apps-mac/)、[landian.news](https://landian.news/article/3009.html)
- TCC 与 ad-hoc 签名：[tcc cdhash trap](https://nickboy-github-io.pages.dev/posts/tcc-cdhash-trap/)、[OpenClaw macOS signing](https://docs.openclaw.ai/platforms/mac/signing)
- 参考项目：[readest release.yml](https://github.com/readest/readest/blob/main/.github/workflows/release.yml)、[clash-verge-rev release.yml](https://github.com/clash-verge-rev/clash-verge-rev/blob/dev/.github/workflows/release.yml)、[EcoPaste release.yml](https://github.com/EcoPasteHub/EcoPaste/blob/master/.github/workflows/release.yml)
- 摄像头麦克风占用检测的同类工具：[OverSight](https://objective-see.org/products/oversight.html)、[Micro Snitch](https://apps.apple.com/us/app/micro-snitch/id972028355)
