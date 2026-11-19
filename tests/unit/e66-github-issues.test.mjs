import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../../packages/plugin-cli/src/index.mjs";
import { issuesUrl, repoFromApiUrl } from "../../plugins/v3/official/github-issues/src/github.ts";
import { apply } from "../../plugins/v3/official/github-issues/src/host.ts";
import {
  DEFAULT_SETTINGS,
  METHODS,
  normalizeLabels,
  normalizeSettings,
  openTotal,
  parseRepo,
  relativeAge,
  visibleItems,
} from "../../plugins/v3/official/github-issues/src/model.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/github-issues", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-github-issues-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function reply(status, body, { headers = {}, url = "", redirected = false } = {}) {
  const response = new Response(status === 304 ? null : JSON.stringify(body), {
    status,
    headers: { "x-ratelimit-remaining": "55", "x-ratelimit-limit": "60", "x-ratelimit-reset": "2000000000", ...headers },
  });
  Object.defineProperty(response, "url", { value: url });
  Object.defineProperty(response, "redirected", { value: redirected });
  return response;
}

function fakeContext(dataDir, settings) {
  const handlers = new Map();
  const commands = new Map();
  const notices = [];
  const ctx = {
    dataDir,
    clients: { handle: (method, fn) => handlers.set(method, fn), publish: () => {} },
    commands: { register: (id, fn, meta) => commands.set(id, { fn, meta }) },
    services: { get: () => ({ notify: async (notice) => notices.push(notice) }) },
    setTimeout: () => () => {},
    setInterval: () => async () => {},
  };
  if (settings) ctx.settings = settings;
  return { ctx, call: (method, params) => handlers.get(method)(params), commands, notices };
}

const issue = (number, extra = {}) => ({
  number,
  title: `Issue ${number}`,
  html_url: `https://github.com/a/b/issues/${number}`,
  updated_at: "2026-11-16T10:00:00Z",
  comments: 2,
  user: { login: "someone" },
  repository_url: "https://api.github.com/repos/a/b",
  ...extra,
});

test("1.0.0 settings carry over: the repo text box becomes a list, new settings default", () => {
  const old = { reposText: "TixXin/fuyu, denoland/deno  bad repo tixxin/FUYU", refreshMinutes: 30, notifyNew: true, locale: "en" };
  const settings = normalizeSettings(old);
  assert.deepEqual(settings.repos, ["TixXin/fuyu", "denoland/deno"]);
  assert.equal(settings.refreshMinutes, 30);
  assert.equal(settings.notifyNew, true);
  assert.equal("locale" in settings, false);
  assert.equal(settings.perRepo, 10);
  assert.equal(settings.sort, "updated");
  assert.equal(settings.includePulls, false);
  assert.equal(settings.showAuthor, false);
  assert.equal(settings.showUpdated, true);
  assert.equal(settings.showComments, true);
  assert.equal(settings.refreshOnOpen, true);
  assert.equal(settings.showInBar, false);
  assert.deepEqual(normalizeSettings({ repos: ["x/y"], reposText: "a/b" }).repos, ["x/y"]);
  assert.equal(normalizeSettings({ perRepo: 7, sort: "random" }).perRepo, 10);
});

test("repo input accepts owner/repo and GitHub links; labels are cleaned up", () => {
  assert.equal(parseRepo(" TixXin/fuyu "), "TixXin/fuyu");
  assert.equal(parseRepo("https://github.com/denoland/deno/issues?q=1"), "denoland/deno");
  assert.equal(parseRepo("github.com/a/b.git"), "a/b");
  assert.equal(parseRepo("nope"), null);
  assert.equal(normalizeLabels(" bug, ,Bug, help wanted "), "bug, help wanted");
  const url = new URL(issuesUrl("a/b", "comments", "bug, help wanted"));
  assert.equal(url.searchParams.get("sort"), "comments");
  assert.equal(url.searchParams.get("labels"), "bug,help wanted");
  assert.equal(url.searchParams.get("state"), "open");
  assert.equal(repoFromApiUrl("https://api.github.com/repos/vercel/next.js"), "vercel/next.js");
});

test("pull requests stay out unless turned on; relative age reads like 3 days ago", () => {
  const items = [{ number: 1, pull: false }, { number: 2, pull: true }];
  assert.deepEqual(visibleItems(items, DEFAULT_SETTINGS).map((i) => i.number), [1]);
  assert.deepEqual(visibleItems(items, { ...DEFAULT_SETTINGS, includePulls: true }).map((i) => i.number), [1, 2]);
  const at = Date.parse("2026-11-19T10:00:00Z");
  assert.deepEqual(relativeAge("2026-11-16T09:00:00Z", at), { unit: "day", n: 3 });
  assert.deepEqual(relativeAge("2026-11-19T09:30:00Z", at), { unit: "minute", n: 30 });
  assert.equal(relativeAge("", at), null);
  assert.deepEqual(openTotal([{ items: [1, 2], more: false }, { items: [3], more: true }]), { count: 3, more: true });
});

