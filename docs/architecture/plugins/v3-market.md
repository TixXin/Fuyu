# 插件平台第 3 版：市场索引和撤销名单

> 状态：格式和客户端校验库已实现（E36.5.2，#481），代码在 `packages/plugin-market`（`@fuyu/plugin-market`）。市场 CI（E36.5.5）和以后宿主里的市场客户端（内置插件 `market/v1`，E36.5.8）共用这一份代码。还在实验期，第 5 阶段转正前可能微调。

定下这些规则的决定见 [v3-everything-plugin.md](v3-everything-plugin.md)「第 5 阶段开头定下的细则」和「安装、市场和信任」，取舍见 [第 5 阶段地基的计划](v3-phase5-foundation-plan.md) Q2、Q5、Q6、Q8、Q9、Q10。第 2 版的做法见 [market-ops.md](market-ops.md)、[author-signing.md](author-signing.md)。

## 文件

都放在 `TixXin/fuyu-plugins` 的根目录，旁边各有一个签名文件：

| 文件 | 谁写、谁签 | 多久签一次 |
|---|---|---|
| `index.v3.json` + `index.v3.json.sig` | 市场 CI 生成，用**索引密钥**签 | 每次上架、每天至少一次（内容没变也重签，换新的过期时间） |
| `revoked.v3.json` + `revoked.v3.json.sig` | 维护者在自己电脑上用 `pnpm market:revoke` 签，用**撤销密钥**签，再开 PR | 撤销或收回时 |

第 2 版的 `index.json`、`revoked.json` 冻结，只给旧版岛屿读。

## 签名

- Ed25519。签的是文件的原文，`\r\n` 先换成 `\n`（和第 2 版一样）。客户端拿下载到的原文验签，再解析 JSON，不重新序列化。
- 签名文件是 `{ "keyId", "signature" }` 或这种对象的数组（换密钥的过渡期两把各签一份），任一由可信公钥做出的有效签名即可。`keyId` 是 32 字节公钥的 SHA-256 的前 16 个十六进制字符，`signature` 是 base64。
- 公钥写法 `{ "keyId", "publicKey" }`，`publicKey` 是 32 字节原始公钥的 base64。`keyId` 和公钥对不上的条目当作不存在。
- **两种角色分开**：客户端的信任根是 `{ index: [...], revocation: [...] }`，编进 Rust（R7）。索引只认 `index` 里的密钥，撤销名单只认 `revocation` 里的密钥；同一把密钥出现在两边时，两个文件都拒绝（`bad-trust`）。这样 CI 的索引密钥泄露时，攻击者签不了撤销名单，没法大面积停用插件。

## 共同的头部

两个文件都有：

| 字段 | 说明 |
|---|---|
| `format` | 固定 `3` |
| `serial` | 非负整数，**每次签名都要变大**（CI 可以用 Unix 秒）。客户端记下见过的最大值，比它小的整个文件拒绝；相等的照常接受（同一份重新下载） |
| `generatedAt` | 签名时间，ISO 8601，带时区 |
| `expires` | 过期时间，必须晚于 `generatedAt` |

**过期**：`now >= expires`，或者 `now >= generatedAt + 上限` 都算过期。上限：索引 7 天（CI 写得再长也按 7 天算），撤销名单 90 天（撤销密钥离线，不能每天重签；撤销名单是不是最新的靠索引里的 `revokedSerial` 判断，见下文）。过期的文件仍然能打开（`status: "expired"`），由调用方决定怎么处理。

## `index.v3.json`

