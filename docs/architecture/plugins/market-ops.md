# 插件市场运维

给维护者看：官方插件怎么发版、下架名单的格式、市场索引怎么签名和下载。插件作者怎么上架见 [发布](../../plugins/publish.md)；作者签名的设计见 [author-signing.md](author-signing.md)。

## 两份索引

- **现行市场**：[`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins) 根目录的 `index.json`、`revoked.json` 和它们的签名。作者向它提 PR 新增 `plugins/<插件 id>.json`，它的 CI 每小时检查各插件仓库的新 Release，校验后重建索引并签名。
- **给旧版岛屿的副本**：本仓库的 `plugins/index.json`、`plugins/revoked.json`，只给切换到 `fuyu-plugins` 之前发布的岛屿（它们读 `main`；更早读 `dev` 的版本，2026-11-13 删掉 `dev` 分支后市场打不开，要升级岛屿），只含官方插件，由 `pnpm plugins:index` 生成。

## 官方插件

本仓库 `plugins/examples/` 里的示例插件是官方插件，发布方式不同：

1. 修改插件并提高 `version`，在本机运行 `pnpm plugins:index`（需要旧索引的签名私钥，见下文；以及官方作者密钥 `~/.tauri/fuyu/plugin-author-signing.key`，改名前的 `~/.tauri/fly-island/` 在新目录不存在时照常读，公钥在 `plugins/author-key.json`）。脚本把插件打成 `plugins/packages/<id>-<version>.zip` 并写出作者签名 `<zip>.sig`，重写并签名 `plugins/index.json` 和 `plugins/revoked.json`。文本文件打包时统一成 LF，时间戳固定，所以同一份源码每次得到同一个哈希。
2. 提交并 land。
3. 不用再去 `fuyu-plugins` 改地址：它的 CI 定时（名义上每小时，GitHub 不保证准点，2026-11 实测平均 6.7 小时一次、最长 10.9 小时）以及 `main` 有变化时读 `plugins/<id>.json` 的 `path` 里的清单，版本比 `package` 地址里的新，就改用同一文件夹里那个版本的 zip（`fuyu-plugins` 的 `scripts/lib/official.mjs`，2026-11-12 起，E20）。所以 land 之后通常几小时内市场就会更新（急的话推一次 `fuyu-plugins` 的 `main`，或手动运行它的 Update index 工作流）；作者签名照样要通过，要的权限比上一版多时会开 `review-needed` issue，等维护者在 `plugins/<id>.json` 里写 `"approved": "<版本>"`。以前要手动改地址，漏改过两次（系统监控停在 1.2.0、待办进度环停在 1.0.1，见 PR #49）。

`pnpm test` 会检查 `plugins/index.json` 和 zip 是否与示例插件的源码一致。已发布的版本不能修改，同一个版本号的包变了 `pnpm plugins:index` 会报错。

## 下架

`fuyu-plugins` 根目录的 `revoked.json` 列出被撤销的版本（本仓库的 `plugins/revoked.json` 是给旧版岛屿的副本，要同步修改）：

```json
{
  "version": 1,
  "revoked": [
    {
      "id": "dev.example.plugin",
      "versions": ["1.2.0"],
      "reason": { "zh-CN": "这个版本会删除数据", "en": "This version deletes data" },
      "action": "disable"
    }
  ]
}
```

- `versions`：`"*"` 表示所有版本，或者列出具体版本。
- `action`：`disable` 停止并禁用插件；`uninstall` 停止并删除插件目录（`plugins-data/<id>/` 保留）。
- 岛屿每次刷新市场时读取它，名单保存在 `plugins.json` 的 `revoked` 里，离线时也有效。下载到的名单只会往保存的名单里**加**条目，不会删：旧的缓存副本或者暂时读不到 `revoked.json`，都不会让已下架的版本重新可用。市场也不会把已安装的插件换成更旧的版本。
- 被撤销的版本不能启用，也不能从市场安装；插件卡片显示原因。手动放进插件目录的同 id 同版本也会被拦截，开发模式加载的插件除外。
- 它和 `index.json` 一样要签名（`fuyu-plugins` 的 CI 合并后重新签名）。没有这个文件时视为没有撤销任何版本；有文件但签名不对时，整个市场刷新失败。

## 与源码一致

2026-11-14 起（E25，TixXin/fuyu-plugins#22），`fuyu-plugins` 的 `scripts/lib/source.mjs` 在第一次提交和每次更新时下载仓库在 Release 标签处的源码，用 `fuyu-plugin pack` 打包 `path` 文件夹，和 Release 附件逐个比较文件（不比 zip 字节：不同版本的 `pack` 打出的 zip 可能不同；新版 `pack` 加的 `focusd-plugin.json` 副本不算差别）。全程只解包、打包，不运行仓库里的代码，因为索引任务里有签名密钥。

- 一致：条目加 `"sourceMatch": true`。
- 不一致：PR 检查失败；已上架插件的新版本暂缓上架，开 `review-needed` issue，`approved` 放行。
- 跳过：描述文件写了 `"buildStep": true` 的（构建产物不在仓库里），以及用固定 `package` 地址、没有标签的官方插件（由本仓库的 `plugins/index.json and plugins/packages match the plugin sources` 测试保证一致）。

第一次运行（2026-11-14）：两个第三方插件 `io.github.shenglin1001.battery` 1.0.0、`io.github.shenglin1001.timesync` 0.1.0 都一致，但 zip 字节和新版 `pack` 打出的不同，所以按文件比较。已上架的版本不会补 `sourceMatch`，下一个版本起才有。

## 索引签名

岛屿只接受签名有效的索引。索引里有每个插件包的 SHA-256，所以给索引签名，也就间接保护了插件包：即使有人能修改仓库或 CDN 上的文件，没有私钥也无法让岛屿安装被改过的插件。

- **算法**：Ed25519。签名对象是 LF 换行的 `index.json`（`revoked.json` 同理）。签名文件的格式为 `{ "keyId", "signature" }`，或者这种对象的数组（多把密钥各签一份，例如换密钥的过渡期）；数组中任一由可信公钥做出的有效签名即可通过。
- **公钥**：放在 `plugins/signing-keys.json` 中，编译时嵌入岛屿；`fuyu-plugins` 的 `keys/trusted.json` 与它一致。2026-11-14 起（E26）两边都只有 CI 密钥 `e862885af5bba3dc`。要换密钥，先把新公钥加进这个文件并发布一个新版本的岛屿。
- **私钥**：有两把。`fuyu-plugins` 的市场索引由 CI 签名（密钥 `e862885af5bba3dc`，存在该仓库 `release` 环境的 secret 里，只有 `main` 分支能用）。本仓库给旧版岛屿的 `plugins/index.json` 用较早的密钥签名：由 `pnpm plugins:keygen` 生成，保存在 `~/.tauri/fuyu/plugin-index-signing.key`（新目录不存在时读改名前的 `~/.tauri/fly-island/`），用 Windows DPAPI 加密，只有生成它的 Windows 账户能解开；也可以用环境变量 `FUYU_PLUGIN_SIGNING_KEY`（PEM 文本）提供。
- **旧密钥 `7ee2729370070df6` 不再受新版岛屿信任**（E26，用户 2026-11-14 定）。它只给本仓库的 `plugins/index.json` 签名，那份索引只有切换市场之前的旧版岛屿读，它们编译时自带这把公钥，不受影响。新版岛屿读 `fuyu-plugins`，那里只用 CI 密钥签名，所以从 `signing-keys.json` 去掉了它。它也当不了 CI 密钥的备用：私钥用 DPAPI 绑在一台 Windows 机器的一个账户上，而且 CI 密钥泄露时，有备用密钥也撤销不了泄露的那把。本仓库的测试用 `plugins/legacy-index-key.json` 校验旧索引。
- **备份私钥**：私钥丢失后，已经安装的岛屿不会接受用新密钥签名的索引，只能随新版岛屿换密钥。DPAPI 加密的文件换了电脑或账户就解不开，所以备份时要另外导出一份明文 PEM，放在安全的地方。

### 签名的 job

`fuyu-plugins` 的 `update-index.yml` 分成两个 job（E26，TixXin/fuyu-plugins#23）：构建 job 没有密钥，下载、解压、校验第三方插件包后生成 `index.json`；签名 job 是唯一挂在 `release` 环境上的，只拿到这个 `index.json`，不运行 `npm ci`（`sign.mjs` 只用 Node 自带模块），签名后提交。所有工作流的 Actions 按提交号固定。`main` 只有分支保护「禁止强推和删除」，**没有**要求经 PR 合入的规则集（用户 2026-11-14 定，先不加）：仓库在个人账户下，GitHub 只允许组织仓库把 GitHub Actions 设成规则集的绕过者，而索引、点赞、主题三个工作流都直接推 `main`，加了规则集它们会被挡住。以后要加，做法是给这三个工作流一把有写权限的部署密钥（私钥放在只有 `main` 能用的环境 secret 里），规则集只让部署密钥和管理员（只能在 PR 上）绕过；或者把仓库移到组织下。

签名防得住 CDN、镜像和传输途中的改动，防不住能往 `fuyu-plugins` 的 `main` 合入提交的人：每小时的构建没法等人批准（见 [v2-platform.md](v2-platform.md)「审查修复」）。现在有 `main` 写权限的人仍然能直接推；加上规则集后才会收窄成「能合入 PR」。

### CI 密钥泄露或丢失时

岛屿没有吊销公钥的办法：编译进去的公钥一直有效，直到用户升级。按这个顺序处理：

1. **停用旧密钥**：在 `fuyu-plugins` 的 Settings → Environments → `release` 里删掉 secret `FOCUSD_PLUGIN_SIGNING_KEY`，并暂时停用 `Update index` 工作流，免得继续用它签名。
2. **生成新密钥**：本地 `node -e` 生成一对 Ed25519 密钥（或 `pnpm plugins:keygen`），私钥 PEM 存进 `release` 环境的 secret，并离线备份一份。
3. **发新版岛屿**：把新公钥加进 `plugins/signing-keys.json`，**去掉**泄露的那把，`fuyu-plugins` 的 `keys/trusted.json` 同样改；发一个岛屿版本，并在发布说明里说明原因。
4. **恢复构建**：重新启用 `Update index`，用新密钥签名。
5. **旧版岛屿**：在升级前，它们不认新签名，市场会显示「索引签名无效」，打不开，但已装的插件照常运行，也不会自动更新。泄露的密钥能签出旧版岛屿认可的恶意索引，所以要在 issue、README 和官网上提醒用户尽快升级；已经装好的插件还受作者签名保护（换了作者密钥的更新要用户确认两次，见 [author-signing.md](author-signing.md)）。

只是丢失、没有泄露时，跳过第 1 步的停用，其余照做；旧版岛屿同样要升级才能继续看到市场更新。

## 岛屿怎么下载索引

岛屿先通过 GitHub API 查出 `fuyu-plugins` 的 `main` 分支最新的提交号，再按提交号下载 `index.json`、`revoked.json` 和它们的签名。这样两个文件一定来自同一次提交，也不会读到 CDN 的旧缓存。GitHub API 不可用时，退回按分支名下载；这时如果刚好赶上 CDN 缓存，可能短暂出现「签名不匹配」，稍等几分钟再刷新即可。

允许第三方插件时，岛屿在启动 30 秒后和之后每 6 小时在后台刷新一次市场。发布者信任列表存在 `plugins.json` 的 `trustedPublishers`，用户在 **设置 → 插件扩展 → 更新** 里管理；插件记下的作者密钥在 `plugins.<id>.authorKeys`。

## 点赞

插件上架后，`fuyu-plugins` 的 CI 在它的 Discussions 里自动给插件开一条点赞帖，定时统计帖子的 👍，写进 `stars.json`。市场卡片显示这个数字，可以按点赞数排序，点卡片上的 👍 打开这条帖子。
