#!/usr/bin/env node
// Renders a Markdown document as one self-contained HTML page and opens it in the browser.
//
//   node preview.mjs <file.md|file.html> [--title <text>] [--out <file.html>] [--no-open]
//
// Markdown: the page inlines marked (vendor/, MIT) and renders in the browser, so it works
// offline from file://. It has a table of contents, light/dark theme, copy buttons on code,
// GFM tables and task lists, front matter shown as a small table, and Mermaid diagrams when the
// document has any (loaded from a CDN only then). Links and images relative to the document
// resolve next to it; root links (`/docs/x.md`, a repo convention) resolve from the git root.
// HTML: opened as it is.
//
// The page goes to <tmp>/doc-preview/<name>-<hash>.html, one per source file, so running the
// script again after an edit rewrites the same page: refresh the browser tab to see it.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`doc-preview: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { open: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--no-open") options.open = false;
    else if (arg === "--title") options.title = argv[++i];
    else if (arg === "--out") options.out = argv[++i];
    else if (arg === "-h" || arg === "--help") options.help = true;
    else if (!options.file) options.file = arg;
    else fail(`unexpected argument ${arg}`);
  }
  return options;
}

/** The nearest folder above `dir` holding .git (a folder, or a worktree's .git file), or null. */
function gitRoot(dir) {
  for (let current = dir; ; current = path.dirname(current)) {
    if (existsSync(path.join(current, ".git"))) return current;
    if (path.dirname(current) === current) return null;
  }
}

/** Splits off a leading `---` front matter block as [key, value] pairs. */
function frontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: [], body: text };
  const meta = match[1].split(/\r?\n/).map((line) => /^([\w-]+):\s*(.*)$/.exec(line)).filter(Boolean).map((m) => [m[1], m[2]]);
  return { meta, body: text.slice(match[0].length) };
}

/** JSON safe to put inside a <script> element. */
const scriptJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function page({ title, source, markdown, meta, baseUrl, rootUrl }) {
  const marked = readFileSync(path.join(here, "vendor", "marked.umd.js"), "utf8");
  const data = { markdown, meta, baseUrl, rootUrl, source, generated: new Date().toLocaleString("zh-CN", { hour12: false }) };
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${readFileSync(path.join(here, "page.css"), "utf8")}</style>
<script>try{const t=localStorage.getItem("doc-preview-theme");if(t)document.documentElement.dataset.theme=t}catch{}</script>
</head>
<body>
<header class="bar">
  <span class="bar__title">${escapeHtml(title)}</span>
  <span class="bar__source" title="${escapeHtml(source)}">${escapeHtml(source)}</span>
  <span class="bar__actions">
    <button type="button" data-action="feedback" title="把各节的批注整理成 Markdown 复制，贴回对话">复制反馈</button>
    <button type="button" data-action="reload" title="文档重新生成后点这里">重新载入</button>
    <button type="button" data-action="toc" aria-label="目录">目录</button>
    <button type="button" data-action="theme" aria-label="切换深浅色">深浅色</button>
    <button type="button" data-action="copy" aria-label="复制 Markdown 原文">复制原文</button>
    <button type="button" data-action="print" aria-label="打印">打印</button>
  </span>
</header>
<div class="layout">
  <nav class="toc" aria-label="目录"></nav>
  <main class="doc"><article class="markdown"></article><footer class="doc__footer"></footer></main>
</div>
<script id="doc-data" type="application/json">${scriptJson(data)}</script>
<script>${marked}</script>
<script>${readFileSync(path.join(here, "page.js"), "utf8")}</script>
</body>
</html>
`;
}

function openInBrowser(file) {
  const [command, args] =
    process.platform === "darwin" ? ["open", [file]]
    : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]]
    : ["xdg-open", [file]];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", (error) => console.error(`doc-preview: could not open the browser (${error.message}); open the file by hand.`));
  child.unref();
}

const options = parseArgs(process.argv.slice(2));
if (options.help || !options.file) {
  console.log("Usage: node preview.mjs <file.md|file.html> [--title <text>] [--out <file.html>] [--no-open]");
  process.exit(options.help ? 0 : 1);
}
const source = path.resolve(options.file);
if (!existsSync(source) || !statSync(source).isFile()) fail(`no such file: ${source}`);

let out = source;
if (!/\.html?$/i.test(source)) {
  const { meta, body } = frontMatter(readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
  const heading = /^#\s+(.+)$/m.exec(body)?.[1].trim();
  const metaTitle = meta.find(([key]) => key === "title")?.[1];
  const metaId = meta.find(([key]) => key === "id")?.[1];
  const title = options.title ?? heading ?? (metaTitle ? `${metaId ? `${metaId} ` : ""}${metaTitle}` : path.basename(source));
  const root = gitRoot(path.dirname(source));
  const dirUrl = pathToFileURL(path.dirname(source) + path.sep).href;
  const rootUrl = root ? pathToFileURL(root + path.sep).href : null;
  const hash = createHash("sha1").update(source.toLowerCase()).digest("hex").slice(0, 8);
  out = path.resolve(options.out ?? path.join(tmpdir(), "doc-preview", `${path.basename(source).replace(/\.[^.]+$/, "")}-${hash}.html`));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, page({ title, source, markdown: body, meta, baseUrl: dirUrl, rootUrl }));
  console.log(`doc-preview: wrote ${out}`);
}
if (options.open) {
  openInBrowser(out);
  console.log(`doc-preview: opened ${out} in the browser`);
}
