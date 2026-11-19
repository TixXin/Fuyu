# 本机 Windows 构建和测试环境问题（2026-11-19）

起因：C135.1 做到一半时，`Fuyu-[总控] UI 外观` 在用户的 Windows 机器上碰到三个和代码无关的问题，交给 `Fuyu-[总控] Win 适配`，由组长 `[任务] 本机构建和测试环境问题` 排查。

## 范围

三个问题里，下面两个已经由 C135 组长查清并解决：

- release 构建在 `aws-lc-sys` 报 LNK1104；
- 233 个 Rust 测试建不了 `%TEMP%` 下的目录。

原因是仓库根目录有一条可继承的 Low 完整性标记，cargo 编出来的 exe 跟着带 Low 标记，启动后以低完整性运行，写不了 Medium 的 `%TEMP%`。LNK1104 打不开的其实是 link.exe 追加归档时写的 `%TEMP%\lnk{GUID}.tmp`。c135-1 只给 `src-tauri/target` 设了 Medium，没改代码；现在全套 Rust 测试 1293 个全过，`build:exe` 能打出 exe。本组也独立复现了这个结论。

本文只管剩下的两件：

1. `phase5-lifecycle-e2e.test.mjs` 挂住；
2. 根目录的 Low 标记要不要去掉。

## 1. phase5 测试挂住：不是完整性问题，是测试 bug

**不是同一个原因**：放在仓库外的临时目录里一样能复现，node 本身从 `Program Files` 启动，是 Medium 进程，写 `%TEMP%` 没问题（mkdtemp 和测试前几步都成功了）。测试也不起子进程、不等端口。

**卡在哪**：第 97 行左右 `cpSync(options.dir, maliciousDir, { recursive: true })`，复制 v2 恶意版本的那一步。

1. 前面 `linkDevDependencies` 在 `pomodoro-v1/node_modules/@fuyu/*` 下建了 junction，指向 `packages/plugin-base` 等目录。
2. Node 的 `cpSync` 不保留 junction，把它当普通目录递归复制（实测复制后 `isSymbolicLink()` 是 `false`，Node v26.12.0 和 CI 的 v26.13.1 一样）。
3. 被复制的包里，pnpm 建的 junction 成环：`vendor/cordis/core/node_modules/@cordisjs/fs` → `vendor/cordis/fs`，它的 `node_modules/cordis` 又指回 `vendor/cordis/core`（lockfile 里的 `link:../fs`，不是本机残留）。
4. 本机开了 `LongPathsEnabled=1`，没有 260 字符的天花板，复制呈指数增长，永远不结束。

**证据**：`timeout 180` 跑时，scaffold、check、pack、首次 review 都过了，`pomodoro-v2-malicious` 里已有 41470 个条目，`host-data` 还没出现。仓库外的最小复现：一个 junction 指向 `packages\plugin-base`，单独 `cpSync`，40 秒复制出 10047 个条目，`node_modules` 嵌套 64 层，最长路径 1581 字符。

**CI 为什么能过**：`windows-latest` 上这个测试 2.3 秒通过，原因没核实（runner 是管理员、有符号链接权限，可能行为不同）。

**顺带**：`packDirectory … symbolic links` 失败是因为本机没有 `SeCreateSymbolicLinkPrivilege`，`symlinkSync(…, "dir")` 报 EPERM，和挂住无关。

## 2. 根目录的 Low 标记

**现状**（`icacls`）：

| 位置 | 完整性标记 |
|---|---|
| `E:\Projects\fuyu`（根） | 显式 `Low (OI)(CI)(NW)`，同时还有 `Everyone:(CI)(DENY)(DC)` 和两条 `S-1-4-…:(OI)(CI)(W,D,DC)` |
| `packages`、`scripts`、`vendor`、`dist` 等 | 继承 Low |
| `src-tauri/target` | 显式 Medium（c135-1 设的），下面的 `debug`、`release`、`agents` 都继承 Medium |
| `node_modules` | 显式 Medium（不知道谁设的），`esbuild.exe` 等是 Medium |

**哪来的**：这几条都是 Claude 桌面版会话沙箱（`dev-island-issues.md` 第 5 节记作 VibeDev / DSH 的 Windows 沙箱）在工作区根目录加的，显式、不继承，加的时间不详。`NW`（No-Write-Up）的意思是完整性低于 Low 的进程不能写，所以这条标记的作用是**让以 Low 完整性运行的沙箱进程也能写工作区**。两条 `S-1-4-…` 允许项是沙箱进程令牌里的能力 SID，给它们写和删的权限；`Everyone DENY DC` 不让任何人通过父目录删除子项。

**去掉会怎样**：

- 好处：以后在仓库里任何地方编出来或拷进来的 exe 都是 Medium，不会再有这类问题。
- 风险：如果沙箱有以 Low 完整性运行的模式，那些进程就写不了工作区，会话改不了文件、跑不了构建。现在这个会话的进程能写 Medium 的 `target`，说明它不是 Low；但不能排除别的模式、别的会话或之后的版本是 Low。沙箱也可能在下次启动会话时把标记加回来。

