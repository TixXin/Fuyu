import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { packFiles, sha256Hex } from "../../packages/plugin-manifest/src/index.mjs";
import { endorseKey, publicKeyOf, signCommit, signText } from "../../packages/plugin-market/src/index.mjs";
import { createMarketService } from "../../src/features/updater/host/market.mjs";
import { readState } from "../../src/features/updater/host/marketStore.mjs";

const DAY = 24 * 60 * 60 * 1000;
const BASE_NOW = Date.parse("2026-11-18T12:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

function makeKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, entry: publicKeyOf(privateKey) };
}

function makeFuyuZip({ name = "@someone/clock", version = "1.0.0", repository = `https://github.com/${name.slice(1)}`, official = false, requires } = {}) {
  const pkg = {
    name, version, type: "module", license: "MIT",
    repository: official ? "https://github.com/TixXin/fuyu" : repository,
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1, displayName: { "zh-CN": name, en: name }, description: { "zh-CN": "测试插件", en: "Test plugin" },
      categories: ["utilities"], icon: "assets/icon.svg", platforms: ["windows", "macos"], host: "dist/host.js",
      ...(requires ? { requires } : {}), network: [], nodeApis: [], provides: [], replaces: [], slots: [],
      inject: { required: [], optional: [] }, commands: [], builtWith: "2.0.0",
    },
  };
  const { zip } = packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "assets/icon.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" },
    { path: "dist/host.js", data: `export const name = ${JSON.stringify(name)};\nexport function apply() {}\n` },
  ]);
  return { zip, sha256: sha256Hex(zip), pkg };
}

function makeIndexVersion({ name, version, repository, author, zipInfo, publishedAt, official = false, urgent, commitSeed = "1" }) {
  const repo = official ? "https://github.com/TixXin/fuyu" : (repository ?? `https://github.com/${name.slice(1)}`);
  const commit = commitSeed.repeat(40).slice(0, 40);
  const fuyu = zipInfo.pkg.fuyu;
  const entry = {
    version, repository: repo, commit, engines: { fuyu: ">=0.3.10" }, platforms: ["windows", "macos"],
    url: `https://market.example/${name.replace("@", "").replace("/", "-")}-${version}.fuyu`,
    sha256: zipInfo.sha256, size: zipInfo.zip.length, publishedAt, reviewedAt: publishedAt, ...(urgent ? { urgent } : {}),
    manifest: {
      displayName: fuyu.displayName, description: fuyu.description, license: "MIT",
      ...(fuyu.requires ? { requires: fuyu.requires } : {}),
      nodeApis: fuyu.nodeApis, network: fuyu.network, provides: fuyu.provides, replaces: fuyu.replaces,
      slots: fuyu.slots, inject: fuyu.inject, commands: [],
    },
    icon: { url: "https://market.example/icon.png", sha256: "b".repeat(64) },
  };
  if (!official && author) entry.authorSignature = signCommit({ name, version, repository: repo, commit }, author.privateKey);
  return entry;
}

function signDoc(doc, privateKey) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  return { text, sigText: `${JSON.stringify(signText(text, privateKey), null, 2)}\n` };
}

function mockFetch(routes) {
  return async (url) => {
    const handler = routes.get(String(url));
    if (!handler) return { ok: false, status: 404, text: async () => "not found", arrayBuffer: async () => new ArrayBuffer(0) };
    return handler();
  };
}

const textRes = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });
const binRes = (buf, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
});

