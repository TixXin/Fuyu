import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { marketV1 } from "@fuyu/plugin-services";
import { packFiles, sha256Hex } from "../../packages/plugin-manifest/src/index.mjs";
import { publicKeyOf, signCommit, signText } from "../../packages/plugin-market/src/index.mjs";
import { createMarketService } from "../../src/features/updater/host/market.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-18T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

function makeKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, entry: publicKeyOf(privateKey) };
}

function signDoc(doc, privateKey) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  return { text, sigText: `${JSON.stringify(signText(text, privateKey), null, 2)}\n` };
}

const textRes = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

function makeManualFuyuZip() {
  const pkg = {
    name: "@localdev/notes-helper",
    version: "0.2.0",
    type: "module",
    author: { name: "Local Dev", email: "dev@local.example" },
    license: "Apache-2.0",
    homepage: "https://notes.local.example",
    repository: { type: "git", url: "git+https://github.com/localdev/notes-helper.git" },
    bugs: { url: "https://github.com/localdev/notes-helper/issues" },
    funding: [{ url: "https://github.com/sponsors/localdev" }],
    keywords: ["notes", "markdown"],
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "笔记助手", en: "Notes Helper" },
      description: { "zh-CN": "本地笔记增强", en: "Local notes helper" },
      categories: ["productivity"],
      icon: "assets/icon.svg",
      platforms: ["windows", "macos"],
      preview: true,
      host: "dist/host.js",
      network: ["notes.local.example"],
      nodeApis: ["node:fs"],
      provides: ["notes-helper/v1"],
      replaces: [],
      slots: ["settings.section/v1"],
      requires: { "@fuyu/base": "^1.0.0" },
      inject: { required: [], optional: [] },
      commands: [{ id: "quick-note", title: { "zh-CN": "快速笔记", en: "Quick note" }, keybinding: "Ctrl+Shift+N" }],
      builtWith: "2.0.0",
    },
  };
  const { zip } = packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "README.zh-CN.md", data: "# 笔记助手\n\n离线中文说明。\n" },
    { path: "README.md", data: "# Notes Helper\n\nOffline English README.\n" },
    { path: "CHANGELOG.md", data: "## 0.2.0\n\n- Offline support\n" },
    { path: "assets/icon.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" },
    { path: "dist/host.js", data: "export const name = 'notes-helper';\nexport function apply() {}\n" },
  ]);
  return { zip, sha256: sha256Hex(zip) };
}

