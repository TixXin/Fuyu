import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function makeFuyuZip({
  name = "@someone/clock",
  version = "1.0.0",
  repository = "https://github.com/someone/clock",
  official = false,
  network = ["api.clock.example"],
  nodeApis = ["node:crypto"],
  provides = ["clock/v1"],
  slots = ["island.page/v1"],
} = {}) {
  const pkg = {
    name,
    version,
    type: "module",
    license: "MIT",
    repository: official ? "https://github.com/TixXin/fuyu" : repository,
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "时钟", en: "Clock" },
      description: { "zh-CN": "悬浮岛时钟", en: "Island clock" },
      categories: ["utilities"],
      icon: "assets/icon.svg",
      platforms: ["windows", "macos"],
      host: "dist/host.js",
      network,
      nodeApis,
      provides,
      replaces: [],
      slots,
      inject: { required: [], optional: [] },
      commands: [],
      builtWith: "2.0.0",
    },
  };
  const { zip } = packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "assets/icon.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" },
    { path: "dist/host.js", data: "export const name = 'clock';\nexport function apply() {}\n" },
  ]);
  return { zip, sha256: sha256Hex(zip), pkg };
}

function makeIndexVersion({ name, version, repository, author, zipInfo, publishedAt, official = false, commitSeed = "1" }) {
  const commit = commitSeed.repeat(40).slice(0, 40);
  const fuyu = zipInfo.pkg.fuyu;
  const entry = {
    version,
    repository,
    commit,
    engines: { fuyu: ">=0.3.10" },
    platforms: ["windows", "macos"],
    url: `https://market.example/${name.replace("@", "").replace("/", "-")}-${version}.fuyu`,
    sha256: zipInfo.sha256,
    size: zipInfo.zip.length,
    publishedAt,
    reviewedAt: publishedAt,
    manifest: {
      displayName: fuyu.displayName,
      description: fuyu.description,
      license: "MIT",
      nodeApis: fuyu.nodeApis,
      network: fuyu.network,
      provides: fuyu.provides,
      replaces: fuyu.replaces,
      slots: fuyu.slots,
      inject: fuyu.inject,
      commands: [],
    },
    icon: { url: "https://market.example/icon.png", sha256: "b".repeat(64) },
  };
  if (!official && author) {
    entry.authorSignature = signCommit({ name, version, repository, commit }, author.privateKey);
  }
  return entry;
}

function signDoc(doc, privateKey) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const signature = signText(text, privateKey);
  return { text, sigText: `${JSON.stringify(signature, null, 2)}\n` };
}

function mockFetch(routes) {
  return async (url) => {
    const handler = routes.get(String(url));
    if (!handler) return { ok: false, status: 404, text: async () => "not found", arrayBuffer: async () => new ArrayBuffer(0) };
    return handler();
  };
}

function textResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

