import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packFiles, sha256Hex } from "../../packages/plugin-manifest/src/index.mjs";
import { publicKeyOf, signCommit, signText } from "../../packages/plugin-market/src/index.mjs";
import { createMarketService } from "../../src/features/updater/host/market.mjs";

export const DAY = 24 * 60 * 60 * 1000;
export const BASE_NOW = Date.parse("2026-11-18T12:00:00Z");
export const iso = (ms) => new Date(ms).toISOString();

const INDEX_URL = "https://market.example/index.v3.json";
const REVOKED_URL = "https://market.example/revoked.v3.json";

export function makeKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, entry: publicKeyOf(privateKey) };
}

export function makeFuyuZip({ name = "@someone/clock", packageName = name, version = "1.0.0", packageVersion = version, nodeApis = [], network = [], replaces = [] } = {}) {
  const pkg = {
    name: packageName,
    version: packageVersion,
    type: "module",
    license: "MIT",
    repository: `https://github.com/${name.slice(1)}`,
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1, displayName: { "zh-CN": name, en: name }, description: { "zh-CN": "测试插件", en: "Test plugin" },
      categories: ["utilities"], icon: "assets/icon.svg", platforms: ["windows", "macos"], host: "dist/host.js",
      network, nodeApis, provides: [...replaces], replaces, slots: [],
      inject: { required: [], optional: [] }, commands: [], builtWith: "2.0.0",
    },
  };
  const { zip } = packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "assets/icon.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" },
    { path: "dist/host.js", data: `export const name = ${JSON.stringify(packageName)};\nexport function apply() {}\n` },
  ]);
  return { zip, sha256: sha256Hex(zip), pkg };
}

export function makeIndexVersion({ name, version, author, zipInfo, publishedAt, commitSeed = "1" }) {
  const repository = `https://github.com/${name.slice(1)}`;
  const commit = commitSeed.repeat(40).slice(0, 40);
  const fuyu = zipInfo.pkg.fuyu;
  const entry = {
    version, repository, commit, engines: { fuyu: ">=0.3.10" }, platforms: ["windows", "macos"],
    url: `https://market.example/${name.replace("@", "").replace("/", "-")}-${version}.fuyu`,
    sha256: zipInfo.sha256, size: zipInfo.zip.length, publishedAt, reviewedAt: publishedAt,
    manifest: {
      displayName: fuyu.displayName, description: fuyu.description, license: "MIT",
      nodeApis: fuyu.nodeApis, network: fuyu.network, provides: fuyu.provides, replaces: fuyu.replaces,
      slots: fuyu.slots, inject: fuyu.inject, commands: [],
    },
    icon: { url: "https://market.example/icon.png", sha256: "b".repeat(64) },
  };
  entry.authorSignature = signCommit({ name, version, repository, commit }, author.privateKey);
  return entry;
}

function signDoc(doc, privateKey) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  return { text, sigText: `${JSON.stringify(signText(text, privateKey), null, 2)}\n` };
}

export const textRes = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });
const binRes = (buf) => ({ ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });

export function createMarketWorld(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const dataDir = join(root, "data", "updater");
  const indexKey = makeKey();
  const revokeKey = makeKey();
  const author = makeKey();
  const routes = new Map();
  const clock = { now: BASE_NOW };
  const fetchImpl = async (url) => {
    const handler = routes.get(String(url));
    if (!handler) return { ok: false, status: 404, text: async () => "not found", arrayBuffer: async () => new ArrayBuffer(0) };
    return handler();
  };
  const market = createMarketService({
    dataDir,
    pluginsDir: root,
    appVersion: "0.3.11",
    platform: "macos",
    trust: { index: [indexKey.entry], revocation: [revokeKey.entry] },
    fetchImpl,
    indexUrl: INDEX_URL,
    revokedUrl: REVOKED_URL,
    now: () => clock.now,
  });
  const version = ({ name = "@someone/clock", version: v, daysAgo = 10, commitSeed, ...zipOptions }) => {
    const zipInfo = makeFuyuZip({ name, version: v, ...zipOptions });
    const entry = makeIndexVersion({ name, version: v, author, zipInfo, publishedAt: iso(clock.now - daysAgo * DAY), commitSeed: commitSeed ?? v.replace(/\D/g, "") });
    routes.set(entry.url, () => binRes(zipInfo.zip));
    return entry;
  };
  const putIndex = (serial, plugins, extra = {}) => {
    const signed = signDoc({
      format: 3, serial, generatedAt: iso(clock.now - 60_000), expires: iso(clock.now + 6 * DAY), ...extra,
      plugins: plugins.map(({ name, versions }) => ({ name, publisher: { github: name.slice(1).split("/")[0], official: false }, authorKeys: [author.entry], versions })),
    }, indexKey.privateKey);
    routes.set(INDEX_URL, () => textRes(signed.text));
    routes.set(`${INDEX_URL}.sig`, () => textRes(signed.sigText));
  };
  const putRevoked = (serial, entries, { generatedAt = clock.now - DAY, expires = clock.now + 30 * DAY, signer = revokeKey } = {}) => {
    const signed = signDoc({ format: 3, serial, generatedAt: iso(generatedAt), expires: iso(expires), entries, withdrawn: [] }, signer.privateKey);
    routes.set(REVOKED_URL, () => textRes(signed.text));
    routes.set(`${REVOKED_URL}.sig`, () => textRes(signed.sigText));
  };
  const failRevoked = (status = 503) => {
    routes.set(REVOKED_URL, () => textRes("", status));
  };
  return {
    root, dataDir, market, routes, clock, version, putIndex, putRevoked, failRevoked, otherKey: makeKey,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

export function revocation(id, name, version, level, text = "原因") {
  return { id, name, version, level, reason: { "zh-CN": text, en: `${text} (en)` } };
}
