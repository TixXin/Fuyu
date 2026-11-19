import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { PACKAGES_SUBDIR } from "../../packages/plugin-cli/src/installer.mjs";
import { join } from "node:path";
import { test } from "node:test";
import { DIRECT, MIRROR_PREFIXES, createMarketDownloader, sourcesFor } from "../../src/features/updater/host/marketSources.mjs";
import { readState } from "../../src/features/updater/host/marketStore.mjs";
import { binRes, createMarketWorld, textRes } from "./market-v3-fixtures.mjs";

const INDEX = "https://raw.githubusercontent.com/someone/market/main/index.v3.json";
const REVOKED = "https://raw.githubusercontent.com/someone/market/main/revoked.v3.json";
const PACKAGES = "https://github.com/someone/market/releases/download/packages/";
const [FAST, PROXY] = MIRROR_PREFIXES;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 5, 6]);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

function githubWorld(prefix) {
  const world = createMarketWorld(prefix, { indexUrl: INDEX, revokedUrl: REVOKED, packageBase: PACKAGES });
  const copyTo = (mirror, url) => world.routes.set(`${mirror}${url}`, world.routes.get(url));
  const down = (url) => world.routes.set(url, () => textRes("", 503));
  const signed = [INDEX, `${INDEX}.sig`, REVOKED, `${REVOKED}.sig`];
  return { world, copyTo, down, signed };
}

