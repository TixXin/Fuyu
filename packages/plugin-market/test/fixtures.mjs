import { generateKeyPairSync } from "node:crypto";
import { publicKeyOf, signCommit, signText } from "../src/index.mjs";

export const DAY = 24 * 60 * 60 * 1000;
export const NOW = Date.parse("2026-11-15T12:00:00Z");
export const iso = (ms) => new Date(ms).toISOString();
export const daysAgo = (days) => iso(NOW - days * DAY);

export function makeKey() {
  const { privateKey } = generateKeyPairSync("ed25519");
  return { privateKey, entry: publicKeyOf(privateKey) };
}

const HEX = "0123456789abcdef";
export const commitOf = (seed) => Array.from({ length: 40 }, (_, i) => HEX[(seed * 7 + i) % 16]).join("");

export const manifest = () => ({
  displayName: { "zh-CN": "天气", en: "Weather" },
  description: { "zh-CN": "岛上看天气", en: "Weather on the island" },
  license: "MIT",
  nodeApis: ["https"],
  network: ["api.open-meteo.com"],
  inject: { required: ["notify"], optional: [] },
  provides: ["weather"],
  replaces: [],
  slots: ["island.page/v1"],
  commands: [{ id: "weather.refresh", title: { "zh-CN": "刷新", en: "Refresh" } }],
});

export function version(name, author, { v = "1.0.0", published = daysAgo(10), engines = ">=0.4.0", platforms = ["windows", "macos"], repository = "https://github.com/someone/weather", urgent, sign = true, seed = 1 } = {}) {
  const commit = commitOf(seed);
  const entry = {
    version: v,
    repository,
    commit,
    engines: { fuyu: engines },
    platforms,
    url: `https://github.com/TixXin/fuyu-plugins/releases/download/x/${v}.fuyu`,
    sha256: "a".repeat(64),
    size: 1234,
    publishedAt: published,
    reviewedAt: published,
    manifest: manifest(),
    icon: { url: "https://raw.githubusercontent.com/TixXin/fuyu-plugins/main/icons/weather.png", sha256: "b".repeat(64) },
  };
  if (urgent) entry.urgent = { reason: { "zh-CN": "安全修复", en: "Security fix" } };
  if (sign && author) entry.authorSignature = signCommit({ name, version: v, repository, commit }, author.privateKey);
  return entry;
}

export function plugin({ name = "@someone/weather", author, keys, versions }) {
  return {
    name,
    publisher: { github: "someone", official: false },
    authorKeys: keys ?? [author.entry],
    versions: versions ?? [version(name, author)],
  };
}

export function index(plugins, { serial = 10, generated = NOW - DAY, lifetime = 7, revokedSerial } = {}) {
  const doc = { format: 3, serial, generatedAt: iso(generated), expires: iso(generated + lifetime * DAY), plugins };
  if (revokedSerial !== undefined) doc.revokedSerial = revokedSerial;
  return doc;
}

export function revoked(entries, { serial = 1, withdrawn = [], generated = NOW - DAY, lifetime = 90 } = {}) {
  return { format: 3, serial, generatedAt: iso(generated), expires: iso(generated + lifetime * DAY), entries, withdrawn };
}

export const reason = (zh, en) => ({ "zh-CN": zh, en });

export function signed(doc, ...privateKeys) {
  const text = `${JSON.stringify(doc, null, 2)}\n`;
  const signatures = privateKeys.map((key) => signText(text, key));
  return { text, signature: signatures.length === 1 ? signatures[0] : signatures };
}
