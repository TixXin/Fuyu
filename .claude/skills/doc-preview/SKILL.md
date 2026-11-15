---
name: doc-preview
description: >
  ALWAYS invoke AFTER writing or updating a Markdown document the user is meant to read
  or decide on: research report (docs/research/), plan, proposal, comparison, task
  write-up, release notes, design note, handoff summary; including a small update to a
  document the user is already reviewing. Also invoke when the user asks to see or
  preview a Markdown file. Do NOT hand over such a document as pasted text or a bare
  path without loading this skill first. Do NOT invoke for source code, logs, files the
  user is not meant to read, or Markdown from an untrusted source.
  触发：打开给我看、用浏览器打开、预览一下、给我看看文档、调研写好了、方案改完了、计划更新了。
---

# doc-preview：把文档渲染成网页，在浏览器里打开

做完的标准：页面已在用户的浏览器里打开（打不开时用户拿到了页面路径）；回复里只有一两句文档讲了什么，加上源文件路径，没有贴全文。

## 怎么用

从仓库根执行：

```bash
node .claude/skills/doc-preview/preview.mjs <文件.md>
```

- 一个源文件对应临时目录里的一个页面。改了文档再跑一次，用户刷新原来的标签页就能看到。
- 一轮里改同一份文档多次时，中间几次加 `--no-open`，最后一次再打开：每次打开都会多一个标签页。其余参数见 `--help`。
- 用户在远程或没有图形界面的环境里时不跑，只给路径：页面开在跑脚本的那台机器上，用户看不到。
- 自动打开用的是 macOS 的 `open`。在别的系统上或打开失败时页面照样生成，把脚本打印的路径告诉用户。
- 页面不清理 HTML，文档里的 HTML 会原样进页面：只渲染自己写的或仓库里的文档，来路不明的 Markdown 能在用户的浏览器里跑脚本。

## 批注和反馈

每个 `##` 标题旁有「批注」按钮，顶栏「复制反馈」把所有批注整理成 Markdown，用户贴回对话。打开方案、计划这类要用户拍板的文档时，在回复里提一句可以这样反馈。批注只存在页面里，「重新载入」会清空：文档重新生成后，提醒用户先复制反馈再载入。

## 写文档时配合页面

- 开头一个 `# 标题`，它就是页面标题；用 `##` / `###` 分节，目录由这两级生成，批注按 `##` 分。
- 流程或结构可以用 ```mermaid 代码块；Mermaid 从 CDN 加载，离线时显示原始代码。
- 相对链接和图片按文档所在目录解析；以 `/` 开头的链接按 git 仓库根目录解析。