function binaryResponse(buf, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

test("market/v1 verifies signed index, enforces cooldown, installs, toggles, gates manual .fuyu, revokes and uninstalls", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-v3-"));
  try {
    const dataDir = join(root, "data", "updater");
    const indexKey = makeKey();
    const revokeKey = makeKey();
    const authorKey = makeKey();
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };

    const v100Zip = makeFuyuZip({ name: "@someone/clock", version: "1.0.0" });
    const v110Zip = makeFuyuZip({ name: "@someone/clock", version: "1.1.0" });
    const freshOnlyZip = makeFuyuZip({
      name: "@fuyu/pomodoro",
      version: "1.0.0",
      official: true,
      network: [],
      nodeApis: [],
      provides: [],
    });
    const manualZip = makeFuyuZip({
      name: "@localdev/notes-helper",
      version: "0.2.0",
      repository: "https://github.com/localdev/notes-helper",
      network: ["notes.example.com"],
      nodeApis: ["node:fs"],
      provides: [],
      slots: ["settings.section/v1"],
    });

    const v100Entry = makeIndexVersion({
      name: "@someone/clock",
      version: "1.0.0",
      repository: "https://github.com/someone/clock",
      author: authorKey,
      zipInfo: v100Zip,
      publishedAt: iso(NOW - 10 * DAY),
      commitSeed: "a",
    });
    const v110Entry = makeIndexVersion({
      name: "@someone/clock",
      version: "1.1.0",
      repository: "https://github.com/someone/clock",
      author: authorKey,
      zipInfo: v110Zip,
      publishedAt: iso(NOW - 1 * DAY),
      commitSeed: "b",
    });
    const freshOfficialEntry = makeIndexVersion({
      name: "@fuyu/pomodoro",
      version: "1.0.0",
      repository: "https://github.com/TixXin/fuyu",
      official: true,
      zipInfo: freshOnlyZip,
      publishedAt: iso(NOW - 1 * DAY),
      commitSeed: "c",
    });

    const indexDoc = {
      format: 3,
      serial: 1,
      generatedAt: iso(NOW - DAY),
      expires: iso(NOW + 6 * DAY),
      plugins: [
        {
          name: "@someone/clock",
          publisher: { github: "someone", official: false },
          authorKeys: [authorKey.entry],
          versions: [v100Entry, v110Entry],
        },
        {
          name: "@fuyu/pomodoro",
          publisher: { github: "TixXin", official: true },
          authorKeys: [],
          versions: [freshOfficialEntry],
        },
      ],
    };

    const routes = new Map();
    const indexUrl = "https://market.example/index.v3.json";
    const revokedUrl = "https://market.example/revoked.v3.json";
    routes.set(v100Entry.url, () => binaryResponse(v100Zip.zip));
    routes.set(v110Entry.url, () => binaryResponse(v110Zip.zip));
    routes.set(freshOfficialEntry.url, () => binaryResponse(freshOnlyZip.zip));

    let changedEvents = 0;
    const market = createMarketService({
      dataDir,
      pluginsDir: root,
      appVersion: "0.3.11",
      platform: "macos",
      trust,
      fetchImpl: mockFetch(routes),
      indexUrl,
      revokedUrl,
      now: NOW,
    });
    market.subscribe(() => {
      changedEvents += 1;
    });

    const initial = await market.catalog();
    assert.deepEqual(initial.plugins, []);
    assert.equal(initial.manualAllowed, false);
    assert.equal(initial.updatedAt, null);

    const signedIndex = signDoc(indexDoc, indexKey.privateKey);
    routes.set(indexUrl, () => textResponse(`${signedIndex.text}tampered`));
    routes.set(`${indexUrl}.sig`, () => textResponse(signedIndex.sigText));
    await assert.rejects(() => market.refresh(), /bad-signature/);

    routes.set(indexUrl, () => textResponse(signedIndex.text));
    const refreshed = await market.refresh();
    assert.equal(changedEvents, 1);
    assert.equal(refreshed.plugins.length, 2);

    const clockCatalog = refreshed.plugins.find((p) => p.name === "@someone/clock");
    assert.equal(clockCatalog.install.version, "1.0.0");
    assert.equal(clockCatalog.install.fresh, false);
    assert.equal(clockCatalog.manual.version, "1.1.0");
    assert.equal(clockCatalog.manual.fresh, true);
    assert.deepEqual(clockCatalog.install.confirmation.network, ["api.clock.example"]);
    assert.deepEqual(clockCatalog.install.confirmation.nodeApis, ["node:crypto"]);

    const pomoCatalog = refreshed.plugins.find((p) => p.name === "@fuyu/pomodoro");
    assert.equal(pomoCatalog.official, true);
    assert.equal(pomoCatalog.install.version, "1.0.0");
    assert.equal(pomoCatalog.install.fresh, true);

    const installedMarket = await market.installMarket({ name: "@someone/clock", version: "1.0.0" });
    assert.equal(installedMarket.id, "@someone/clock");
    assert.equal(installedMarket.version, "1.0.0");
    assert.equal(installedMarket.source, "market");
    assert.ok(existsSync(join(root, "packages", "@someone", "clock", "package.json")));

    const afterInstall = await market.catalog();
    const clockAfter = afterInstall.plugins.find((p) => p.name === "@someone/clock");
    assert.equal(clockAfter.installedVersion, "1.0.0");
    assert.equal(clockAfter.enabled, true);
    assert.equal(clockAfter.manual.version, "1.1.0");
    assert.equal(clockAfter.autoUpdate, null);

    await market.setEnabled({ id: "@someone/clock", enabled: false });
    const ymlDisabled = readFileSync(join(root, "plugins.yml"), "utf8");
    assert.match(ymlDisabled, /source: market/);
    assert.match(ymlDisabled, /disabled: true/);
    assert.equal((await market.catalog()).installed.find((i) => i.id === "@someone/clock")?.enabled, false);

    await market.setEnabled({ id: "@someone/clock", enabled: true });
    assert.equal((await market.catalog()).installed.find((i) => i.id === "@someone/clock")?.enabled, true);

    const manualBase64 = manualZip.zip.toString("base64");
    await assert.rejects(() => market.installFile({ base64: manualBase64 }), (err) => err.code === "manual-disabled");

    const inspected = await market.inspectPackage({ base64: manualBase64 });
    assert.equal(inspected.id, "@localdev/notes-helper");
    assert.equal(inspected.sha256, manualZip.sha256);
    assert.equal(inspected.confirmation.unreviewed, true);
    assert.deepEqual(inspected.confirmation.network, ["notes.example.com"]);
    assert.deepEqual(inspected.confirmation.nodeApis, ["node:fs"]);
    assert.equal(existsSync(join(root, "packages", "@localdev", "notes-helper")), false);

    await market.setManualAllowed({ allowed: true });
    assert.equal((await market.catalog()).manualAllowed, true);
    const manualInstalled = await market.installFile({ base64: manualBase64, expectedSha256: inspected.sha256 });
    assert.equal(manualInstalled.source, "manual");
    assert.ok(existsSync(join(root, "packages", "@localdev", "notes-helper", "package.json")));

    routes.set(revokedUrl, () => textResponse("{}", 200));
    routes.set(`${revokedUrl}.sig`, () => textResponse("{}", 200));
    await assert.rejects(() => market.refresh(), /bad-signature/);

    const revokedDoc = {
      format: 3,
      serial: 1,
      generatedAt: iso(NOW - DAY),
      expires: iso(NOW + 30 * DAY),
      entries: [
        {
          id: "rev-clock-100",
          name: "@someone/clock",
          version: "1.0.0",
          level: "disable",
          reason: { "zh-CN": "安全漏洞", en: "Security issue" },
        },
      ],
      withdrawn: [],
    };
    const nextIndexDoc = { ...indexDoc, serial: 2, revokedSerial: 1 };
    const signedNextIndex = signDoc(nextIndexDoc, indexKey.privateKey);
    const signedRevoked = signDoc(revokedDoc, revokeKey.privateKey);
    routes.set(indexUrl, () => textResponse(signedNextIndex.text));
    routes.set(`${indexUrl}.sig`, () => textResponse(signedNextIndex.sigText));
    routes.set(revokedUrl, () => textResponse(signedRevoked.text));
    routes.set(`${revokedUrl}.sig`, () => textResponse(signedRevoked.sigText));

    const afterRevoke = await market.refresh();
    assert.equal(afterRevoke.installed.find((i) => i.id === "@someone/clock")?.enabled, false);
    assert.equal(afterRevoke.plugins.find((p) => p.name === "@someone/clock")?.revoked, true);

    const pluginDataDir = join(root, "data", "@localdev", "notes-helper");
    mkdirSync(pluginDataDir, { recursive: true });
    writeFileSync(join(pluginDataDir, "state.json"), "{}");
    await market.uninstall({ id: "@localdev/notes-helper", removeData: true });
    assert.equal(existsSync(join(root, "packages", "@localdev", "notes-helper")), false);
    assert.equal(existsSync(pluginDataDir), false);
    assert.equal((await market.catalog()).installed.some((i) => i.id === "@localdev/notes-helper"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("essential updater built-in provides market/v1 inside startHost", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-updater-host-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-updater-builtins-"));
  let host = null;
  try {
    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({
        format: 1,
        plugins: [
          {
            id: "updater",
            kind: "essential",
            root: "updater",
            host: "host/index.mjs",
            background: [],
            provides: ["market/v1"],
          },
        ],
      }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
    writeFileSync(join(builtinsDir, "updater", "host", "index.mjs"), `export { name, apply } from ${JSON.stringify(entryUrl)};\n`);
    writeFileSync(join(root, "plugins.yml"), "[]\n");

    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.11" });
    await host.settle();
    assert.ok(host.services().some((s) => s.name === marketV1.name && s.plugin === "updater"));
    const snapshot = await host.serviceHub.windowCall(
      "service.call",
      { service: marketV1.name, method: "catalog", params: {} },
      "settings",
    );
    assert.deepEqual(snapshot.plugins, []);
    assert.equal(snapshot.manualAllowed, false);
  } finally {
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
});