```json
{
  "format": 3,
  "serial": 1763164800,
  "generatedAt": "2026-11-15T00:00:00Z",
  "expires": "2026-11-22T00:00:00Z",
  "revokedSerial": 4,
  "plugins": [
    {
      "name": "@someone/weather",
      "publisher": { "github": "someone", "official": false, "verified": { "via": "github" } },
      "authorKeys": [
        { "keyId": "…", "publicKey": "…" },
        { "keyId": "…", "publicKey": "…", "endorsedBy": { "keyId": "…", "signature": "…" } }
      ],
      "versions": [
        {
          "version": "1.2.0",
          "repository": "https://github.com/someone/weather",
          "commit": "<40 位提交号>",
          "engines": { "fuyu": ">=0.4.0" },
          "platforms": ["windows", "macos"],
          "url": "https://github.com/TixXin/fuyu-plugins/releases/download/…/weather-1.2.0.fuyu",
          "sha256": "<64 位小写十六进制>",
          "size": 123456,
          "publishedAt": "2026-11-12T08:00:00Z",
          "reviewedAt": "2026-11-12T07:40:00Z",
          "urgent": { "reason": { "zh-CN": "修复会泄露令牌的问题", "en": "Fixes a token leak" } },
          "authorSignature": { "keyId": "…", "signature": "…" },
          "manifest": {
            "displayName": { "zh-CN": "天气", "en": "Weather" },
            "description": { "zh-CN": "…", "en": "…" },
            "license": "MIT",
            "categories": ["information"],
            "keywords": ["天气预报", "forecast"],
            "preview": false,
            "requires": { "@fuyu/location": "^1.0.0" },
            "nodeApis": ["https"],
            "network": ["api.open-meteo.com"],
            "inject": { "required": ["notify"], "optional": ["calendar"] },
            "provides": ["weather"],
            "replaces": [],
            "slots": ["island.page/v1"],
            "commands": [{ "id": "weather.refresh", "title": { "zh-CN": "刷新天气", "en": "Refresh weather" }, "keybinding": "Ctrl+Alt+W" }]
          },
          "icon": { "url": "https://…/icons/weather-1.2.0.png", "sha256": "…" },
          "screenshots": [{ "url": "https://…/weather-1.png", "sha256": "…", "caption": { "zh-CN": "…", "en": "…" } }],
          "docs": { "README.md": "…", "README.zh-CN.md": "…", "CHANGELOG.md": "…" }
        }
      ]
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `revokedSerial` | 否 | 当前撤销名单的 `serial`。索引每天重签，所以客户端能据此知道「本机的撤销名单落后了」（`revocationsBehind`），提示并去取新的 |
| `plugins[].name` | 是 | `@<作用域>/<名字>`，小写，最长 214 个字符。`@fuyu/*` 是官方（作用域可配置）；第三方的作用域必须是源码仓库的所有者（不区分大小写） |
| `publisher.github` | 是 | 发布者的 GitHub 账号 |
| `publisher.official` | 是 | 只有官方作用域是 `true`，其余必须是 `false` |
| `publisher.verified` | 否 | 和第 2 版一样：`{ "via": "github" }` 或 `{ "via": "domain", "domain" }` |
| `authorKeys` | 是 | 作者登记的公钥，可以带换密钥证明 `endorsedBy`（见下文）。第三方至少一把；官方插件可以是空数组 |
| `versions` | 是 | 至少一个，版本号不重复，顺序不限（客户端按 semver 排） |
| `version` | 是 | semver；带预发布标记的是预发布版 |
| `repository` | 是 | `https://github.com/<所有者>/<仓库>`。官方插件必须是 `https://github.com/TixXin/fuyu`（可配置） |
| `commit` | 是 | 完整的 40 位提交号（不是标签名：标签能被移动） |
| `engines.fuyu` | 是 | 兼容的浮屿版本范围（npm 的写法：`>=`、`^`、`~`、`x`、`||`、`a - b`） |
| `platforms` | 是 | `windows`、`macos` 的非空子集；清单没写时 CI 填两个 |
| `url`、`sha256`、`size` | 是 | 市场构建出的 `.fuyu` 的下载地址（https）、SHA-256、字节数 |
| `publishedAt` | 是 | 上架时间，CI 写。**冷静期从这里算** |
| `reviewedAt` | 是 | 维护者批准的时间 |
| `urgent` | 否 | 只有维护者能标，必须带中英文原因；岛上的更新说明里显示这个原因 |
| `authorSignature` | 第三方必填 | 作者对提交号的签名（见下文），`keyId` 必须是 `authorKeys` 里的。官方插件不能有：它的作者证明是「提交在 `TixXin/fuyu` 受保护的 `main` 上」，由 CI 核对 |
| `manifest` | 是 | 清单摘要，市场页和安装确认用。`displayName`、`description`、`license`、`nodeApis`、`network`、`inject`、`provides`、`replaces`、`slots`、`commands` 必填（列表可以为空），`categories`、`keywords`、`preview`、`requires` 可选。`keywords` 取清单顶层的 `keywords`，最多 32 个，市场搜索用（E77.6） |
| `icon` | 是 | 图标的地址和 SHA-256。图标和截图不进索引，由 CI 从包里取出放到固定地址 |
| `screenshots` | 否 | 最多 6 张，地址、SHA-256、可选的说明 |
| `docs` | 否 | 包顶层的说明和更新记录的 SHA-256：`{ "README.md": "…", "README.zh-CN.md": "…", "CHANGELOG.md": "…" }`。键是文件名（`README` 或 `CHANGELOG`，可带语言，`.md`，不分大小写不能重复），最多 16 个；值是文件原始字节的 SHA-256。详情页按它校验从源码仓库取到的文档，见下文「详情页的文档」（E77.6） |

不认识的字段一律忽略，以后只加可选字段。

### 详情页的文档

详情页的「说明」和「更新记录」不在安装包之外另存：没装的插件由宿主按版本条目的 `repository`、`commit` 从 `raw.githubusercontent.com` 取源码仓库里的 `README*.md`、`CHANGELOG.md`。

- **版本条目有 `docs`**：只取 `docs` 里列出的文件（先按界面语言挑，文件名用 `docs` 里的写法），可以走镜像；取到的字节算 SHA-256，和 `docs` 里的不一样、404、超过 1 MB 都换下一个源，所有源都不对就不显示这份文档。
- **版本条目没有 `docs`**（2026-11-19 之前上架的版本）：只从 GitHub 直连取，不走镜像，因为没有哈希就查不出镜像改过内容。
- 哈希由市场 CI 在构建后从包里算。包里的文件是从那个提交检出的，所以和 `raw.githubusercontent.com` 上的字节相同；仓库用 `.gitattributes` 把这些文件检出成另一种换行时两边对不上，文档就不显示。
- 已装的插件读本地安装目录里的文件，不联网。

### 套装：`bundles`

索引顶层可以有 `bundles`（E77.8，2026-11-19 起），把几个搭配着用的插件列成一组，市场页显示成「套装」，一次确认装好。没有这个字段的索引和这之前的岛屿都不受影响：旧岛屿忽略它。

```json
"bundles": [
  {
    "id": "pomodoro-flow",
    "displayName": { "zh-CN": "番茄工作法", "en": "Pomodoro flow" },
    "description": { "zh-CN": "番茄钟、待办进度环和每日小结", "en": "A pomodoro timer, a to-do ring and a daily digest" },
    "plugins": ["@fuyu/pomodoro", "@fuyu/todo-ring", "@fuyu/todo-digest"],
    "onboarding": true
  }
]
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | 小写字母、数字和短横线，最多 64 个字符，索引内不重复 |
| `displayName`、`description` | 是 | 中英文都要有 |
| `plugins` | 是 | 2 到 6 个插件名，都必须在这份索引的 `plugins` 里，不能重复 |
| `onboarding` | 否 | `true` 表示新手引导可以推荐它；默认不推荐 |

- 套装只由维护者合入市场仓库，随索引一起签名；第一批只收官方插件。套装不带版本、不带哈希：装的是成员各自按「选版本」规则选出的那个版本，签名和 SHA-256 校验同单个安装。
- 套装只是一张清单。装完之后每个插件各自更新、停用、卸载，本机不记录「装过哪个套装」，套装改了成员也不会替用户补装或卸载。
- 格式由 `validateIndex` 校验（`packages/plugin-market/src/bundles.mjs`）；上限和下限是 `MIN_BUNDLE_PLUGINS`、`MAX_BUNDLE_PLUGINS`。

宿主怎么用（`src/features/updater/host/marketBundles.mjs`）：

- `market/v1` 的 `catalog` / `refresh` 快照多 `bundles`：`[{ id, displayName, description, onboarding, members: [{ name, state, reason? }] }]`。`state` 是 `installed`（装着并开着）、`disabled`（装着但关了）、`available`（没装，市场有能直接装的版本）或 `unavailable`；`unavailable` 时 `reason` 是 `platform`、`engines`、`revoked`、`warned`（市场给这个版本挂了警告，要到它自己的详情里装）、`missing`（索引里没有）或 `other`。
- 成员里不是 `unavailable` 的不到 2 个时，这个套装不出现在快照里。
- `installBundle({ id })` → `{ id, installed: [{ name, version }], failed: [{ name, code, message }] }`，只应答设置窗口。按清单顺序逐个安装 `available` 的成员，装着的不动，前面的成员作为依赖顺带装上的也跳过；一个失败不影响其余的，已经装上的留着，再调一次只装还没装上的。装上至少一个之后插件只重新加载一次。套装不存在回 `not-found`，参数不对回 `bad-params`。
- 没审核的、作者密钥变了的版本没有能直接装的候选，在套装里算 `unavailable`，不会被一键装上。

## `revoked.v3.json`

```json
{
  "format": 3,
  "serial": 4,
  "generatedAt": "2026-11-15T00:00:00Z",
  "expires": "2027-02-13T00:00:00Z",
  "entries": [
    { "id": "2026-11-15-weather", "name": "@someone/weather", "version": "1.2.0", "level": "disable", "reason": { "zh-CN": "…", "en": "…" } },
    { "id": "2026-11-15-clock", "name": "@other/clock", "version": "*", "level": "warn", "reason": { "zh-CN": "…", "en": "…" } }
  ],
  "withdrawn": [
    { "id": "2026-11-15-clock", "reason": { "zh-CN": "误报", "en": "Revoked by mistake" } }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `entries[].id` | 这条撤销的编号，小写，文件里不重复。**编号一旦用过就固定**：客户端只认第一次见到的内容，之后同编号的改动（例如把 `disable` 改成 `warn`）不生效 |
| `name`、`version` | 插件名和版本；`"*"` 是所有版本 |
| `level` | `warn`：提示原因，有修复版时优先推；`disable`：停掉这个版本、不能再启用，数据保留，用户可以卸载或换到没被撤销的版本。不再有第 2 版的 `uninstall` |
| `reason` | 中英文原因，公开显示 |
| `withdrawn[]` | 收回一条撤销：`id` 必须是本文件 `entries` 里的。收回后再也不会生效；要重新撤销就用新编号 |

## 客户端的判断规则

函数都在 `@fuyu/plugin-market`，纯函数，只用 `node:crypto`。

### 打开文件：`openIndex`、`openRevoked`

按顺序：信任根两种角色有重叠 → `bad-trust`；签名文件形状不对或没有可信签名 → `bad-signature`；不是 JSON 或格式不对 → `invalid`（带每个问题的路径）；`serial` 比 `lastSerial` 小 → `older-serial`。都过了返回 `ok` 或 `expired` 和文档。

调用方的处理：

- 索引被拒：整个市场刷新失败，继续用上次的。
- 索引过期：已装的插件照常运行，**暂停自动更新和新安装**，市场页提示「市场信息过期」。
- 撤销名单取不到、被拒：不停用任何东西，只提示。过期的照样合并（合并只会加），并提示。
- 索引的 `revokedSerial` 比本机的撤销名单新：提示并重新去取。

### 撤销合并：`mergeRevoked`、`revocationOf`

- 本机保存 `{ serial, entries, withdrawn }`。新名单的 `serial` 比保存的小就不合并。
- 只增：新名单里没有的旧条目照样保留，所以旧的缓存副本、暂时取不到都不会让撤销失效。新条目按编号加进来，已有编号不变。
- 收回也只增：`withdrawn` 里的编号加进保存的收回列表，之后这条撤销不再生效。收回和撤销在同一个文件里，只有撤销密钥能签。
- `revocationOf(状态, 名字, 版本)` 返回生效的条目和最高的级别（`disable` 高于 `warn`），没有就是 `null`。

### 选版本：`selectVersions`

输入插件条目、浮屿版本、平台、现在的时间，可选已装的版本、撤销状态、是否要预发布版。先去掉：平台不符、`engines.fuyu` 不满足（**旧版浮屿因此拿到它能用的最新版**）、预发布版（除非要）、被 `disable` 的。剩下的按 semver 从新到旧：

| 返回 | 规则 |
|---|---|
| `autoUpdate` | 比已装的新、**过了 3 天冷静期或标了 `urgent`**、没有 `warn` 的最新版；没装就是 `null` |
| `manual` | 比已装的新的最新版（不管冷静期，带 `cooled` 和 `warned` 标记，确认框据此写「这个版本上架不到 3 天」或撤销提示） |
| `install` | 新安装默认装的：过了冷静期、没有 `warn` 的最新版；只有冷静期内的版本时取最新的，`fresh: true`（标「刚上架」） |
| `skipped` | 去掉的版本和原因（`platform`、`engines`、`prerelease`、`revoked`） |

冷静期从 `publishedAt` 算，正好满 3 天算过了。浮屿自己是预发布版（`0.5.0-beta.1`）时，按纯版本顺序比，所以 `>=0.5.0` 不满足、`>=0.4.0` 满足。索引过期时调用方不该用 `autoUpdate` 和 `install`。

### 作者签名：`signCommit`、`verifyCommit`、`verifyVersionSignature`

作者签的是这段文本（每段一行，`\n` 分隔，任何一段不能含换行）：

```text
fuyu-plugin-commit/1
<插件名>
<版本>
<仓库地址>
<提交号>
```

前缀防止把别的用途的签名挪过来，四个字段防止把 A 插件或旧版本的签名挪到别处。密钥沿用第 2 版的格式（Ed25519，PEM 私钥），作者已有的密钥可以继续用。

### 作者密钥固定：`checkAuthor`

本机给每个装过的插件记一个 pin：`{ keyIds, repository }`。

| 状态 | 条件 | 装吗 | 自动更新 | 确认 |
|---|---|---|---|---|
| `first` | 没有 pin（全新安装），签名有效 | 装，记下签名的密钥和仓库 | 是 | 只有安装确认 |
| `same` | 签名的密钥在 pin 里，仓库没变 | 装 | 是 | 无 |
| `rotated` | 新密钥，但从 pin 里的某把密钥起有一串有效的换密钥证明，仓库没变 | 装，pin 换成新密钥 | **否** | 一次：「作者更换了签名密钥（有旧密钥的证明）」 |
| `changed` | 新密钥没有证明，或者仓库变了 | 装，pin 换成新的 | **否** | 两次：「这个插件的作者或签名密钥已更换」 |
| `bad-signature` | 没有签名或签名无效 | **不装** | 否 | — |
| `official` | 官方插件：没有作者密钥，只 pin 仓库；仓库变了算 `changed` | 装 | 是 | 无 |

换密钥证明：旧密钥对 `fuyu-plugin-key/1\n<插件名>\n<新 keyId>\n<新公钥>` 的签名，放在新密钥条目的 `endorsedBy` 里（`endorseKey` 生成）。证明可以成链（A 证明 B、B 证明 C），只对写在里面的插件名有效。按方案「作者换密钥、换人、换仓库，一律当作重新上架」，有证明的换密钥也不自动更新，只是少一次确认。

## 和第 2 版的差别

| | 第 2 版 | 第 3 版 |
|---|---|---|
| 文件 | `index.json`、`revoked.json` | `index.v3.json`、`revoked.v3.json`，第 2 版冻结 |
| 防回放 | 没有 | `serial` 只增，旧的拒绝；索引 7 天过期 |
| 插件名 | `io.github.<用户>.<名字>` | `@<所有者>/<名字>`，作用域就是仓库所有者 |
| 包从哪来 | 作者的 Release 里的 zip | 市场从提交号构建的 `.fuyu`，索引记提交号 |
| 作者签名 | 可选，签 zip 的哈希（`focusd-plugin-package/1`） | 第三方必须签，签提交号（`fuyu-plugin-commit/1`）；官方插件靠受保护的 `main` |
| 换密钥证明 | `focusd-plugin-key/1` + 插件 id | `fuyu-plugin-key/1` + 插件名；有证明也要用户确认一次，不自动更新 |
| 密钥 pin | 只记 keyId | keyId 加仓库，换仓库也算变了 |
| 冷静期 | 没有 | 3 天，从 `publishedAt` 算，`urgent` 例外，新安装也取过了冷静期的版本 |
| 兼容的浮屿版本 | 插件的 `minAppVersion`，版本不够时显示「不兼容」 | 每个版本有 `engines.fuyu`，旧版浮屿拿到能用的最新版 |
| 撤销的签名 | 和索引同一把 CI 密钥 | 单独的撤销密钥，索引密钥签的撤销名单被拒 |
| 撤销级别 | `disable`、`uninstall` | `warn`、`disable`，不删插件目录 |
| 撤销的写法 | 一条带 `versions` 列表 | 每条一个编号和一个版本（或 `*`）；可以按编号收回 |
| 清单摘要 | 权限列表 | `nodeApis`、`network`、`inject`、`provides`、`replaces`、`slots`、`commands` 等 |
| 图标、截图 | 包里 | 索引记地址和 SHA-256 |