test("refresh silently auto-updates only after 3-day cooldown or when urgent, and tolerates transient download errors", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-auto-"));
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const authorKey = makeKey();
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    const indexUrl = "https://market.example/index.v3.json";
    const revokedUrl = "https://market.example/revoked.v3.json";
    const routes = new Map();
    let currentNow = BASE_NOW;

    const v100 = makeFuyuZip({ name: "@someone/clock", version: "1.0.0" });
    const v110 = makeFuyuZip({ name: "@someone/clock", version: "1.1.0" });
    const v120 = makeFuyuZip({ name: "@someone/clock", version: "1.2.0" });

    const e100 = makeIndexVersion({ name: "@someone/clock", version: "1.0.0", author: authorKey, zipInfo: v100, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "1" });
    const e110 = makeIndexVersion({ name: "@someone/clock", version: "1.1.0", author: authorKey, zipInfo: v110, publishedAt: iso(BASE_NOW - 1 * DAY), commitSeed: "2" });
    const e120Urgent = makeIndexVersion({
      name: "@someone/clock",
      version: "1.2.0",
      author: authorKey,
      zipInfo: v120,
      publishedAt: iso(BASE_NOW + 3 * DAY - 2 * 60 * 60 * 1000),
      urgent: { reason: { "zh-CN": "紧急修复", en: "Urgent fix" } },
      commitSeed: "3",
    });

    routes.set(e100.url, () => binRes(v100.zip));
    routes.set(e110.url, () => binRes(v110.zip));

    const market = createMarketService({
      dataDir,
      pluginsDir: root,
      appVersion: "0.3.11",
      platform: "macos",
      trust,
      fetchImpl: mockFetch(routes),
      indexUrl,
      revokedUrl,
      now: () => currentNow,
    });

    const putIndex = (serial, versions, nowMs) => {
      const signed = signDoc(
        {
          format: 3,
          serial,
          generatedAt: iso(nowMs - 60_000),
          expires: iso(nowMs + 6 * DAY),
          plugins: [{ name: "@someone/clock", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry], versions }],
        },
        indexKey.privateKey,
      );
      routes.set(indexUrl, () => textRes(signed.text));
      routes.set(`${indexUrl}.sig`, () => textRes(signed.sigText));
    };

    putIndex(1, [e100, e110], currentNow);
    await market.refresh();
    await market.installMarket({ name: "@someone/clock", version: "1.0.0" });

    putIndex(2, [e100, e110], currentNow);
    const duringCooldown = await market.refresh();
    assert.equal(duringCooldown.plugins[0].installedVersion, "1.0.0");
    assert.equal(JSON.parse(readFileSync(join(root, "packages", "@someone", "clock", "package.json"), "utf8")).version, "1.0.0");

    currentNow = BASE_NOW + 3 * DAY;
    routes.set(e110.url, () => binRes(Buffer.alloc(0), 503));
    putIndex(3, [e100, e110], currentNow);
    const failedDownload = await market.refresh();
    assert.equal(failedDownload.plugins[0].installedVersion, "1.0.0");

    routes.set(e110.url, () => binRes(v110.zip));
    putIndex(4, [e100, e110], currentNow);
    const afterCooldown = await market.refresh();
    assert.equal(afterCooldown.plugins[0].installedVersion, "1.1.0");
    assert.equal(JSON.parse(readFileSync(join(root, "packages", "@someone", "clock", "package.json"), "utf8")).version, "1.1.0");

    routes.set(e120Urgent.url, () => binRes(v120.zip));
    putIndex(5, [e100, e110, e120Urgent], currentNow);
    const afterUrgent = await market.refresh();
    assert.equal(afterUrgent.plugins[0].installedVersion, "1.2.0");
    assert.equal(JSON.parse(readFileSync(join(root, "packages", "@someone", "clock", "package.json"), "utf8")).version, "1.2.0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("key rotation or repository change blocks silent auto-update, flags trustChange, and updates pin on manual installMarket", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-pin-"));
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const key1 = makeKey();
    const key2Unendorsed = makeKey();
    const key3Raw = makeKey();
    const key3Endorsed = { ...key3Raw, entry: endorseKey("@someone/clock", key3Raw.entry, key1.privateKey) };
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    const indexUrl = "https://market.example/index.v3.json";
    const revokedUrl = "https://market.example/revoked.v3.json";
    const routes = new Map();

    const z100 = makeFuyuZip({ name: "@someone/clock", version: "1.0.0", repository: "https://github.com/someone/clock" });
    const z200 = makeFuyuZip({ name: "@someone/clock", version: "2.0.0", repository: "https://github.com/someone/clock" });
    const z210 = makeFuyuZip({ name: "@someone/clock", version: "2.1.0", repository: "https://github.com/someone/clock" });
    const z300 = makeFuyuZip({ name: "@someone/clock", version: "3.0.0", repository: "https://github.com/someone/clock-next" });

    const e100 = makeIndexVersion({ name: "@someone/clock", version: "1.0.0", repository: "https://github.com/someone/clock", author: key1, zipInfo: z100, publishedAt: iso(BASE_NOW - 20 * DAY), commitSeed: "a" });
    const e200Unendorsed = makeIndexVersion({ name: "@someone/clock", version: "2.0.0", repository: "https://github.com/someone/clock", author: key2Unendorsed, zipInfo: z200, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "b" });
    const e210Endorsed = makeIndexVersion({ name: "@someone/clock", version: "2.1.0", repository: "https://github.com/someone/clock", author: key3Endorsed, zipInfo: z210, publishedAt: iso(BASE_NOW - 8 * DAY), commitSeed: "c" });
    const e300RepoChanged = makeIndexVersion({ name: "@someone/clock", version: "3.0.0", repository: "https://github.com/someone/clock-next", author: key2Unendorsed, zipInfo: z300, publishedAt: iso(BASE_NOW - 6 * DAY), commitSeed: "d" });

    for (const [entry, zipInfo] of [[e100, z100], [e200Unendorsed, z200], [e210Endorsed, z210], [e300RepoChanged, z300]]) {
      routes.set(entry.url, () => binRes(zipInfo.zip));
    }

    const market = createMarketService({
      dataDir,
      pluginsDir: root,
      appVersion: "0.3.11",
      platform: "macos",
      trust,
      fetchImpl: mockFetch(routes),
      indexUrl,
      revokedUrl,
      now: BASE_NOW,
    });

    const putIndex = (serial, versions, authorKeys) => {
      const signed = signDoc(
        {
          format: 3,
          serial,
          generatedAt: iso(BASE_NOW - DAY),
          expires: iso(BASE_NOW + 6 * DAY),
          plugins: [{ name: "@someone/clock", publisher: { github: "someone", official: false }, authorKeys, versions }],
        },
        indexKey.privateKey,
      );
      routes.set(indexUrl, () => textRes(signed.text));
      routes.set(`${indexUrl}.sig`, () => textRes(signed.sigText));
    };

    putIndex(1, [e100], [key1.entry]);
    await market.refresh();
    await market.installMarket({ name: "@someone/clock", version: "1.0.0" });
    assert.deepEqual(readState(dataDir).trustedAuthors["@someone/clock"], {
      keyId: key1.entry.keyId,
      repository: "https://github.com/someone/clock",
    });

    putIndex(2, [e100, e210Endorsed], [key1.entry, key3Endorsed.entry]);
    const endorsedSnap = await market.refresh();
    assert.equal(endorsedSnap.plugins[0].installedVersion, "1.0.0");
    assert.equal(endorsedSnap.plugins[0].autoUpdate, null);
    assert.equal(endorsedSnap.plugins[0].manual.confirmation.trustChange, "endorsed-key");

    putIndex(3, [e100, e200Unendorsed], [key1.entry, key2Unendorsed.entry]);
    const unendorsedSnap = await market.refresh();
    assert.equal(unendorsedSnap.plugins[0].installedVersion, "1.0.0");
    assert.equal(unendorsedSnap.plugins[0].autoUpdate, null);
    assert.equal(unendorsedSnap.plugins[0].manual.trustChange, "unendorsed-key");
    assert.equal(unendorsedSnap.plugins[0].manual.confirmation.trustChange, "unendorsed-key");
    assert.equal(unendorsedSnap.plugins[0].install.confirmation.trustChange, "unendorsed-key");

    const manualUpdate = await market.installMarket({ name: "@someone/clock", version: "2.0.0" });
    assert.equal(manualUpdate.version, "2.0.0");
    assert.equal(manualUpdate.confirmation.trustChange, "unendorsed-key");
    assert.deepEqual(readState(dataDir).trustedAuthors["@someone/clock"], {
      keyId: key2Unendorsed.entry.keyId,
      repository: "https://github.com/someone/clock",
    });

    putIndex(4, [e200Unendorsed, e300RepoChanged], [key2Unendorsed.entry]);
    const repoSnap = await market.refresh();
    assert.equal(repoSnap.plugins[0].installedVersion, "2.0.0");
    assert.equal(repoSnap.plugins[0].autoUpdate, null);
    assert.equal(repoSnap.plugins[0].manual.confirmation.trustChange, "repo-changed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("installMarket recursively installs fuyu.requires dependencies in topological order, guards cycles, and rejects missing deps", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-deps-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-updater-timers-"));
  let host = null;
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const authorKey = makeKey();
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    const indexUrl = "https://market.example/index.v3.json";
    const revokedUrl = "https://market.example/revoked.v3.json";
    const routes = new Map();
    const downloadOrder = [];

    const depBaseZip = makeFuyuZip({ name: "@someone/base", version: "1.2.0", requires: { "@someone/dep": "^1.0.0" } });
    const depZip = makeFuyuZip({ name: "@someone/dep", version: "1.1.0", requires: { "@someone/base": "^1.0.0" } });
    const depV2Zip = makeFuyuZip({ name: "@someone/dep", version: "2.0.0" });
    const appZip = makeFuyuZip({ name: "@someone/app", version: "1.0.0", requires: { "@someone/dep": "^1.0.0" } });
    const appV2Zip = makeFuyuZip({ name: "@someone/app", version: "2.0.0", requires: { "@someone/dep": "^2.0.0" } });
    const brokenZip = makeFuyuZip({ name: "@someone/broken", version: "1.0.0", requires: { "@someone/nonexistent": "^2.0.0" } });

    const baseEntry = makeIndexVersion({ name: "@someone/base", version: "1.2.0", author: authorKey, zipInfo: depBaseZip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "1" });
    const depEntry = makeIndexVersion({ name: "@someone/dep", version: "1.1.0", author: authorKey, zipInfo: depZip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "2" });
    const depV2Entry = makeIndexVersion({ name: "@someone/dep", version: "2.0.0", author: authorKey, zipInfo: depV2Zip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "5" });
    const appEntry = makeIndexVersion({ name: "@someone/app", version: "1.0.0", author: authorKey, zipInfo: appZip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "3" });
    const appV2Entry = makeIndexVersion({ name: "@someone/app", version: "2.0.0", author: authorKey, zipInfo: appV2Zip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "6" });
    const brokenEntry = makeIndexVersion({ name: "@someone/broken", version: "1.0.0", author: authorKey, zipInfo: brokenZip, publishedAt: iso(BASE_NOW - 10 * DAY), commitSeed: "4" });

    for (const [entry, zipInfo] of [[baseEntry, depBaseZip], [depEntry, depZip], [depV2Entry, depV2Zip], [appEntry, appZip], [appV2Entry, appV2Zip], [brokenEntry, brokenZip]]) {
      routes.set(entry.url, () => {
        downloadOrder.push(`${zipInfo.pkg.name}@${zipInfo.pkg.version}`);
        return binRes(zipInfo.zip);
      });
    }

    const signed = signDoc(
      {
        format: 3,
        serial: 1,
        generatedAt: iso(BASE_NOW - DAY),
        expires: iso(BASE_NOW + 6 * DAY),
        plugins: [
          { name: "@someone/base", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry], versions: [baseEntry] },
          { name: "@someone/dep", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry], versions: [depEntry, depV2Entry] },
          { name: "@someone/app", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry], versions: [appEntry, appV2Entry] },
          { name: "@someone/broken", publisher: { github: "someone", official: false }, authorKeys: [authorKey.entry], versions: [brokenEntry] },
        ],
      },
      indexKey.privateKey,
    );
    routes.set(indexUrl, () => textRes(signed.text));
    routes.set(`${indexUrl}.sig`, () => textRes(signed.sigText));

    const market = createMarketService({
      dataDir,
      pluginsDir: root,
      appVersion: "0.3.11",
      platform: "macos",
      trust,
      fetchImpl: mockFetch(routes),
      indexUrl,
      revokedUrl,
      now: BASE_NOW,
    });

    await market.refresh();
    await assert.rejects(() => market.installMarket({ name: "@someone/broken" }), (err) => err.code === "missing-dependency");
    assert.equal(existsSync(join(root, "packages", "@someone", "broken")), false);

    const installed = await market.installMarket({ name: "@someone/app", version: "1.0.0" });
    assert.equal(installed.id, "@someone/app");
    assert.deepEqual(installed.confirmation.requiredPlugins, ["@someone/base", "@someone/dep"]);
    assert.deepEqual(downloadOrder, ["@someone/base@1.2.0", "@someone/dep@1.1.0", "@someone/app@1.0.0"]);
    assert.ok(existsSync(join(root, "packages", "@someone", "base", "package.json")));
    assert.ok(existsSync(join(root, "packages", "@someone", "dep", "package.json")));
    assert.ok(existsSync(join(root, "packages", "@someone", "app", "package.json")));

    const afterV1 = await market.catalog();
    assert.deepEqual(afterV1.plugins.find((p) => p.name === "@someone/app").manual.confirmation.requiredPlugins, ["@someone/dep"]);

    downloadOrder.length = 0;
    await market.installMarket({ name: "@someone/app", version: "2.0.0" });
    assert.deepEqual(downloadOrder, ["@someone/dep@2.0.0", "@someone/app@2.0.0"]);
    assert.equal(JSON.parse(readFileSync(join(root, "packages", "@someone", "dep", "package.json"), "utf8")).version, "2.0.0");

    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({ format: 1, plugins: [{ id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] }] }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
    writeFileSync(join(builtinsDir, "updater", "host", "index.mjs"), `export { name, apply } from ${JSON.stringify(entryUrl)};\n`);
    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.11" });
    await host.settle();
    assert.equal(host.timers().updater, 2);
  } finally {
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
});