test("details resolves localized README with fallback, CHANGELOG, pinned commit screenshots, capabilities, likes, and newest-first versions", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-details-"));
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const authorKey = makeKey();
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    const indexUrl = "https://market.example/index.v3.json";
    const commitV100 = "a".repeat(40);
    const commitV120 = "b".repeat(40);
    const commitOfficial = "c".repeat(40);

    const makeClockVersion = (version, commit, publishedAt, urgent) => ({
      version, repository: "https://github.com/someone/clock", commit,
      engines: { fuyu: ">=0.3.10" }, platforms: ["windows", "macos"],
      url: `https://market.example/someone-clock-${version}.fuyu`, sha256: "1".repeat(64),
      size: version === "1.2.0" ? 4096 : 2048, publishedAt, reviewedAt: publishedAt, ...(urgent ? { urgent } : {}),
      authorSignature: signCommit({ name: "@someone/clock", version, repository: "https://github.com/someone/clock", commit }, authorKey.privateKey),
      manifest: {
        displayName: { "zh-CN": "时钟", en: "Clock" }, description: { "zh-CN": "悬浮岛时钟", en: "Island clock" },
        author: "Someone", license: "MIT", homepage: "https://clock.example",
        bugs: "https://github.com/someone/clock/issues", funding: "https://github.com/sponsors/someone",
        keywords: ["clock", "time"], categories: ["utilities"], preview: false,
        requires: { "@fuyu/pomodoro": "^1.0.0" }, nodeApis: ["node:crypto"], network: ["api.clock.example"],
        provides: ["clock/v1"], replaces: ["legacy-clock/v1"], slots: ["island.page/v1", "island.collapsed/v1"],
        inject: { required: [], optional: [] },
        commands: [{ id: "toggle", title: { "zh-CN": "切换时钟", en: "Toggle clock" }, keybinding: "Alt+C" }],
        screenshots: [
          { path: "assets/shot-1.png", caption: { "zh-CN": "主视图", en: "Main view" } },
          { url: "https://cdn.example/shot-2.png", caption: { "zh-CN": "设置页", en: "Settings" } },
        ],
      },
      icon: { url: "https://market.example/icon.png", sha256: "2".repeat(64) },
    });

    const officialEntry = {
      version: "1.0.0", repository: "https://github.com/TixXin/fuyu", commit: commitOfficial,
      engines: { fuyu: ">=0.3.10" }, platforms: ["windows", "macos"],
      url: "https://market.example/fuyu-pomodoro-1.0.0.fuyu", sha256: "3".repeat(64), size: 3072,
      publishedAt: iso(NOW - 5 * DAY), reviewedAt: iso(NOW - 5 * DAY),
      manifest: {
        displayName: { "zh-CN": "番茄钟", en: "Pomodoro" }, description: { "zh-CN": "专注计时", en: "Focus timer" },
        license: "MIT", categories: ["productivity"], nodeApis: [], network: [], provides: [], replaces: [],
        slots: ["island.page/v1"], inject: { required: [], optional: [] }, commands: [],
        screenshots: [{ path: "assets/pomo.png" }],
      },
      icon: { url: "https://market.example/pomo.png", sha256: "4".repeat(64) },
    };

    const signed = signDoc({
      format: 3, serial: 1, generatedAt: iso(NOW - DAY), expires: iso(NOW + 6 * DAY),
      plugins: [
        {
          name: "@someone/clock", publisher: { github: "someone", official: false }, likes: 42, authorKeys: [authorKey.entry],
          versions: [
            makeClockVersion("1.0.0", commitV100, iso(NOW - 10 * DAY), undefined),
            makeClockVersion("1.2.0", commitV120, iso(NOW - 1 * DAY), { reason: { "zh-CN": "修复崩溃", en: "Crash fix" } }),
          ],
        },
        { name: "@fuyu/pomodoro", publisher: { github: "TixXin", official: true }, stars: 128, authorKeys: [], versions: [officialEntry] },
      ],
    }, indexKey.privateKey);

    const routes = new Map([
      [indexUrl, () => textRes(signed.text)],
      [`${indexUrl}.sig`, () => textRes(signed.sigText)],
      [`https://raw.githubusercontent.com/someone/clock/${commitV120}/README.zh-CN.md`, () => textRes("# 时钟插件\n")],
      [`https://raw.githubusercontent.com/someone/clock/${commitV120}/README.md`, () => textRes("# Clock Plugin\n")],
      [`https://raw.githubusercontent.com/someone/clock/${commitV120}/CHANGELOG.md`, () => textRes("## 1.2.0\n- Urgent fix\n")],
      [`https://raw.githubusercontent.com/TixXin/fuyu/${commitOfficial}/plugins/v3/official/pomodoro/README.md`, () => textRes("# Pomodoro\n")],
    ]);

    const market = createMarketService({
      dataDir, pluginsDir: root, appVersion: "0.3.11", platform: "macos", trust,
      fetchImpl: async (url) => (routes.get(String(url)) ?? (() => textRes("not found", 404)))(),
      indexUrl, revokedUrl: "https://market.example/revoked.v3.json", now: NOW,
    });

    await market.refresh();
    const zhDetails = await market.details({ name: "@someone/clock", locale: "zh-CN" });
    assert.equal(zhDetails.name, "@someone/clock");
    assert.equal(zhDetails.official, false);
    assert.equal(zhDetails.publisherName, "someone");
    assert.equal(zhDetails.author, "Someone");
    assert.equal(zhDetails.license, "MIT");
    assert.equal(zhDetails.homepage, "https://clock.example");
    assert.equal(zhDetails.repository, "https://github.com/someone/clock");
    assert.equal(zhDetails.bugs, "https://github.com/someone/clock/issues");
    assert.equal(zhDetails.funding, "https://github.com/sponsors/someone");
    assert.deepEqual(zhDetails.keywords, ["clock", "time"]);
    assert.deepEqual(zhDetails.categories, ["utilities"]);
    assert.deepEqual(zhDetails.platforms, ["windows", "macos"]);
    assert.equal(zhDetails.preview, false);
    assert.equal(zhDetails.likes, 42);
    assert.equal(zhDetails.installedVersion, null);
    assert.equal(zhDetails.latestVersion, "1.2.0");
    assert.equal(zhDetails.readme, "# 时钟插件\n");
    assert.equal(zhDetails.changelog, "## 1.2.0\n- Urgent fix\n");
    assert.deepEqual(zhDetails.screenshots, [
      { url: `https://raw.githubusercontent.com/someone/clock/${commitV120}/assets/shot-1.png`, caption: { "zh-CN": "主视图", en: "Main view" } },
      { url: "https://cdn.example/shot-2.png", caption: { "zh-CN": "设置页", en: "Settings" } },
    ]);
    assert.deepEqual(zhDetails.commands, [{ id: "toggle", title: { "zh-CN": "切换时钟", en: "Toggle clock" }, keybinding: "Alt+C" }]);
    assert.deepEqual(zhDetails.slots, ["island.page/v1", "island.collapsed/v1"]);
    assert.deepEqual(zhDetails.provides, ["clock/v1"]);
    assert.deepEqual(zhDetails.replaces, ["legacy-clock/v1"]);
    assert.deepEqual(zhDetails.network, ["api.clock.example"]);
    assert.deepEqual(zhDetails.nodeApis, ["node:crypto"]);
    assert.deepEqual(zhDetails.requires, { "@fuyu/pomodoro": "^1.0.0" });
    assert.deepEqual(zhDetails.versions.map((v) => v.version), ["1.2.0", "1.0.0"]);
    assert.equal(zhDetails.versions[0].urgent, true);
    assert.equal(zhDetails.versions[0].reviewed, true);
    assert.equal(zhDetails.versions[0].size, 4096);
    assert.equal(zhDetails.versions[0].enginesFuyu, ">=0.3.10");
    assert.equal(zhDetails.versions[1].urgent, false);

    const enDetails = await market.details({ name: "@someone/clock", locale: "en-US" });
    assert.equal(enDetails.readme, "# Clock Plugin\n");

    const pomoZhFallback = await market.details({ name: "@fuyu/pomodoro", locale: "zh-CN" });
    assert.equal(pomoZhFallback.official, true);
    assert.equal(pomoZhFallback.likes, 128);
    assert.equal(pomoZhFallback.readme, "# Pomodoro\n");
    assert.equal(pomoZhFallback.changelog, null);
    assert.deepEqual(pomoZhFallback.screenshots, [
      { url: `https://raw.githubusercontent.com/TixXin/fuyu/${commitOfficial}/plugins/v3/official/pomodoro/assets/pomo.png` },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("details reads local manual .fuyu docs and metadata offline without network calls, and degrades gracefully when offline", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-offline-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-market-details-host-"));
  let host = null;
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const authorKey = makeKey();
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    const indexUrl = "https://market.example/index.v3.json";
    const commit = "d".repeat(40);

    const signed = signDoc({
      format: 3, serial: 1, generatedAt: iso(NOW - DAY), expires: iso(NOW + 6 * DAY),
      plugins: [{
        name: "@someone/offline-plugin", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry],
        versions: [{
          version: "1.0.0", repository: "https://github.com/someone/offline-plugin", commit,
          engines: { fuyu: ">=0.3.10" }, platforms: ["windows", "macos"],
          url: "https://market.example/offline-1.0.0.fuyu", sha256: "5".repeat(64), size: 1024,
          publishedAt: iso(NOW - 5 * DAY), reviewedAt: iso(NOW - 5 * DAY),
          authorSignature: signCommit({ name: "@someone/offline-plugin", version: "1.0.0", repository: "https://github.com/someone/offline-plugin", commit }, authorKey.privateKey),
          manifest: {
            displayName: { "zh-CN": "离线测试", en: "Offline Test" }, description: { "zh-CN": "断网回退", en: "Offline fallback" },
            license: "MIT", nodeApis: [], network: [], provides: [], replaces: [], slots: [], inject: { required: [], optional: [] }, commands: [],
          },
          icon: { url: "https://market.example/icon.png", sha256: "6".repeat(64) },
        }],
      }],
    }, indexKey.privateKey);

    let online = true;
    const fetchCalls = [];
    const fetchImpl = async (url) => {
      fetchCalls.push(String(url));
      if (!online) throw new Error("network unreachable");
      if (url === indexUrl) return textRes(signed.text);
      if (url === `${indexUrl}.sig`) return textRes(signed.sigText);
      return textRes("not found", 404);
    };

    const market = createMarketService({
      dataDir, pluginsDir: root, appVersion: "0.3.11", platform: "macos", trust, fetchImpl,
      indexUrl, revokedUrl: "https://market.example/revoked.v3.json", now: NOW,
    });

    await market.refresh();
    await market.setManualAllowed({ allowed: true });
    const manualPkg = makeManualFuyuZip();
    await market.installFile({ base64: manualPkg.zip.toString("base64"), expectedSha256: manualPkg.sha256 });

    online = false;
    fetchCalls.length = 0;

    const localZh = await market.details({ name: "@localdev/notes-helper", locale: "zh-CN" });
    assert.deepEqual(fetchCalls, []);
    assert.equal(localZh.installedVersion, "0.2.0");
    assert.equal(localZh.latestVersion, "0.2.0");
    assert.equal(localZh.official, false);
    assert.equal(localZh.author, "Local Dev <dev@local.example>");
    assert.equal(localZh.license, "Apache-2.0");
    assert.equal(localZh.homepage, "https://notes.local.example");
    assert.equal(localZh.repository, "https://github.com/localdev/notes-helper");
    assert.equal(localZh.bugs, "https://github.com/localdev/notes-helper/issues");
    assert.equal(localZh.funding, "https://github.com/sponsors/localdev");
    assert.deepEqual(localZh.keywords, ["notes", "markdown"]);
    assert.equal(localZh.preview, true);
    assert.equal(localZh.likes, null);
    assert.equal(localZh.readme, "# 笔记助手\n\n离线中文说明。\n");
    assert.equal(localZh.changelog, "## 0.2.0\n\n- Offline support\n");
    assert.deepEqual(localZh.requires, { "@fuyu/base": "^1.0.0" });
    assert.equal(localZh.versions.length, 1);
    assert.equal(localZh.versions[0].version, "0.2.0");

    const localEn = await market.details({ name: "@localdev/notes-helper", locale: "en" });
    assert.deepEqual(fetchCalls, []);
    assert.equal(localEn.readme, "# Notes Helper\n\nOffline English README.\n");

    const uninstalledOffline = await market.details({ name: "@someone/offline-plugin", locale: "en" });
    assert.equal(uninstalledOffline.name, "@someone/offline-plugin");
    assert.equal(uninstalledOffline.readme, null);
    assert.equal(uninstalledOffline.changelog, null);
    assert.equal(uninstalledOffline.likes, null);

    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({ format: 1, plugins: [{ id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] }] }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
    writeFileSync(join(builtinsDir, "updater", "host", "index.mjs"), `export { name, apply } from ${JSON.stringify(entryUrl)};\n`);

    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.11" });
    await host.settle();
    const viaRpc = await host.serviceHub.windowCall(
      "service.call",
      { service: marketV1.name, method: "details", params: { name: "@localdev/notes-helper", locale: "en" } },
      "settings",
    );
    assert.equal(viaRpc.name, "@localdev/notes-helper");
    assert.equal(viaRpc.readme, "# Notes Helper\n\nOffline English README.\n");
  } finally {
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
});

test("details throws not-found for unknown plugin names and bad-params for invalid input", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-missing-"));
  try {
    const market = createMarketService({
      dataDir: join(root, "data", "updater"),
      pluginsDir: root,
      appVersion: "0.3.11",
      platform: "macos",
      fetchImpl: async () => textRes("not found", 404),
      now: NOW,
    });
    await assert.rejects(() => market.details({ name: "@unknown/missing" }), (err) => err.code === "not-found");
    await assert.rejects(() => market.details({ name: "" }), (err) => err.code === "bad-params");
    await assert.rejects(() => market.details(null), (err) => err.code === "bad-params");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
