import assert from "node:assert/strict";
import { test } from "node:test";
import { parseName, validateIndex } from "../src/index.mjs";
import { index, makeKey, plugin, version } from "./fixtures.mjs";

const author = makeKey();
const paths = (doc, options) => validateIndex(doc, options).map((p) => p.path);

test("a well-formed index has no problems", () => {
  assert.deepEqual(validateIndex(index([plugin({ author })])), []);
});

test("plugin names must be scoped and lowercase", () => {
  assert.deepEqual(parseName("@someone/fuyu-weather"), { scope: "someone", name: "fuyu-weather" });
  for (const bad of ["weather", "@Someone/weather", "@someone/", "@/x", "io.github.someone.weather", null]) assert.equal(parseName(bad), null, String(bad));
});

test("header fields are checked", () => {
  const doc = { ...index([]), format: 2, serial: -1, generatedAt: "yesterday", expires: "2026-11-15" };
  assert.deepEqual(paths(doc), ["format", "serial", "generatedAt", "expires"]);
  const backwards = { ...index([]), expires: "2000-01-01T00:00:00Z" };
  assert.deepEqual(paths(backwards), ["expires"]);
  assert.deepEqual(paths(null), [""]);
});

test("each version field is checked", () => {
  const entry = {
    ...version("@someone/weather", author),
    version: "1.0",
    commit: "abc",
    engines: { fuyu: "" },
    platforms: ["linux"],
    url: "http://example.com/x.fuyu",
    sha256: "A".repeat(64),
    size: 0,
    publishedAt: "now",
    reviewedAt: undefined,
    urgent: { reason: { en: "fix" } },
    icon: { url: "https://example.com/i.png" },
    screenshots: new Array(7).fill({ url: "https://example.com/s.png", sha256: "c".repeat(64) }),
  };
  const p = plugin({ author, versions: [entry] });
  assert.deepEqual(paths(index([p])), [
    "plugins[0].versions[0].version",
    "plugins[0].versions[0].commit",
    "plugins[0].versions[0].engines.fuyu",
    "plugins[0].versions[0].platforms",
    "plugins[0].versions[0].url",
    "plugins[0].versions[0].sha256",
    "plugins[0].versions[0].size",
    "plugins[0].versions[0].publishedAt",
    "plugins[0].versions[0].reviewedAt",
    "plugins[0].versions[0].urgent.reason",
    "plugins[0].versions[0].icon.sha256",
    "plugins[0].versions[0].screenshots",
  ]);
});

test("the manifest summary is checked", () => {
  const entry = version("@someone/weather", author);
  entry.manifest = { ...entry.manifest, displayName: { en: "x" }, nodeApis: "fs", inject: { required: [] }, commands: [{}], requires: { "@a/b": "nope" } };
  assert.deepEqual(paths(index([plugin({ author, versions: [entry] })])), [
    "plugins[0].versions[0].manifest.displayName",
    "plugins[0].versions[0].manifest.nodeApis",
    "plugins[0].versions[0].manifest.inject.optional",
    "plugins[0].versions[0].manifest.commands[0]",
    "plugins[0].versions[0].manifest.requires",
  ]);
});

test("a third-party repository must belong to the name's scope", () => {
  const p = plugin({ author, versions: [version("@someone/weather", author, { repository: "https://github.com/impostor/weather" })] });
  assert.deepEqual(paths(index([p])), ["plugins[0].versions[0].repository"]);
  const cased = plugin({ author, versions: [version("@someone/weather", author, { repository: "https://github.com/SomeOne/weather" })] });
  assert.deepEqual(paths(index([cased])), []);
});

test("third-party versions need an author signature from a listed key", () => {
  const unsigned = plugin({ author, versions: [version("@someone/weather", author, { sign: false })] });
  assert.deepEqual(paths(index([unsigned])), ["plugins[0].versions[0].authorSignature"]);
  const stranger = makeKey();
  const foreign = plugin({ author, versions: [version("@someone/weather", stranger)] });
  assert.deepEqual(paths(index([foreign])), ["plugins[0].versions[0].authorSignature.keyId"]);
  assert.deepEqual(paths(index([{ ...plugin({ author }), authorKeys: [] }])), ["plugins[0].authorKeys", "plugins[0].versions[0].authorSignature.keyId"]);
  const badKey = { keyId: "0000000000000000", publicKey: author.entry.publicKey };
  assert.deepEqual(paths(index([{ ...plugin({ author }), authorKeys: [badKey, author.entry] }])), ["plugins[0].authorKeys"]);
});

test("only the official scope is official, and it comes from the official repository", () => {
  const official = (repository, extra = {}) => ({
    name: "@fuyu/countdown",
    publisher: { github: "TixXin", official: true },
    authorKeys: [],
    versions: [{ ...version("@fuyu/countdown", null, { repository, sign: false }), ...extra }],
  });
  assert.deepEqual(paths(index([official("https://github.com/TixXin/fuyu")])), []);
  assert.deepEqual(paths(index([official("https://github.com/someone/fuyu")])), ["plugins[0].versions[0].repository"]);
  assert.deepEqual(paths(index([official("https://github.com/TixXin/fuyu", { authorSignature: { keyId: "a", signature: "b" } })])), ["plugins[0].versions[0].authorSignature"]);
  const claimed = { ...plugin({ author }), publisher: { github: "someone", official: true } };
  assert.ok(paths(index([claimed])).includes("plugins[0].publisher.official"));
  const renamed = official("https://github.com/acme/island", {});
  assert.deepEqual(paths(index([renamed]), { officialRepository: "https://github.com/acme/island" }), []);
});

test("duplicate names and versions are reported", () => {
  const p = plugin({ author, versions: [version("@someone/weather", author), version("@someone/weather", author)] });
  assert.deepEqual(paths(index([p, plugin({ author })])), ["plugins[0].versions[1]", "plugins[1]"]);
});

test("unknown fields are ignored for forward compatibility", () => {
  const p = { ...plugin({ author }), likes: 3 };
  assert.deepEqual(validateIndex({ ...index([p]), mirrors: [] }), []);
});
