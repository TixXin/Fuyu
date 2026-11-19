import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check, lintListing, run } from "../../packages/plugin-cli/src/index.mjs";

const HELLO = fileURLToPath(new URL("../../packages/plugin-cli/test/fixtures/hello", import.meta.url));
const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const PENDING = {
  "listing:screenshots": ["ecdict", "now-playing", "system-monitor", "todo-digest"],
};

const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-lint-"));
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
    io: { cwd, env: {}, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}

const codes = (issues) => issues.map((issue) => issue.code);

function listing(edit) {
  const dir = hello((pkg, folder) => {
    pkg.fuyu.screenshots = [{ path: "assets/page.png" }];
    edit(pkg, folder);
  });
  return lintListing(dir, JSON.parse(readFileSync(join(dir, "package.json"), "utf8")));
}

test("a plugin without a screenshot gets a warning from check, an error with --strict, and nothing once it lists one", async () => {
  const bare = hello();
  const warned = capture(bare);
  assert.equal(await run(["check"], warned.io), 0, warned.stderr());
  assert.match(warned.stderr(), /warning: fuyu\.screenshots: no screenshots.*\[listing:screenshots\]/);
  const strict = capture(bare);
  assert.equal(await run(["check", "--strict"], strict.io), 1);
  assert.match(strict.stderr(), /error: fuyu\.screenshots: no screenshots/);

  const quiet = await check(bare);
  assert.deepEqual(codes(quiet.warnings), []);
  const asError = await check(bare, { listing: "error" });
  assert.equal(asError.ok, false);
  assert.deepEqual(codes(asError.errors), ["listing:screenshots"]);

  const shown = hello((pkg, dir) => {
    pkg.fuyu.screenshots = [{ path: "assets/page.png" }];
    writeFileSync(join(dir, "assets", "page.png"), "png");
  });
  const clean = await check(shown, { listing: "error" });
  assert.deepEqual(clean.errors, []);
  assert.deepEqual(codes(clean.warnings), []);
});

test("official plugins pass the listing checks, except the ones still waiting for E77.6", () => {
  const found = {};
  for (const slug of readdirSync(OFFICIAL_ROOT).sort()) {
    const dir = join(OFFICIAL_ROOT, slug);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    for (const issue of lintListing(dir, manifest)) {
      const slugs = (found[issue.code] ??= []);
      if (!slugs.includes(slug)) slugs.push(slug);
    }
  }
  assert.deepEqual(found, PENDING);
});

test("a description longer than the two lines of a market card is flagged per language, one that fits is not", () => {
  assert.deepEqual(listing(() => {}), []);
  const long = listing((pkg) => {
    pkg.fuyu.description["zh-CN"] = "在岛上打个招呼".repeat(9);
  });
  assert.deepEqual(long.map((issue) => [issue.code, issue.path]), [["listing:description-length", "fuyu.description.zh-CN"]]);
  const fits = listing((pkg) => {
    pkg.fuyu.description["zh-CN"] = "一键或定时把还没做完的待办写进今天的笔记，收工前顺手做个记录。";
    pkg.fuyu.description.en = "Writes your unfinished to-dos into today's note in one click or at a set time, a quick wrap-up before you stop for the day.";
    pkg.description = pkg.fuyu.description.en;
  });
  assert.deepEqual(fits, []);
  const english = listing((pkg) => {
    pkg.fuyu.description.en = "CPU, GPU, memory, network, battery and the busiest programs on the island, with 5-minute charts and a collapsed bar that turns yellow or red.";
    pkg.description = pkg.fuyu.description.en;
  });
  assert.deepEqual(english.map((issue) => [issue.code, issue.path]), [["listing:description-length", "fuyu.description.en"]]);
});

test("a description that says how the plugin is built or set up is flagged, one that says what it does is not", () => {
  for (const text of ["基于 Node 原生接口读取系统状态", "看天气，免 API Key", "看仓库的 issue，在设置中配置 owner/repo"]) {
    const found = listing((pkg) => {
      pkg.fuyu.description["zh-CN"] = text;
    });
    assert.deepEqual(found.map((issue) => [issue.code, issue.path]), [["listing:description-how", "fuyu.description.zh-CN"]], text);
  }
  for (const text of ["Weather on the island, powered by Open-Meteo", "Shows open issues. Configure the repositories in settings"]) {
    const found = listing((pkg) => {
      pkg.fuyu.description.en = text;
      pkg.description = text;
    });
    assert.deepEqual(codes(found), ["listing:description-how"], text);
  }
  const plain = listing((pkg) => {
    pkg.fuyu.description["zh-CN"] = "在岛上看你关注的 GitHub 仓库还有哪些没关的 issue，按仓库分好组。";
  });
  assert.deepEqual(plain, []);
});

test("the top-level description has to be the English description", () => {
  const found = listing((pkg) => {
    pkg.description = "A greeting";
  });
  assert.deepEqual(found.map((issue) => [issue.code, issue.path]), [["listing:description-mismatch", "description"]]);
});

test("the README is there and its title carries the plugin's name", () => {
  const missing = listing((pkg, dir) => rmSync(join(dir, "README.md")));
  assert.deepEqual(codes(missing), ["listing:readme"]);
  const renamed = listing((pkg, dir) => writeFileSync(join(dir, "README.md"), "# Greeter\r\n\r\nSays hello.\r\n"));
  assert.deepEqual(renamed.map((issue) => [issue.code, issue.file]), [["listing:name-readme", "README.md"]]);
  assert.match(renamed[0].message, /"Greeter".*"你好" or "Hello"/);
  const both = listing((pkg, dir) => writeFileSync(join(dir, "README.md"), "# 你好 · Hello\n"));
  assert.deepEqual(both, []);
  const translated = listing((pkg, dir) => writeFileSync(join(dir, "README.zh-CN.md"), "# Hello\n"));
  assert.deepEqual(translated.map((issue) => [issue.code, issue.file]), [["listing:name-readme", "README.zh-CN.md"]]);
});

test("the island page is titled with the plugin's name, wherever the title is written", () => {
  const page = (title, extra = "") => (pkg, dir) =>
    writeFileSync(join(dir, "src", "page.tsx"), `${extra}\nexport function add(ctx) {\n  ctx.slots.add("island.page/v1", { id: "hello", title: ${title}, component: () => null });\n}\n`);
  assert.deepEqual(listing(page('{ "zh-CN": "你好", en: "Hello" }')), []);
  const inline = listing(page('{ "zh-CN": "你好", en: "Greeter" }'));
  assert.deepEqual(inline.map((issue) => [issue.code, issue.path]), [["listing:name-page", "fuyu.displayName.en"]]);
  assert.match(inline[0].message, /"Greeter".*"Hello"/);
  const viaConstants = listing(
    page("PAGE_TITLE", 'const en = { note: "say it as it is", title: "Hello" };\nconst zhCN: typeof en = { note: "x", title: "问候" };\nexport const PAGE_TITLE = { "zh-CN": zhCN.title, en: en.title } as const;'),
  );
  assert.deepEqual(viaConstants.map((issue) => [issue.code, issue.path]), [["listing:name-page", "fuyu.displayName.zh-CN"]]);
  assert.deepEqual(listing(page("titleFor(locale)")), []);
});
