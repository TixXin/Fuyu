# 发布插件 SDK

npm 包 `fuyu-plugin`（SDK、命令行工具、模拟宿主）和 `create-fuyu-plugin`（脚手架）由 GitHub Actions 工作流 [`publish-sdk.yml`](../../../.github/workflows/publish-sdk.yml) 发布：推送 `sdk-v<版本>` 标签就发。它用 npm 的 **Trusted Publishing**（OIDC），仓库里和电脑上都不保存 npm 令牌，也不需要绕过两步验证。

两个包的版本号始终相同：脚手架建的插件依赖 `fuyu-plugin ^<脚手架自己的版本>`。

## 一次性设置（维护者在 npmjs.com 上做）

对两个包各做一次：

1. 登录 [npmjs.com](https://www.npmjs.com)，打开包页面 → **Settings**。
2. **Trusted Publisher** 一栏选 **GitHub Actions**，填：
   - Organization or user：`TixXin`
   - Repository：`fuyu`（2026-11-10 改名前是 `fly-island`；旧包上按旧名字配的不再生效）
   - Workflow filename：`publish-sdk.yml`
   - Environment name：`npm`
3. 保存。确认工作流能发布以后，同一页的 **Publishing access** 可以改成 "Require two-factor authentication and disallow tokens"，以后只有这个工作流能发布新版本。

工作流跑在 GitHub 的 `npm` 环境里，第一次运行时会自动创建。想在每次发布前人工批准，就到仓库 Settings → Environments → `npm` 加上 Required reviewers。

## 发布第 3 版 SDK（`2.0.0` 及以上）

从 `2.0.0` 起，`fuyu-plugin` 与 `create-fuyu-plugin` 面向插件平台第 3 版，由 [`scripts/plugins-v3/pack-npm-sdk.mjs`](../../../scripts/plugins-v3/pack-npm-sdk.mjs) 从工作区内的 `@fuyu/plugin-base`、`@fuyu/plugin-services`、`@fuyu/plugin-cli`、`@fuyu/plugin-manifest`、`@fuyu/plugin-market`、`@fuyu/plugin-review` 与 `@fuyu/create-plugin` 组装为零 `workspace:*` 依赖、带完整 `.d.mts` 类型声明的自包含发布目录：

1. 把 `packages/plugin-cli/package.json` 和 `packages/create-plugin/package.json` 的 `version` 改成同一个新版本号（保持 `"private": true`），在 [更新日志](../../plugins/changelog.md) 写明本次变化与 npm 包版本。
2. 本地验证组装与端到端测试：

   ```sh
   node --test "packages/plugin-*/test/**/*.test.mjs" "packages/create-plugin/test/**/*.test.mjs" tests/scripts/pack-npm-sdk.test.mjs
   ```

3. 提交并经 `pnpm mq:land --yes` 合入 `main`，再给合入后的提交打标签并推送：

   ```sh
   git tag sdk-v2.0.0 origin/main
   git push origin sdk-v2.0.0
   ```

4. 工作流识别 `sdk-v2.*` 标签后，会核对 `packages/plugin-cli` 与 `packages/create-plugin` 的版本号、运行全部 v3 包单测与独立临时目录端到端单测，调用 `pack-npm-sdk.mjs` 生成 `/tmp/npm-sdk/fuyu-plugin` 与 `/tmp/npm-sdk/create-fuyu-plugin`，并通过 `npm publish --access public --provenance` 发布（已存在的版本自动跳过）。
5. 发布后用 `npm view fuyu-plugin version` 与 `npm view create-fuyu-plugin version` 确认 provenance；随后在 [`TixXin/fuyu-plugins`](https://github.com/TixXin/fuyu-plugins) 更新 `market/v3/tools.json`（及市场校验依赖）并提 PR 合入。

## 旧第 2 版（`0.x`）

第 2 版的 `packages/fuyu-plugin`、`packages/create-fuyu-plugin` 和 PowerShell 模块 `Fuyu.Plugin` 已在 E36.6.6 删除，npm 上停在 0.7.0，不再发补丁。工作流收到 `sdk-v0.*`、`sdk-v1.*` 标签时直接报错退出。
