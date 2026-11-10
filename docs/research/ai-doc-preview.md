# 让 AI 写的文档在浏览器里打开

> 日期：2026-11-10。问题：用户要读的文档（调研、方案），能不能每次都渲染成网页在浏览器打开，别人是怎么做的。范围：GitHub 上的 Claude Code 技能、插件和 MCP（关键词 claude code skill markdown preview、SKILL.md html report、anthropics/skills），离线单文件的 Markdown 渲染方案，markdown 预览的命令行工具，审阅页的交互和中文排版。只看了仓库首页，没读源码；star 数是当天看到的。相关任务：无（做成了本机的全局技能 `~/.claude/skills/doc-preview`，不在仓库里）。

## 结论

- 已经有人做类似的事，但没有一个直接合用：[claude-code-markdown-preview](https://github.com/thiagovsk/claude-code-markdown-preview) 依赖 CDN、离线打不开，也不支持 Windows；[Report-Skill](https://github.com/TheoRata/Report-Skill) 的思路最对（代理照常写 Markdown，零依赖的 Node 脚本生成所有资源都内联的单个 HTML）；[spec-review](https://github.com/marcozanger/spec-review) 的逐节审阅、「复制反馈」很适合方案类文档。
- 我们的做法：全局技能 `doc-preview`。`preview.mjs` 把 Markdown 和内嵌的 marked（MIT，约 41 KB）、样式、脚本写成一个 HTML，放在临时目录，一个源文件一个页面，再用 `cmd /c start` 打开。不装依赖、不起服务、不用 CDN（只有文档里有 Mermaid 图时才从 CDN 加载画图库，离线时显示源码）。
- 页面有：目录侧栏和当前位置高亮、深浅色、代码复制、front matter 表格、GitHub 风格的标题锚点（文档里写给 GitHub 的页内链接照样能跳）、`/docs/...` 这类仓库根路径的链接按 git 根目录解析、打印样式；以及学 spec-review 的「批注」和「复制反馈」：逐节写意见，一键整理成 Markdown 贴回对话。
- 没做的：热重载（要常驻进程；现在是重新生成后点「重新载入」）、代码高亮。

## 详细

### 现有的技能、插件和 MCP

| 项目 | 做什么 | 怎么渲染 | 备注 |
|---|---|---|---|
| [thiagovsk/claude-code-markdown-preview](https://github.com/thiagovsk/claude-code-markdown-preview) | 渲染单个 md 或整个文件夹（带文件树） | md 转 base64 嵌进 HTML，marked 和 github-markdown-css 从 jsDelivr 加载 | 离线打不开；只用 `open` / `xdg-open`，没有 Windows；2★，MIT |
| [TheoRata/Report-Skill](https://github.com/TheoRata/Report-Skill) | 代理写 Markdown，`render.mjs` 出排好版的报告 | Node 20+，零依赖，全部内联：明暗切换、scrollspy 目录、callout、脚注、代码高亮、导出回 md、就地编辑、评论 | 5★，MIT |
| [marcozanger/spec-review](https://github.com/marcozanger/spec-review) | spec / 计划的审阅页：每节 OK 或 Change、进度条、复制反馈 | 自带零依赖渲染器；Mermaid 走 CDN，离线退化 | 0★，未标许可证 |
| [iharnoor/html-everything](https://github.com/iharnoor/html-everything) | 任意内容转杂志风单页 HTML | 不用解析器，由模型直接写 HTML | 9★，MIT |
| [live-markdown-mcp](https://glama.ai/mcp/servers/kschroeder/live-markdown-mcp) | MCP，代理改文件时实时推送 | chokidar 监听 + WebSocket + Vue 界面 | 要常驻服务 |
| [OpenMarkdown](https://openmarkdown.dev/faq) | 桌面应用 + MCP，实时预览并滚到改动处 | 原生应用 | Windows 版的代理协作还是 coming soon |

[anthropics/skills](https://github.com/anthropics/skills) 只有 docx、pdf、pptx、xlsx 这类文档技能，没有预览类的。

### 离线单文件怎么渲染

- [marked](https://bundlephobia.com/package/marked)：无依赖，最适合内联。我们用 16.4.2 的 UMD 版。
- [markdown-it](https://bundlephobia.com/package/markdown-it)：体积约是 marked 的两倍，插件更多（脚注、锚点）。
- [zero-md](https://github.com/zerodevx/zero-md)：Web Component，`src` 加载外部文件在 file:// 下会被 CORS 拦，离线要用 bundled 版。
- [pandoc](https://pandoc.org/MANUAL.html)：`--standalone --embed-resources --toc`，自带高亮，但要用户另装。
- 命令行预览：[grip](https://github.com/joeyespo/grip) 调 GitHub API，要联网且限速；[markserv](https://github.com/markserv/markserv) 有热重载但要起服务。两者都比生成静态文件重。

### 中文排版

- 字体栈 `"Segoe UI", "Microsoft YaHei UI", "PingFang SC", "Noto Sans CJK SC"`，行高 1.75，正文宽度不超过 880px（未核实具体出处，常规做法）。
- CSS [`text-autospace`](https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace) 在中英文之间自动留空隙，新浏览器已支持。

## 来源

- https://github.com/thiagovsk/claude-code-markdown-preview
- https://github.com/TheoRata/Report-Skill
- https://github.com/marcozanger/spec-review
- https://github.com/iharnoor/html-everything
- https://glama.ai/mcp/servers/kschroeder/live-markdown-mcp
- https://openmarkdown.dev/faq
- https://github.com/anthropics/skills
- https://bundlephobia.com/package/marked
- https://bundlephobia.com/package/markdown-it
- https://github.com/zerodevx/zero-md
- https://pandoc.org/MANUAL.html
- https://github.com/joeyespo/grip
- https://github.com/markserv/markserv
- https://developer.mozilla.org/en-US/docs/Web/CSS/text-autospace