test("host: add checks the repo exists, follows renames (301) and registers the refresh command", async () => {
  const dataDir = join(scratch, "host");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "config.json"), JSON.stringify({ reposText: "zeit/next.js", refreshMinutes: 15, notifyNew: false, locale: "zh-CN" }));

  const seen = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    seen.push(url);
    if (url.includes("/repos/zeit/next.js/issues")) {
      return reply(200, [issue(5, { repository_url: "https://api.github.com/repos/vercel/next.js" }), issue(6, { pull_request: {} })], {
        url: "https://api.github.com/repositories/1/issues",
        redirected: true,
      });
    }
    if (url.includes("/repos/vercel/next.js/issues")) return reply(200, [issue(5), issue(7)]);
    if (url.endsWith("/repos/nobody/nothing")) return reply(404, { message: "Not Found" });
    if (url.endsWith("/repos/tixxin/fuyu")) return reply(200, { full_name: "TixXin/fuyu" });
    if (url.includes("/repos/TixXin/fuyu/issues")) return reply(200, []);
    throw new Error(`unexpected ${url}`);
  };

  const { ctx, call, commands, notices } = fakeContext(dataDir);
  apply(ctx);
  assert.equal(commands.has("refresh"), true);
  assert.deepEqual(commands.get("refresh").meta.title, { "zh-CN": "立即刷新", en: "Refresh now" });

  const first = await call(METHODS.refresh);
  assert.deepEqual(first.settings.repos, ["vercel/next.js"], "the renamed repository is followed, not shown as failed");
  assert.equal(first.groups[0].error, null);
  assert.deepEqual(first.groups[0].items.map((item) => item.number), [5], "pull requests are hidden by default");
  const saved = JSON.parse(readFileSync(join(dataDir, "config.json"), "utf8"));
  assert.deepEqual(saved.repos, ["vercel/next.js"]);
  assert.equal(saved.reposText, "vercel/next.js");

  assert.deepEqual(await call(METHODS.addRepo, { repo: "nobody/nothing" }), { ok: false, reason: "notFound" });
  assert.deepEqual(await call(METHODS.addRepo, { repo: "not a repo" }), { ok: false, reason: "format" });
  assert.deepEqual(await call(METHODS.addRepo, { repo: "https://github.com/tixxin/fuyu" }), { ok: true, repo: "TixXin/fuyu" });
  assert.deepEqual(await call(METHODS.addRepo, { repo: "TIXXIN/FUYU" }), { ok: false, reason: "duplicate" });

  await call(METHODS.setSettings, { notifyNew: true, repos: ["ignored/here"] });
  const again = await commands.get("refresh").fn();
  assert.deepEqual(again.settings.repos, ["vercel/next.js", "TixXin/fuyu"]);
  assert.equal(notices.length, 1);
  assert.match(notices[0].body, /#7/);

  const removed = await call(METHODS.removeRepo, { repo: "TixXin/fuyu" });
  assert.deepEqual(removed.settings.repos, ["vercel/next.js"]);
  const soft = seen.length;
  await call(METHODS.refresh, { soft: true });
  assert.equal(seen.length, soft, "opening the page right after a refresh does not fetch again");
});

test("host: reports that a repository is still needed, and stops once one is added", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/repos/acme/web-app")) return reply(200, { full_name: "acme/web-app" });
    if (url.includes("/repos/acme/web-app/issues")) return reply(200, []);
    throw new Error(`unexpected ${url}`);
  };
  const emptyDir = (label) => {
    const dir = join(scratch, label);
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  const reports = [];
  const { ctx, call } = fakeContext(emptyDir("setup"), { setup: async (state) => void reports.push(state) });
  apply(ctx);
  assert.deepEqual(reports, [{ needed: true, hint: { "zh-CN": "添加要关注的仓库", en: "Add a repository to follow" } }]);

  assert.deepEqual(await call(METHODS.addRepo, { repo: "acme/web-app" }), { ok: true, repo: "acme/web-app" });
  assert.equal(reports.at(-1).needed, false, "with a repository in the list nothing is missing");

  await call(METHODS.removeRepo, { repo: "acme/web-app" });
  assert.equal(reports.at(-1).needed, true, "removing the last repository asks for one again");

  const old = fakeContext(emptyDir("setup-old-fuyu"));
  assert.doesNotThrow(() => apply(old.ctx), "a Fuyu without ctx.settings still starts the plugin");
  assert.deepEqual(await old.call(METHODS.addRepo, { repo: "acme/web-app" }), { ok: true, repo: "acme/web-app" });

  const failing = fakeContext(emptyDir("setup-failing"), { setup: () => Promise.reject(new Error("not-ready")) });
  assert.doesNotThrow(() => apply(failing.ctx));
  assert.deepEqual(await failing.call(METHODS.addRepo, { repo: "acme/web-app" }), { ok: true, repo: "acme/web-app" });
  await new Promise((resolve) => setImmediate(resolve));
});

test("manifest: GitHub Issues in both languages, 1.1.0, refresh command wired, check passes", async () => {
  const manifest = JSON.parse(readFileSync(join(PLUGIN_DIR, "package.json"), "utf8"));
  assert.equal(manifest.version, "1.1.0");
  assert.deepEqual(manifest.fuyu.displayName, { "zh-CN": "GitHub Issues", en: "GitHub Issues" });
  assert.equal(manifest.description, manifest.fuyu.description.en);
  assert.ok(manifest.fuyu.inject.required.includes("commands"));
  assert.deepEqual(manifest.fuyu.inject.optional, ["settings"], "settings stays optional so older versions of Fuyu still start the plugin");
  assert.ok(manifest.fuyu.slots.includes("island.collapsed/v1"));
  assert.ok(manifest.fuyu.screenshots.length >= 1);
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const island = readFileSync(join(PLUGIN_DIR, "src/island.tsx"), "utf8");
  assert.match(island, /opens: PAGE_ID/);
  assert.match(island, /title: PAGE_TITLE/);
});
