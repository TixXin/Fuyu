---
name: fuyu-official-plugin
description: >
  ALWAYS invoke BEFORE creating, editing, testing, or debugging an official v3 plugin under
  plugins/v3/official/ (including a small fix, UI tweak, setting addition, or screenshot refresh).
  Do NOT edit files in plugins/v3/official/ without loading this skill first. Do NOT invoke for
  built-in features under src/features/, frozen v2 market files under plugins/packages/, or
  plugin host/SDK work under packages/.
  触发：开发官方插件、改天气插件、完善插件、加个官方插件、插件在 dev 没更新、热重载官方插件、插件截图、官方插件发版准备。
---

# 开发与调试官方插件（`plugins/v3/official/`）

做完的标准：代码在用户的 DEV 岛上已切到 `source: dev` 实时热重载生效，通过插件自检与官方插件套件测试，源码目录无构建残留，版本/文档/截图同步更新。质量标准见 `docs/plugins/official-quality.md`，平台服务与插槽见 `docs/plugins/services-and-slots.md`。

## 第一步：开工即挂进 DEV 岛持续热重载（用户定）

`pnpm tauri dev` 只监听 `src/features/` 下的内置插件；官方市场插件若在 DEV 岛装过市场版，`plugins.yml` 里是 `source: market`，直接改仓库源码不会生效。

开工修改 `plugins/v3/official/<名>/` 时，立即在后台启动常驻热重载（daemon 模式，不要在提交前杀掉，留给用户实时预览）：

```bash
pnpm plugin:dev <名>
```

- 自动定位本机活跃的 `com.tixxin.fuyu.lane-*/plugins-v3`（也支持 `--lane <n>` 或 `--dir <路径>`），把 `plugins.yml` 切到 `source: dev` 并持续监听 `src/` 和 `package.json` 自动重编，DEV 宿主检测到产物更新后自动热重载。
- 产物默认写到系统临时目录（`os.tmpdir()/fuyu-plugin-dev/<名>`），不往源码目录写 `build/` 或 `dist/`。
- 仅切一次不常驻时加 `--once`；要切回已安装的市场版加 `--market`；移除登记加 `--clean`。

## 必须守的边界与常见坑

- **源码目录禁留 `dist/` 和 `build/`**：`tests/unit/official-plugins-v3.test.mjs` 会直接断言它们不存在。调试构建一律经 `pnpm plugin:dev` 或 `--out <临时目录>`。
- **样式主题与颜色**：颜色只用 `--fuyu-plugin-*` 变量或 `light-dark(#hex, #hex)`；`light-dark()` 内不要写 `rgba()` / `hsl()`（官方插件 CSS 校验按无嵌套括号剥离 `light-dark(...)`，带括号会误报硬编码颜色）；禁止裸 `#hex`、`rgb()`、`hsl()`。
- **宿主与窗口限制**：
  - 联网经 `ctx.http.fetch`（声明 `http` 为可选或必需注入，并在 `fuyu.network` 列出全部域名），加 `AbortSignal.timeout(...)` 防断网挂死。
  - 定时用 `ctx.setTimeout` / `ctx.setInterval`，禁用全局 `setTimeout`、`setInterval`、`addEventListener`（插件 `eslint.config.mjs` 拦截）。
  - 密钥存 `secrets/v1`，绝不写进 `config.json`。
- **默认克制与老数据兼容**：新增提醒、收起条展示或额外外连（如 AQI）对新装默认关；升级时无损迁移老版 `config.json` 与 `cache.json`，不覆盖老用户已开启的项；设置即改即生效，不放保存按钮。
- **双语、窄面板与刘海**：全部用户文案含简体中文和英文；有收起条的插件注意窄空间与 `.island__notch-wing`（刘海两翼自动收敛，避免被挤进 `+N`）。
- **代码规模与无注释**：遵守根 `AGENTS.md`（`.ts/.tsx/.mjs` ≤ 400 行，`.css` ≤ 500 行，源码与测试不写注释）。

## 改完后的核对与交付

1. **版本与文档**：功能改动升次版本、修 bug 升修订号（`package.json`），同步更新 `CHANGELOG.md`（中英）和 `README.md`（中英，含新增设置、插槽和联网说明）。
2. **截图刷新**：若岛页或收起条视觉有变化，更新 `shots/sample.ts` 后在仓库根运行并目视检查生成的 PNG：
   ```bash
   node packages/plugin-cli/bin/fuyu-plugin.mjs shots plugins/v3/official/<名> --no-cover
   ```
3. **验证命令**（全过再提交）：
   - 插件目录内：`pnpm typecheck && pnpm lint`
   - 严格上架校验（插件目录内）：`node ../../../../packages/plugin-cli/bin/fuyu-plugin.mjs check --official --market --strict`（0 错误、0 告警）
   - 仓库根单测与行数：`node --test tests/unit/official-plugins-v3.test.mjs tests/unit/plugin-cli-lint.test.mjs <该插件单测>` + `pnpm check:size`
   - 提交前跑 `pnpm test:changed`；若根 ESLint 对 `plugins/v3/official/**/*.ts` 报 `tsconfigRootDir` 冲突，以插件内 `pnpm lint` 与根 ESLint 查改动测试文件为准并在汇报说明。
4. **确认 DEV 岛热重载输出**：核对后台 `pnpm plugin:dev <名>` 最近一次重编无报错，告知用户 DEV 岛已实时生效。
