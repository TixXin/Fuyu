import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { packFiles } from "@fuyu/plugin-manifest";
import { commitStaged, discardStaged, inspectPackage, installPackage, stagePackage } from "../src/index.mjs";
import { tempDir } from "./helpers.mjs";

function makePackage({ name = "@ann/hello", version = "1.0.0", repository = `github:${name.slice(1).split("/")[0]}/hello`, marker = version } = {}) {
  const manifest = {
    name,
    version,
    type: "module",
    description: "Hello plugin",
    license: "MIT",
    author: "ann",
    repository,
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "你好", en: "Hello" },
      description: { "zh-CN": "示例插件", en: "Demo plugin" },
      icon: "assets/icon.svg",
      categories: ["productivity"],
      host: "dist/host.js",
      builtWith: "2.0.0",
    },
  };
  return packFiles([
    { path: "package.json", data: JSON.stringify(manifest, null, 2) },
    { path: "assets/icon.svg", data: "<svg xmlns='http://www.w3.org/2000/svg'/>" },
    { path: "dist/host.js", data: `export const marker = ${JSON.stringify(marker)}; export function apply() {}\n` },
  ]).zip;
}

const hostJs = (dir, scope, name) => readFileSync(join(dir, "packages", scope, name, "dist", "host.js"), "utf8");
const stagingEntries = (dir) => (existsSync(join(dir, "packages", ".staging")) ? readdirSync(join(dir, "packages", ".staging")) : []);

test("a package must carry the name and version the index promised", () => {
  const zip = makePackage({ name: "@ann/hello", version: "1.0.0" });
  assert.throws(() => inspectPackage(zip, { expectedName: "@ann/other" }), { code: "name-mismatch" });
  assert.throws(() => inspectPackage(zip, { expectedName: "@ann/hello", expectedVersion: "1.0.1" }), { code: "version-mismatch" });
  assert.equal(inspectPackage(zip, { expectedName: "@ann/hello", expectedVersion: "1.0.0" }).id, "@ann/hello");

  const dir = tempDir("mismatch");
  assert.throws(() => installPackage(zip, { dir, expectedName: "@ann/other" }), { code: "name-mismatch" });
  assert.equal(existsSync(join(dir, "packages", "@ann")), false);
  assert.deepEqual(stagingEntries(dir), []);
});

test("market packages are only checked as official when the caller says so", () => {
  const fuyuZip = makePackage({ name: "@fuyu/hello", repository: "https://github.com/TixXin/fuyu" });
  const reserved = (error) => error.code === "bad-manifest" && error.errors.some((item) => item.code === "name-reserved");
  assert.throws(() => inspectPackage(fuyuZip, { source: "market" }), reserved);
  assert.throws(() => inspectPackage(fuyuZip, { source: "market", official: false }), reserved);
  assert.equal(inspectPackage(fuyuZip, { source: "market", official: true }).id, "@fuyu/hello");

  const squatted = makePackage({ name: "@ann/hello", repository: "github:bob/hello" });
  assert.throws(
    () => inspectPackage(squatted, { source: "market" }),
    (error) => error.code === "bad-manifest" && error.errors.some((item) => item.code === "name-owner"),
  );
});

test("an update that fails part way leaves the old version and plugins.yml as they were", () => {
  const dir = tempDir("rollback");
  installPackage(makePackage({ name: "@ann/hello", version: "1.0.0" }), { dir, source: "market" });
  const ymlBefore = readFileSync(join(dir, "plugins.yml"), "utf8");

  const update = stagePackage(makePackage({ name: "@ann/hello", version: "1.1.0" }), { dir, source: "market" });
  const dependent = stagePackage(makePackage({ name: "@bob/needs", version: "1.0.0", repository: "github:bob/needs" }), { dir, source: "market" });
  assert.equal(hostJs(dir, "@ann", "hello").includes("1.0.0"), true);
  writeFileSync(join(dir, "packages", "@bob"), "not a folder");

  assert.throws(() => commitStaged(dir, [update, dependent]));
  assert.match(hostJs(dir, "@ann", "hello"), /"1\.0\.0"/);
  assert.equal(JSON.parse(readFileSync(join(dir, "packages", "@ann", "hello", "package.json"), "utf8")).version, "1.0.0");
  assert.equal(readFileSync(join(dir, "plugins.yml"), "utf8"), ymlBefore);
  assert.deepEqual(stagingEntries(dir), []);
});

test("a failure while writing plugins.yml puts the swapped packages back", () => {
  const dir = tempDir("yml-fails");
  installPackage(makePackage({ version: "1.0.0" }), { dir, source: "market" });
  writeFileSync(join(dir, "blocker"), "a file where a folder is needed");
  const staged = stagePackage(makePackage({ version: "2.0.0" }), { dir, source: "market" });
  assert.throws(() => commitStaged(dir, [staged], { configFile: "blocker/plugins.yml" }));
  assert.match(hostJs(dir, "@ann", "hello"), /"1\.0\.0"/);
  assert.equal(existsSync(join(dir, "blocker", "plugins.yml")), false);
  assert.deepEqual(stagingEntries(dir), []);
});

test("a staged package that is discarded never shows up, and installs replace files in one swap", () => {
  const dir = tempDir("discard");
  installPackage(makePackage({ version: "1.0.0" }), { dir, source: "market" });
  const staged = stagePackage(makePackage({ version: "1.5.0" }), { dir, source: "market" });
  assert.match(hostJs(dir, "@ann", "hello"), /"1\.0\.0"/);
  discardStaged([staged]);
  assert.deepEqual(stagingEntries(dir), []);

  const result = installPackage(makePackage({ version: "2.0.0" }), { dir, source: "market" });
  assert.equal(result.version, "2.0.0");
  assert.match(hostJs(dir, "@ann", "hello"), /"2\.0\.0"/);
  assert.deepEqual(stagingEntries(dir), []);
});

test("leftovers from a crash are cleaned up and a moved-away old version comes back", () => {
  const dir = tempDir("recover");
  const staging = join(dir, "packages", ".staging");
  const backup = join(staging, `old.${Buffer.from("@ann/hello").toString("hex")}.abcdef`);
  mkdirSync(join(backup, "dist"), { recursive: true });
  writeFileSync(join(backup, "package.json"), JSON.stringify({ name: "@ann/hello", version: "0.9.0" }));
  writeFileSync(join(backup, "dist", "host.js"), "export const marker = \"0.9.0\";\n");
  mkdirSync(join(staging, "new.123456"), { recursive: true });

  const staged = stagePackage(makePackage({ name: "@bob/other", repository: "github:bob/other" }), { dir, source: "market" });
  assert.match(hostJs(dir, "@ann", "hello"), /"0\.9\.0"/);
  assert.deepEqual(stagingEntries(dir), [staged.dir.split(/[\\/]/).pop()]);
  discardStaged([staged]);
});
