# 插件市场运维（第 2 版冻结档案）

> **现行第 3 版市场运维**（`index.v3.json`、`revoked.v3.json`、从源码构建、冷静期与撤销流程）见 [v3-market.md](v3-market.md) 和 [v3-market-ci.md](v3-market-ci.md)；作者上架见 [发布](../../plugins/publish.md)。
>
> 本文仅保留**已冻结的第 2 版市场文件、旧私钥位置与紧急撤销步骤**（只服务升级前的旧版岛屿）；旧版作者签名与第 2 版设计已归档至 [author-signing.md](../history/author-signing.md) 与 [v2-platform.md](../history/v2-platform.md)。

## 冻结的第 2 版官方插件

第 2 版的 7 个官方示例插件（`dev.focusd.*`）的源码随第 2 版 SDK 在 E36.6.6 删除，第 3 版的官方插件在 `plugins/v3/official/`。本仓库留下的第 2 版市场文件冻结（2026-11-18 起不再上新版本，只在紧急撤销时重签），只给旧版岛屿读：`plugins/index.json(.sig)`、`plugins/revoked.json(.sig)`、`plugins/packages/` 里已签名的 zip，以及 `plugins/signing-keys.json`、`plugins/legacy-index-key.json`、`plugins/author-key.json` 三份公钥。

`pnpm test`（`tests/scripts/plugin-market-v2.test.mjs`）检查索引和撤销名单的签名、索引里每个条目的 zip 都在且哈希和大小一致、每个 zip 都有官方作者签名，所以误改了这些文件会被拦下。

### 旧私钥位置

两把私钥只在 Windows 那台机器上，用 DPAPI 加密，只有生成它们的 Windows 账户能解开：

- 旧索引密钥 `7ee2729370070df6`：`~/.tauri/fuyu/plugin-index-signing.key`（新目录不存在时读改名前的 `~/.tauri/fly-island/`），给本仓库 `plugins/index.json`、`plugins/revoked.json` 签名；也可以用环境变量 `FUYU_PLUGIN_SIGNING_KEY`（PEM 文本）提供。
- 官方作者密钥：`~/.tauri/fuyu/plugin-author-signing.key`，公钥在 `plugins/author-key.json`，给 `plugins/packages/` 的 zip 签名（`<zip>.sig`）；也可以用 `FUYU_PLUGIN_AUTHOR_KEY` 提供。Mac 上这个文件存的是 PEM 明文。

### 紧急撤销（第 2 版）

要撤销第 2 版官方插件的某个版本时：同时改 `fuyu-plugins` 的 `revoked.json` 和本仓库的 `plugins/revoked.json`，在 Windows 那台机器上运行 `pnpm plugins:resign`（按原样重签 `index.json` 和 `revoked.json`，给缺少 `.sig` 的 zip 补作者签名），然后提交并合入。

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

- `versions`：`"*"` 表示所有版本，或者列出具体版本；`action` 为 `disable`（停止并禁用）或 `uninstall`（停止并删插件目录，保留 `plugins-data/<id>/`）。
- 第 3 版市场的撤销名单为 `revoked.v3.json`，操作流程见 [v3-market.md](v3-market.md) 与 [v3-market-ci.md](v3-market-ci.md)。

### 第 2 版 CI 密钥泄露或丢失处理

`fuyu-plugins` 第 2 版索引的 CI 公钥固定在 `plugins/signing-keys.json`（`e862885af5bba3dc`），旧密钥 `7ee2729370070df6` 仅用于本仓库历史副本测试（`plugins/legacy-index-key.json`）。若第 2 版 CI 密钥泄露：停用 `fuyu-plugins` `release` 环境对应 secret → 换新密钥 → 在 `plugins/signing-keys.json` 与 `fuyu-plugins/keys/trusted.json` 中替换公钥并提醒旧版用户升级到第 3 版岛屿。
