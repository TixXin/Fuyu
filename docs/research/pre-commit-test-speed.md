# 提交前测试提速

> 日期：2026-11-22。问题：用户觉得提交前跑的测试（尤其是回归页）太耗时间，问还能不能再快。范围：本机实测（一次 `pnpm test:changed`、一次 `pnpm mq:verify` 的日志，`tests/regression/timings.json`），读了 `scripts/run-regression.mjs`、`scripts/test-changed.mjs`、`scripts/heavy/queue.mjs`；联网搜了 Vite 冷启动和预热、Playwright 的假时钟和复用服务器、Vitest 浏览器模式、按改动挑测试（Meta 的 Predictive Test Selection、Google TAP）、用 V8 覆盖率建「测试 ↔ 文件」对应表。相关任务：无（等用户挑）。

## 结论

现在一次提交前的 `test:changed` 大约 14 分钟，时间花在四处，都能压：

| 花在哪 | 实测 | 能省多少（估计） | 难度 |
|---|---|---|---|
| **排队**：全机器同时只跑 2 个重任务（10 核 ÷ 5），十几个会话抢 | 这次排了约 4.5 分钟 | 回归页单独算名额后大部分省掉 | 小 |
| **一个浏览器串着跑**：`test:changed` 调回归页没带 `--jobs`，默认 1 个浏览器；`mq:verify` 用的是 3 个 | 78 页串着跑 520 秒 | 开 3 个浏览器约降到 3 分钟 | 小 |
| **挑得太多**：按 import 关系挑，岛壳、i18n、`panelSize` 这类到处被引用的文件一改就是 78 / 80 页 | 这次改 49 个文件挑出 78 页 | 按「这一页真的跑到了哪些代码」挑，常见改动预计只剩几页到十几页 | 中 |
| **几页特别慢**：`builtins-off` 把每个内置功能各关一遍、整个岛挂载走一遍 | CI 上 94.5 秒，占全部回归页的 21%；本机忙时 120 秒超时，这次它和 `side-island` 两页超时就耗掉 4 分钟 | 拆成按功能的几页、只跑改到的功能 | 小到中 |

我的建议按先后：

1. **先做两件小事**（预计 14 分钟 → 5–6 分钟）：`test:changed` 调回归页时带 `--jobs 3`；回归页在排队里单独算名额（它主要是浏览器单线程，和 `cargo` 不抢同一种资源），或者按浏览器数算名额。
2. **拆 `builtins-off`**：一页变成按功能的几页（`builtins-off.html?only=<功能>`），`test:changed` 只挑改到的那几个功能；全量验证时照旧全跑。
3. **按覆盖率挑页**（最大的一步）：在全量验证时顺带记下每页实际执行了哪些源文件（Chrome 自带的精确覆盖率，通过我们已经在用的 CDP 拿），存成一张「文件 → 页面」表；`test:changed` 用这张表代替 import 关系。Meta 用历史数据挑测试，只跑约三分之一就拦住了 99.9% 的坏改动；我们不需要学习模型，覆盖率表就比 import 关系准得多。表过时的风险由推 PR 前的全量 `mq:verify` 兜底。
4. 视效果再做：页面里的固定等待换成假时钟（CDP 的虚拟时间），Vite 服务器常驻复用，等结果从每 0.5 秒轮询改成页面主动通知，`test:changed` 只拍深色快照。这几项单项收益小或要先实测，排在后面。

不建议的：换成 Vitest 浏览器模式或 Playwright 测试框架。我们的回归页已经是「一页一个真实浏览器 + CDP」，换框架要重写 80 页，网上也没找到能说明它更快的实测对比，省的时间主要还是来自上面几条，和用哪个框架关系不大。

还有一条是取舍，要用户定：提交前要不要只跑「直接相关」的页（改到的页面自己的 `.tsx`，或离改动文件两三层 import 以内的），把间接受影响的留给推 PR 前的全量验证。这会更快，但「几十个提交一起挂、对不上是哪个提交」的问题（当初定提交前跑 `test:changed` 的原因）会回来一部分。

## 详细

### 实测数字

