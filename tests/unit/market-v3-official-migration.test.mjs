import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { marketV1 } from "@fuyu/plugin-services";
import { signText } from "../../packages/plugin-market/src/index.mjs";
import { BASE_NOW, DAY, createMarketWorld, iso, makeFuyuZip, makeKey, textRes } from "./market-v3-fixtures.mjs";

const OFFICIAL_REPO = "https://github.com/TixXin/fuyu";

function writeInstalledOfficialDir(root, { name, version = "1.0.0", repository = OFFICIAL_REPO, probeKey = name.split("/")[1] }) {
  const [scope, pkgName] = name.split("/");
  const pkgDir = join(root, "packages", scope, pkgName);
  mkdirSync(join(pkgDir, "dist"), { recursive: true });
  mkdirSync(join(pkgDir, "assets"), { recursive: true });
  const pkg = {
    name,
    version,
    type: "module",
    license: "MIT",
    repository,
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": name, en: name },
      description: { "zh-CN": "测试官方插件", en: "Test official plugin" },
      categories: ["utilities"],
      icon: "assets/icon.svg",
      platforms: ["windows", "macos"],
      host: "dist/host.js",
      network: [],
      nodeApis: [],
      provides: [],
      replaces: [],
      slots: [],
      inject: { required: [], optional: [] },
      commands: [],
      builtWith: "2.0.0",
    },
  };
  writeFileSync(join(pkgDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(join(pkgDir, "assets", "icon.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n");
  writeFileSync(
    join(pkgDir, "dist", "host.js"),
    `export const name = ${JSON.stringify(name)};\nexport function apply() { (globalThis.officialMigrationProbe ??= {})[${JSON.stringify(probeKey)}] = true; }\n`,
  );
  return pkg;
}

function makeSignedOfficialIndex({ indexKey, serial, plugins, generatedAt, expires }) {
  const doc = {
    format: 3,
    serial,
    generatedAt: iso(generatedAt),
    expires: iso(expires),
    plugins: plugins.map(({ name, version, repository = OFFICIAL_REPO, official = true }) => {
      const zipInfo = makeFuyuZip({ name, version });
      return {
        name,
        publisher: { github: "TixXin", official },
        authorKeys: [],
        versions: [
          {
            version,
            repository,
            commit: "a".repeat(40),
            engines: { fuyu: ">=0.3.10" },
            platforms: ["windows", "macos"],
            url: `https://market.example/${name.replace("@", "").replace("/", "-")}-${version}.fuyu`,
            sha256: zipInfo.sha256,
            size: zipInfo.zip.length,
            publishedAt: iso(generatedAt),
            reviewedAt: iso(generatedAt),
            manifest: {
              displayName: { "zh-CN": name, en: name },
              description: { "zh-CN": "测试官方插件", en: "Test official plugin" },
              license: "MIT",
              nodeApis: [],
              network: [],
              provides: [],
              replaces: [],
              slots: [],
              inject: { required: [], optional: [] },
              commands: [],
            },
            icon: { url: "https://market.example/icon.png", sha256: "b".repeat(64) },
          },
        ],
      };
    }),
  };
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const sigText = `${JSON.stringify(signText(text, indexKey.privateKey), null, 2)}\n`;
  return { doc, text, sigText };
}

async function waitForStatus(host, predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = host.status();
    if (predicate(list)) return list;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return host.status();
}

async function withUpdaterHost({ pluginsYml, setupData, indexKey, revokeKey, now = BASE_NOW }, run) {
  const root = mkdtempSync(join(tmpdir(), "fuyu-e82-host-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-e82-builtins-"));
  let host = null;
  globalThis.officialMigrationProbe = {};
  try {
    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({
        format: 1,
        plugins: [{ id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] }],
      }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
    const trust = { index: [indexKey.entry], revocation: [revokeKey.entry] };
    writeFileSync(
      join(builtinsDir, "updater", "host", "index.mjs"),
      [
        `import { apply as baseApply, name } from ${JSON.stringify(entryUrl)};`,
        `export { name };`,
        `export function apply(ctx) {`,
        `  return baseApply(ctx, { trust: ${JSON.stringify(trust)}, now: () => ${now}, startupDelayMs: 600000, refreshIntervalMs: 600000 });`,
        `}`,
      ].join("\n"),
    );
    writeFileSync(join(root, "plugins.yml"), pluginsYml);
    await setupData(root);
    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.12" });
    await host.settle();
    await run({ root, host });
  } finally {
    delete globalThis.officialMigrationProbe;
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
}

test("startup migrates pre-E69 official market entries from verified cached index (including expired cache), preserves disabled, and rejects impostors", async () => {
  const indexKey = makeKey();
  const revokeKey = makeKey();
  const pluginsYml = [
    '- id: "@fuyu/weather"',
    "  source: market",
    '- id: "@fuyu/world-clock"',
    "  source: market",
    "  disabled: true",
    '- id: "@fuyu/impostor"',
    "  source: market",
    '- id: "@fuyu/spoofed-repo"',
    "  source: market",
    "",
  ].join("\n");

  await withUpdaterHost(
    {
      pluginsYml,
      indexKey,
      revokeKey,
      now: BASE_NOW + 20 * DAY,
      setupData: (root) => {
        writeInstalledOfficialDir(root, { name: "@fuyu/weather", version: "1.4.0", probeKey: "weather" });
        writeInstalledOfficialDir(root, { name: "@fuyu/world-clock", version: "1.1.1", probeKey: "worldClock" });
        writeInstalledOfficialDir(root, { name: "@fuyu/impostor", version: "1.0.0", probeKey: "impostor" });
        writeInstalledOfficialDir(root, {
          name: "@fuyu/spoofed-repo",
          version: "1.0.0",
          repository: "https://github.com/evil/spoofed-repo",
          probeKey: "spoofedRepo",
        });
        const updaterDir = join(root, "data", "updater");
        mkdirSync(updaterDir, { recursive: true });
        const signed = makeSignedOfficialIndex({
          indexKey,
          serial: 100,
          generatedAt: BASE_NOW,
          expires: BASE_NOW + 7 * DAY,
          plugins: [
            { name: "@fuyu/weather", version: "1.4.0" },
            { name: "@fuyu/world-clock", version: "1.1.1" },
            { name: "@fuyu/spoofed-repo", version: "1.0.0" },
          ],
        });
        writeFileSync(join(updaterDir, "index.v3.json"), signed.text);
        writeFileSync(join(updaterDir, "index.v3.json.sig"), signed.sigText);
      },
    },
    async ({ root, host }) => {
      const list = await waitForStatus(
        host,
        (items) => items.find((item) => item.id === "@fuyu/weather")?.state === "running",
      );
      const byId = (id) => list.find((item) => item.id === id);

      assert.equal(byId("@fuyu/weather")?.state, "running");
      assert.equal(globalThis.officialMigrationProbe.weather, true);

      assert.equal(byId("@fuyu/world-clock")?.state, "disabled");
      assert.equal(globalThis.officialMigrationProbe.worldClock, undefined);

      assert.equal(byId("@fuyu/impostor")?.state, "failed");
      assert.equal(byId("@fuyu/impostor")?.blocked?.by, "manifest");
      assert.equal(globalThis.officialMigrationProbe.impostor, undefined);

      assert.equal(byId("@fuyu/spoofed-repo")?.state, "failed");
      assert.equal(byId("@fuyu/spoofed-repo")?.blocked?.by, "manifest");
      assert.equal(globalThis.officialMigrationProbe.spoofedRepo, undefined);

      const yml = readFileSync(join(root, "plugins.yml"), "utf8");
      assert.match(yml, /- id: "@fuyu\/weather"\n  source: market\n  official: true\n/);
      assert.match(yml, /- id: "@fuyu\/world-clock"\n  source: market\n  official: true\n  disabled: true\n/);
      assert.doesNotMatch(yml, /- id: "@fuyu\/impostor"\n  source: market\n  official: true/);
      assert.doesNotMatch(yml, /- id: "@fuyu\/spoofed-repo"\n  source: market\n  official: true/);
    },
  );
});

test("market.refresh backfills official: true for legacy official market plugins when no cache existed on startup", async () => {
  const world = createMarketWorld("fuyu-e82-refresh-");
  let reloaded = 0;
  try {
    writeInstalledOfficialDir(world.root, { name: "@fuyu/now-playing", version: "1.2.0" });
    writeInstalledOfficialDir(world.root, { name: "@fuyu/impostor", version: "1.0.0" });
    writeFileSync(
      join(world.root, "plugins.yml"),
      [
        '- id: "@fuyu/now-playing"',
        "  source: market",
        '- id: "@fuyu/impostor"',
        "  source: market",
        "",
      ].join("\n"),
    );

    const indexKey = makeKey();
    const signed = makeSignedOfficialIndex({
      indexKey,
      serial: 200,
      generatedAt: BASE_NOW - 60_000,
      expires: BASE_NOW + 6 * DAY,
      plugins: [{ name: "@fuyu/now-playing", version: "1.2.0" }],
    });
    world.routes.set(world.options.indexUrl, () => textRes(signed.text));
    world.routes.set(`${world.options.indexUrl}.sig`, () => textRes(signed.sigText));
    world.putRevoked(1, []);

    const { createMarketService } = await import("../../src/features/updater/host/market.mjs");
    const service = createMarketService({
      ...world.options,
      trust: { index: [indexKey.entry], revocation: world.options.trust.revocation },
      onConfigChanged: () => {
        reloaded += 1;
      },
    });

    await service.refresh({ autoUpdate: false });
    assert.equal(reloaded, 1);
    const yml = readFileSync(join(world.root, "plugins.yml"), "utf8");
    assert.match(yml, /- id: "@fuyu\/now-playing"\n  source: market\n  official: true\n/);
    assert.doesNotMatch(yml, /- id: "@fuyu\/impostor"\n  source: market\n  official: true/);

    await service.refresh({ autoUpdate: false });
    assert.equal(reloaded, 1);
  } finally {
    world.cleanup();
  }
});

test("migration does not mark an official plugin when trustedAuthors pins a non-official key or repository", async () => {
  const world = createMarketWorld("fuyu-e82-pin-");
  let reloaded = 0;
  try {
    writeInstalledOfficialDir(world.root, { name: "@fuyu/weather", version: "1.4.0" });
    writeFileSync(join(world.root, "plugins.yml"), '- id: "@fuyu/weather"\n  source: market\n');
    mkdirSync(world.dataDir, { recursive: true });
    writeFileSync(
      join(world.dataDir, "market-state.json"),
      JSON.stringify({
        trustedAuthors: {
          "@fuyu/weather": { keyId: "deadbeef12345678", repository: OFFICIAL_REPO },
        },
      }),
    );

    const indexKey = makeKey();
    const signed = makeSignedOfficialIndex({
      indexKey,
      serial: 201,
      generatedAt: BASE_NOW - 60_000,
      expires: BASE_NOW + 6 * DAY,
      plugins: [{ name: "@fuyu/weather", version: "1.4.0" }],
    });
    world.routes.set(world.options.indexUrl, () => textRes(signed.text));
    world.routes.set(`${world.options.indexUrl}.sig`, () => textRes(signed.sigText));
    world.putRevoked(1, []);

    const { createMarketService } = await import("../../src/features/updater/host/market.mjs");
    const service = createMarketService({
      ...world.options,
      trust: { index: [indexKey.entry], revocation: world.options.trust.revocation },
      onConfigChanged: () => {
        reloaded += 1;
      },
    });

    await service.refresh({ autoUpdate: false });
    assert.equal(reloaded, 0);
    const yml = readFileSync(join(world.root, "plugins.yml"), "utf8");
    assert.doesNotMatch(yml, /official: true/);
  } finally {
    world.cleanup();
  }
});

test("market/v1 service keeps settings-only guard intact alongside official migration", () => {
  assert.equal(marketV1.name, "market/v1");
});
