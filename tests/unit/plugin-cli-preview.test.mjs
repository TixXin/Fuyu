import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { OUTPUT, render } from "../../packages/plugin-cli/scripts/gen-preview-styles.mjs";
import { findBrowser, preview, run } from "../../packages/plugin-cli/src/index.mjs";
import { escapeHtml, markdownHtml } from "../../packages/plugin-cli/src/preview/markdown.mjs";
import { parseMarkdown } from "../../src/components/markdown/parseMarkdown.ts";

const HELLO = fileURLToPath(new URL("../../packages/plugin-cli/test/fixtures/hello", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-preview-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

function hello(edit = () => {}) {
  const dir = join(scratch, `${++next}`, "hello");
  cpSync(HELLO, dir, { recursive: true });
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  edit(pkg, dir);
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return dir;
}

function capture(cwd) {
  const stdout = [];
  const stderr = [];
  return {
    io: { cwd, env: process.env, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}

function stage(html, theme, locale) {
  const sections = html.split("<section ").slice(1);
  const found = sections.find((section) => section.includes(`data-theme="${theme}" data-locale="${locale}"`));
  assert.ok(found, `no ${theme} ${locale} view`);
  return found;
}

function appHtml(source) {
  const inline = (parts) =>
    parts
      .map((part) => {
        if (part.type === "code") return `<code>${escapeHtml(part.text)}</code>`;
        if (part.type === "strong") return `<strong>${escapeHtml(part.text)}</strong>`;
        if (part.type === "em") return `<em>${escapeHtml(part.text)}</em>`;
        if (part.type === "link") return `<a href="${escapeHtml(part.href)}" rel="noreferrer">${escapeHtml(part.text)}</a>`;
        return escapeHtml(part.text);
      })
      .join("");
  return parseMarkdown(source)
    .map((block) => {
      if (block.type === "heading") {
        const tag = ["h3", "h4", "h5", "h6", "h6", "h6"][block.level - 1];
        return `<${tag}>${inline(block.content)}</${tag}>`;
      }
      if (block.type === "paragraph") return `<p>${inline(block.content)}</p>`;
      if (block.type === "quote") return `<blockquote>${inline(block.content)}</blockquote>`;
      if (block.type === "code") return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
      if (block.type === "rule") return "<hr>";
      if (block.type === "table") {
        const cell = (tag, content, column) => `<${tag}${block.align[column] ? ` data-align="${block.align[column]}"` : ""}>${inline(content)}</${tag}>`;
        const rows = block.rows.map((row) => `<tr>${row.map((content, column) => cell("td", content, column)).join("")}</tr>`).join("");
        return `<div class="markdown__table"><table><thead><tr>${block.head.map((content, column) => cell("th", content, column)).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      const tag = block.ordered ? "ol" : "ul";
      return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`;
    })
    .join("\n");
}

test("the README is drawn by the same rules as the market's detail page", () => {
  const readme = [
    "# 你好 · Hello", "", "Says **hi** to `you`, _really_. <script>alert(1)</script>", "second line", "",
    "## Where", "", "- one [site](https://example.com/a?b=1&c=2)", "- two [local](./docs/x.md) ![shot](screenshots/page.png)", "  continued", "",
    "1. first", "2) second", "", "> quoted", "> more", "", "| a | b <i> | c |", "|---|:---:|---:|", "| 1 | `2` \\| two |", "not | a table", "", "x | y", "", "```ts", "const a = \"<b>\";", "```", "", "---", "###### deep", "[x](javascript:alert(1))",
  ].join("\r\n");
  const drawn = markdownHtml(readme);
  assert.equal(drawn, appHtml(readme));
  assert.match(drawn, /^<h3>你好 · Hello<\/h3>/);
  assert.ok(drawn.includes('<th data-align="center">b &lt;i&gt;</th>') && drawn.includes('<td data-align="center"><code>2</code> | two</td><td data-align="right"></td>'), drawn);
  assert.ok(!drawn.includes("<script>") && !drawn.includes("<i>") && !drawn.includes("<img") && !drawn.includes("javascript:"));
});

test("the styles in the package are the ones the app has now", () => {
  const packaged = JSON.parse(readFileSync(OUTPUT, "utf8"));
  assert.deepEqual(packaged, JSON.parse(render()), "the market styles changed: run `node packages/plugin-cli/scripts/gen-preview-styles.mjs` and commit packages/plugin-cli/src/preview/app-styles.json");
  for (const rule of [".market-card {", ".market-card__desc {", ".market-cover {", ".plugin-dialog {", ".island-light {", ".settings-stage--light {"]) assert.ok(packaged.css.includes(rule), rule);
});

test("preview draws the card and the detail page in both themes and both languages from the plugin's own files", async () => {
  const result = await preview(hello());
  assert.equal(result.file, join(result.dir, "build", "preview.html"));
  assert.deepEqual(result.stages, [{ theme: "dark", locale: "zh-CN" }, { theme: "light", locale: "zh-CN" }, { theme: "dark", locale: "en" }, { theme: "light", locale: "en" }]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.listing.map((issue) => issue.code), ["listing:screenshots"]);
  const html = readFileSync(result.file, "utf8");
  assert.ok(!/\ssrc="(?!data:)/.test(html) && !html.includes("<link") && !html.includes("<script"), "the page loads nothing from outside itself");

  const zh = stage(html, "dark", "zh-CN");
  assert.match(zh, /class="fp-stage settings-stage" lang="zh-CN"/);
  assert.match(zh, /<button class="market-card__name"[^>]*>你好<\/button>/);
  assert.match(zh, /<span class="market-card__sub">someone · 开发 · v1\.0\.0<\/span>/);
  assert.match(zh, /<p class="market-card__desc">在岛上打个招呼<\/p>/);
  assert.match(zh, /<span class="market-card__facts">不联网<\/span>/);
  assert.match(zh, /data-market-cover="0"[^>]*><span class="plugin-icon plugin-icon--lg plugin-icon--img"/);
  assert.match(zh, /<span class="plugin-dialog__title">你好<\/span>/);
  assert.match(zh, /<div class="markdown market-markdown"><h3>Hello<\/h3>/);
  assert.match(zh, /<dt>需要<\/dt><dd>浮屿 &gt;=0\.4\.0<\/dd>/);
  assert.match(zh, /title="https:\/\/github\.com\/someone\/fuyu-hello"/);
  assert.ok(!zh.includes("plugin-verified"));

  const en = stage(html, "light", "en");
  assert.match(en, /class="fp-stage settings-stage settings-stage--light island-light" lang="en"/);
  assert.match(en, /<button class="market-card__name"[^>]*>Hello<\/button>/);
  assert.match(en, /<span class="market-card__sub">someone · Developer · v1\.0\.0<\/span>/);
  assert.match(en, /<span class="market-card__facts">Offline<\/span>/);
});

test("screenshots, the network line, the official mark and a translated README follow the manifest", async () => {
  const dir = hello((pkg, folder) => {
    pkg.name = "@fuyu/hello";
    pkg.fuyu.description.en = "Says <b>hello</b> & more";
    pkg.fuyu.network = ["api.example.com"];
    pkg.fuyu.platforms = ["windows", "macos"];
    pkg.fuyu.screenshots = [
      { path: "assets/page.png", caption: { "zh-CN": "岛上的页面", en: "The island page" } },
      { path: "assets/bar.png" },
      { path: "assets/gone.png" },
    ];
    writeFileSync(join(folder, "assets", "page.png"), "page");
    writeFileSync(join(folder, "assets", "bar.png"), "bar");
    writeFileSync(join(folder, "README.zh-CN.md"), "# 你好\n\n中文说明。\n");
  });
  const result = await preview(dir, { theme: "dark" });
  assert.deepEqual(result.stages.map((entry) => entry.theme), ["dark", "dark"]);
  assert.deepEqual(result.warnings.map((issue) => [issue.code, issue.path]), [["preview:screenshot", "fuyu.screenshots[2]"]]);
  const html = readFileSync(result.file, "utf8");
  const zh = stage(html, "dark", "zh-CN");
  const page = `data:image/png;base64,${Buffer.from("page").toString("base64")}`;
  assert.ok(zh.includes(`data-market-cover="2"`) && zh.includes(`<img class="market-cover__shot" src="${page}"`));
  assert.match(zh, /<span class="market-cover__count">共 2 张<\/span>/);
  assert.match(zh, /<figcaption>岛上的页面<\/figcaption>/);
  assert.equal(zh.split('<figure class="market-shot">').length - 1, 2);
  assert.match(zh, /<span class="market-card__facts">联网<\/span>/);
  assert.match(zh, /<span class="market-card__sub">开发 · v1\.0\.0<\/span>/);
  assert.match(zh, /class="plugin-verified"/);
  assert.match(zh, /<span class="plugin-dialog__sub"[^>]*>浮屿团队 · 开发<\/span>/);
  assert.match(zh, /<dt>平台<\/dt><dd>Windows · macOS<\/dd>/);
  assert.match(zh, /<div class="markdown market-markdown"><h3>你好<\/h3>\n<p>中文说明。<\/p>/);
  const en = stage(html, "dark", "en");
  assert.match(en, /<p class="market-card__desc">Says &lt;b&gt;hello&lt;\/b&gt; &amp; more<\/p>/);
  assert.match(en, /<div class="markdown market-markdown"><h3>Hello<\/h3>/);
  assert.match(en, /<figcaption>The island page<\/figcaption>/);
});

test("fuyu-plugin preview writes the page, repeats the listing warnings, and rejects a theme it does not know", async () => {
  const dir = hello();
  const done = capture(dir);
  assert.equal(await run(["preview", "--out", "out/card.html", "--locale", "en"], done.io), 0, done.stderr());
  assert.ok(existsSync(join(dir, "out", "card.html")));
  assert.match(done.stdout(), /wrote out[\\/]card\.html \(dark en, light en\)/);
  assert.match(done.stderr(), /warning: fuyu\.screenshots: no screenshots/);
  const bad = capture(dir);
  assert.equal(await run(["preview", "--theme", "sepia"], bad.io), 1);
  assert.match(bad.stderr(), /--theme is dark or light/);
});

test("--png saves one image per view", async (t) => {
  try {
    findBrowser();
  } catch {
    return t.skip("no Chrome, Edge or Chromium on this machine");
  }
  const result = await preview(hello(), { png: true, locale: "en" });
  assert.deepEqual(result.images.map((image) => [image.theme, image.locale]), [["dark", "en"], ["light", "en"]]);
  for (const image of result.images) {
    const bytes = readFileSync(image.file);
    assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG");
    assert.ok(bytes.readUInt32BE(16) >= 2 * 860, `${image.file} is ${bytes.readUInt32BE(16)}px wide`);
  }
});