- **这次 `test:changed`**（2c23d0946，改 49 个文件）：挑出回归页 78 页、单元测试 44 个文件。单元测试约 5 秒。回归页：排队提示 9 次（每 30 秒一次，约 4.5 分钟），每页用时加起来 520 秒；`side-island` 和 `builtins-off` 各在 120 秒超时。总计约 14 分钟。
- **同一天的 `mq:verify`**（c1c174e5a）：回归页 80 页用 3 个浏览器，排队加运行 5 分 55 秒；`build:exe` 3 分 18 秒。
- **CI 上每页用时**（`tests/regression/timings.json`，Windows runner）：77 页合计 457 秒。最慢的十页占 52%：`builtins-off` 94.5、`notch-island` 27、`agent-alerts` 18.7、`settings` 18.5、`music-lyrics` 16.4、`island-forms` 13.7、`i18n` 13.2、`side-island` 13.2、`collapsed-message-animation` 12.2、`message-panel` 10.1。
- **排队名额**：`scripts/heavy/queue.mjs` 的 `slotCount` 是 `floor(核数 / 5)`，这台 Mac 10 核 = 2 个；回归页、`cargo test`、`build:exe`、`verify` 共用这 2 个。同一时刻有 12 个会话。
- **每次都冷启动**：`run-regression.mjs` 每次新建一个 Vite 开发服务器和新的浏览器配置目录；页面结果每 500 毫秒查一次；每页通过后再拍深色、浅色两份 DOM 快照并做一遍浅色对比度检查。
- **页面里的固定等待**：回归页里写死 100 毫秒以上 `setTimeout` 的有 21 处（`grep`）。

### 按改动挑测试

- Meta 的 Predictive Test Selection 不看依赖图，从历史改动和测试结果学挑法：只跑约三分之一的测试，拦住 99.9% 以上的坏改动、95% 以上的单个测试失败，基础设施成本约减半（2018 年的论文和博客，现在的数字未核实）。
- Google 2017 年的论文说他们的 TAP 没用统计方法挑测试，理由是多语言插桩难、代码变动太快；现在怎么做未核实。
- DPE 2022 年的报告说一次改动通常只影响不到 1% 的测试。
- 用覆盖率建对应表的做法：V8 的精确覆盖率（precise coverage）计数准确，代价是跑得慢一些；按测试分段取快照，再反过来得到「文件 → 测试」，和改动的文件求交集。网上没找到现成工具做最后一步，要自己写。我们的页面是 Vite 开发服务器按源文件逐个提供的 ES 模块，覆盖率直接按源文件 URL 记，不需要 source map 还原，比打包后的项目好做。

### 其他提速手段

- **Vite 预热**：`server.warmup` 能在启动时先转换常用文件；`optimizeDeps.include` 能避免冷启动时发现新依赖再整页重载。预打包的依赖缓存在 `node_modules/.vite`。网上没有针对浏览器测试场景的实测数字，要自己量。
- **复用开发服务器**：Playwright 的 `reuseExistingServer` 是「端口上已有服务器就直接用」，常见写法是本地复用、CI 不复用；它不负责让服务器常驻，要另外起。也有人提醒开发服务器和生产构建有差别。
- **假时钟**：Playwright 1.45 起的 `page.clock` 能替换 `Date`、`setTimeout`、`setInterval`、`requestAnimationFrame`，要在页面加载前装上，`runFor` 推进时间时触发到期的定时器。我们不用 Playwright，同类能力在 CDP 的 `Emulation.setVirtualTimePolicy`（未在本仓库试过）。动画相关的页面要单独看能不能用。
- **Vitest 浏览器模式**：Vitest 官方推荐它做组件测试，社区文章普遍说反馈快，但没找到和 Playwright 在同一套测试上的实测对比；它也可以用 Playwright 当驱动。对我们来说是换框架，收益不明。

## 来源

- [Vite 性能指南（warmup）](https://vite.dev/guide/performance)
- [Vite 依赖预构建](https://vite.dev/guide/dep-pre-bundling)
- [Playwright Clock](https://playwright.dev/docs/clock)
- [Playwright webServer / reuseExistingServer](https://playwright.dev/docs/test-webserver)
- [Nx：Playwright 服务器就绪探测](https://nx.dev/docs/kb/playwright-web-server-readiness)
- [Vitest 与其他工具的比较](https://main.vitest.dev/guide/comparisons)
- [Epic Web：Vitest 浏览器模式 vs Playwright](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)
- [Meta 工程博客：Predictive Test Selection](https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/)
- [Predictive Test Selection 论文](https://arxiv.org/pdf/1810.05286.pdf)
- [Taming Google-Scale Continuous Testing（ICSE SEIP 2017）](https://huang.isis.vanderbilt.edu/cs8395-f23/paper/google-testing-icse-seip-17.pdf)
- [DPE 2022：Foundations of Predictive Test Selection](https://dpe.org/files/sessions/2022/Foundations_of_Predictive_Test_Slides.pdf)
- [V8 博客：JavaScript 代码覆盖率](https://v8.dev/blog/javascript-code-coverage)
- [monocart：V8 覆盖率数据](https://abdul-alhasany.github.io/monocart-coverage-reports/guide/v8-coverage.html)
- [按套件收集 Chrome 覆盖率的示例（WebdriverIO）](https://github.com/cek333/v8-chrome-coverage-wdio-sync)