test("the market uses the same mirrors, in the same order, as the app update", () => {
  const config = JSON.parse(readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
  const endpoints = config.plugins.updater.endpoints;
  assert.deepEqual(sourcesFor(endpoints[0]).map((source) => `${source.prefix}${endpoints[0]}`), endpoints);
  assert.deepEqual(sourcesFor(INDEX).map((source) => source.name), [DIRECT, "ghfast.top", "gh-proxy.com"]);
  assert.equal(sourcesFor(`${PACKAGES}clock-1.0.0.fuyu`).length, 3);
  assert.equal(sourcesFor("https://market.example/github.com/index.json").length, 1);
  assert.equal(sourcesFor("http://github.com/someone/market").length, 1);
  assert.equal(sourcesFor("https://api.github.com/repos/someone/market").length, 1);
});

test("with GitHub unreachable the catalog, the revocation list and a package come through the first mirror", async () => {
  const { world, copyTo, down, signed } = githubWorld("fuyu-mirror-first-");
  try {
    const entry = world.version({ version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
    world.putRevoked(1, []);
    for (const url of [...signed, entry.url]) {
      copyTo(FAST, url);
      down(url);
    }
    const snapshot = await world.market.refresh();
    assert.deepEqual(snapshot.plugins.map((plugin) => plugin.name), ["@someone/clock"]);
    assert.equal(snapshot.revocationWarning, null);
    assert.deepEqual(snapshot.lastSource, { name: "ghfast.top", at: world.clock.now });
    assert.deepEqual(readState(world.dataDir).lastSource, { name: "ghfast.top", at: world.clock.now });

    const installed = await world.market.installMarket({ name: "@someone/clock" });
    assert.equal(installed.version, "1.0.0");
    assert.equal(installed.sha256, entry.sha256);
  } finally {
    world.cleanup();
  }
});

test("a mirror that serves a tampered catalog or package is skipped for the next source", async () => {
  const { world, copyTo, down, signed } = githubWorld("fuyu-mirror-tampered-");
  try {
    const entry = world.version({ version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
    world.putRevoked(1, []);
    for (const url of [...signed, entry.url]) {
      copyTo(PROXY, url);
      copyTo(FAST, url);
      down(url);
    }
    world.routes.set(`${FAST}${INDEX}`, () => textRes(JSON.stringify({ format: 3, serial: 9, plugins: [] })));
    world.routes.set(`${FAST}${entry.url}`, () => binRes(Buffer.from("not the package")));

    const snapshot = await world.market.refresh();
    assert.deepEqual(snapshot.plugins.map((plugin) => plugin.name), ["@someone/clock"]);
    assert.equal(snapshot.lastSource.name, "gh-proxy.com");

    world.clock.now += 60 * 60 * 1000;
    const installed = await world.market.installMarket({ name: "@someone/clock" });
    assert.equal(installed.sha256, entry.sha256);
    assert.equal((await world.market.catalog()).lastSource.name, "gh-proxy.com");
  } finally {
    world.cleanup();
  }
});

test("when every source fails the error names them, and a package that matches nowhere is not installed", async () => {
  const { world, copyTo, down, signed } = githubWorld("fuyu-mirror-exhausted-");
  try {
    const entry = world.version({ version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
    world.putRevoked(1, []);
    await world.market.refresh();

    for (const url of signed) {
      world.routes.set(`${FAST}${url}`, () => textRes("", 502));
      world.routes.set(`${PROXY}${url}`, () => {
        throw new Error("socket hang up");
      });
      down(url);
    }
    await assert.rejects(() => world.market.refresh(), (error) => {
      assert.equal(error.code, "network");
      assert.deepEqual(error.data.tried, [DIRECT, "ghfast.top", "gh-proxy.com"]);
      assert.match(error.message, /GitHub: answered 503; ghfast\.top: answered 502; gh-proxy\.com: could not be reached \(socket hang up\)/);
      return true;
    });

    for (const prefix of ["", FAST, PROXY]) world.routes.set(`${prefix}${entry.url}`, () => binRes(Buffer.from(`wrong bytes from ${prefix}`)));
    await assert.rejects(() => world.market.installMarket({ name: "@someone/clock" }), (error) => error.code === "bad-sha256");
    assert.deepEqual((await world.market.catalog()).installed, []);
    assert.equal(existsSync(join(world.root, PACKAGES_SUBDIR, "@someone", "clock")), false);
  } finally {
    world.cleanup();
  }
});

test("an image is taken from the first source whose bytes match the SHA-256 in the catalog", async () => {
  const { world, down, signed, copyTo } = githubWorld("fuyu-mirror-image-");
  const icon = `${PACKAGES}clock.icon.png`;
  try {
    const entry = world.version({ version: "1.0.0" });
    entry.icon = { url: icon, sha256: sha(PNG) };
    world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
    world.putRevoked(1, []);
    for (const url of signed) copyTo(FAST, url);
    down(icon);
    world.routes.set(`${FAST}${icon}`, () => binRes(Buffer.from("an advert, not the icon")));
    world.routes.set(`${PROXY}${icon}`, () => binRes(PNG));
    await world.market.refresh({ autoUpdate: false });
    assert.deepEqual(await world.market.media({ url: icon }), { url: icon, data: `data:image/png;base64,${PNG.toString("base64")}` });
  } finally {
    world.cleanup();
  }
});

test("a plugin's README comes through a mirror when GitHub cannot be reached", async () => {
  const { world, down } = githubWorld("fuyu-mirror-readme-");
  try {
    const entry = world.version({ version: "1.0.0" });
    world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
    world.putRevoked(1, []);
    await world.market.refresh();
    const readme = `https://raw.githubusercontent.com/someone/clock/${entry.commit}/README.md`;
    down(readme);
    world.routes.set(`${FAST}${readme}`, () => textRes("# Clock\n"));
    assert.equal((await world.market.details({ name: "@someone/clock", locale: "en" })).readme, "# Clock\n");
  } finally {
    world.cleanup();
  }
});

test("a revocation list no source can deliver leaves a network warning instead of failing the refresh", async () => {
  const { world, down } = githubWorld("fuyu-mirror-revoked-");
  try {
    world.putIndex(1, [{ name: "@someone/clock", versions: [world.version({ version: "1.0.0" })] }]);
    for (const prefix of ["", FAST, PROXY]) world.routes.set(`${prefix}${REVOKED}`, () => textRes("", 503));
    down(REVOKED);
    const snapshot = await world.market.refresh();
    assert.equal(snapshot.revocationWarning, "network");
    assert.equal(snapshot.plugins.length, 1);
  } finally {
    world.cleanup();
  }
});

test("the source that just worked is tried first for a while, then GitHub goes first again", async () => {
  const clock = { now: 1_000_000 };
  const asked = [];
  const url = `${PACKAGES}clock.icon.png`;
  let githubUp = false;
  const fetchImpl = async (target) => {
    asked.push(target);
    if (target === url && !githubUp) return textRes("", 503);
    return textRes("ok");
  };
  const downloader = createMarketDownloader({ fetchImpl, now: () => clock.now, preferredForMs: 1000 });
  const read = () => downloader.run(url, async (source) => (await source.get(url, {})).text);

  assert.equal(downloader.last(), null);
  assert.equal(await read(), "ok");
  assert.deepEqual(asked, [url, `${FAST}${url}`]);
  assert.deepEqual(downloader.last(), { name: "ghfast.top", at: clock.now });

  asked.length = 0;
  clock.now += 500;
  await read();
  assert.deepEqual(asked, [`${FAST}${url}`]);

  asked.length = 0;
  githubUp = true;
  clock.now += 2000;
  await read();
  assert.deepEqual(asked, [url]);
  assert.equal(downloader.last().name, DIRECT);
});

test("a source that does not answer in time is given up on, and a 404 from GitHub is final", async () => {
  const url = `${PACKAGES}clock-1.0.0.fuyu`;
  const asked = [];
  const stalled = createMarketDownloader({
    fetchImpl: (target, { signal }) => {
      asked.push(target);
      if (target !== url) return Promise.resolve(textRes("from the mirror"));
      return new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    },
  });
  assert.equal(await stalled.run(url, async (source) => (await source.get(url, { timeoutMs: 20 })).text), "from the mirror");
  assert.deepEqual(asked, [url, `${FAST}${url}`]);

  asked.length = 0;
  const gone = createMarketDownloader({
    fetchImpl: async (target) => {
      asked.push(target);
      return textRes("not found", 404);
    },
  });
  assert.deepEqual(await gone.run(url, (source) => source.get(url, {})), { missing: true });
  assert.deepEqual(asked, [url]);
});