**不去掉的话还会不会出问题**：只有**放在仓库里的 exe** 会受影响，node、cargo、rustc、cl.exe 这些装在仓库外的程序不受影响。

- 已经处理的：`src-tauri/target`、`node_modules`（Medium）。
- 还可能出事的：
  - 有人把 `src-tauri/target` 整个删掉重建（`cargo clean`、手动删），新目录会重新继承 Low，问题原样回来；
  - 新的构建目录在 `target` 以外（目前没有）；
  - `node_modules` 删了重装时同样会继承 Low。AGENTS.md 里「`vite build` 删不掉临时目录里的 esbuild 文件（Access is denied）」那条，很可能就是 `esbuild.exe` 当时是 Low 造成的。

**建议**：根目录**不动**，只在会放 exe 的两处保持 Medium。要防重建后复发，可以让脚本自动检查（见下面的可选任务）。

## 计划

### 要改仓库的

**D109 修 phase5 E2E 测试挂住、符号链接测试在没权限时跳过**（D 组，测试）

- 做什么：
  - `cpSync` 加 `filter`，跳过 `node_modules` 和 `build/`；后面需要依赖时对复制出的目录再调一次 `linkDevDependencies`；
  - 这个 `test(...)` 加 `{ timeout: 60_000 }`，再卡住会直接失败，不拖住 `pnpm check`；
  - `packages/plugin-manifest/test/package.test.mjs` 的符号链接用例在 `symlinkSync` 报 EPERM 时 `t.skip`，CI 上照样跑。
  - 先加载 `fuyu-testing`。
- `--scope`：`tests/unit/phase5-lifecycle-e2e.test.mjs,packages/plugin-manifest/test/package.test.mjs`
- 怎样算做完：
  - 本机 `pnpm test` 不再挂住、0 失败（符号链接那条显示跳过）；
  - `pnpm check` 通过；
  - `pnpm mq:try` 的 Windows CI 里这两个测试仍然真的跑并通过。
- 一个任务会话，不编译 Rust；提交交给 `Fuyu-[总控] 全局` 整批合入。

**可选：F63 构建前自动检查 `target` 和 `node_modules` 的完整性标记**（F 组，开发工具）

- 做什么：把 `scripts/dev-integrity.mjs` 现在只管 `target/debug` 的检查推广到 `src-tauri/target` 和 `node_modules`：有 Low 就提成 Medium，并在提示里写上症状（LNK1104、测试报拒绝访问、esbuild Access is denied）。在 `pnpm heavy`、`build:exe`、`pnpm verify` 开头调用；`workflow.md`「排障」加一条，链到本文。
- `--scope`：`scripts/dev-integrity.mjs,scripts/heavy/heavy.mjs,scripts/build-exe.mjs,scripts/stop-running-island.mjs,tests/scripts/dev-integrity.test.mjs,docs/architecture/workflow.md`
- 怎样算做完：单元测试覆盖「Low → 提升」「已是 Medium → 不动」「非 Windows → 跳过」；`pnpm check` + `pnpm build` 通过。
- 作用：防 `target` 或 `node_modules` 重建后复发。不做也行，复发时按下面第 3 步手动修。

### 要用户在本机做的

1. **结束卡死的测试进程**（PID 2696，`node … phase5-lifecycle-e2e.test.mjs`，已占约 70 分钟 CPU），PowerShell：

   ```powershell
   Stop-Process -Id 2696
   ```

2. **删掉 6 个残留的临时目录**。里面是很深的 junction 展开，必须用不跟随 junction 的 `rmdir`；别用资源管理器、`Remove-Item -Recurse` 或 `rm -rf`，以免删到仓库里的 `packages/`。cmd：

   ```cmd
   for /d %d in ("%TEMP%\fuyu-phase5-e2e-*") do rmdir /s /q "%d"
   ```

3. **以后又碰到 release 构建 LNK1104 或 Rust 测试拒绝访问时**，先看 `target` 是不是又变回 Low，PowerShell：

   ```powershell
   icacls E:\Projects\fuyu\src-tauri\target | Select-String Mandatory
   # 是 Low 就运行：
   icacls E:\Projects\fuyu\src-tauri\target /setintegritylevel "(OI)(CI)M" /T /Q
   ```

4. **只有决定去掉根目录 Low 标记时才做**（不建议），PowerShell：

   ```powershell
   icacls E:\Projects\fuyu /setintegritylevel "(OI)(CI)M"
   ```

   只改根目录这一条，子目录跟着继承 Medium。要恢复就把 `M` 换成 `L` 再跑一次。

5. 可选：打开 Windows「开发者模式」（设置 → 系统 → 开发者选项），普通用户就能建符号链接，`packDirectory … symbolic links` 会真的跑。

## 需要用户定的

1. 根目录的 Low 标记：**不动**（建议），还是按第 4 步去掉？
2. 可选的 F63 做不做？
3. 第 1、2 步（结束进程、删临时目录）由组长代做，还是你自己来？
