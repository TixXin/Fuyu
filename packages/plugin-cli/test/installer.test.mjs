import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { packFiles } from "@fuyu/plugin-manifest";
import { emptyRevocations, mergeRevoked } from "@fuyu/plugin-market";
import {
  applyRevocationsToDir,
  inspectPackage,
  installPackage,
  uninstallPackage,
} from "../src/index.mjs";

const cleanup = [];
after(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), "market-install-"));
  cleanup.push(dir);
  return dir;
}

function makeBuiltPackage({ name = "@ann/hello", version = "1.0.0", replaces = [], engines = ">=0.4.0 <1.0.0" } = {}) {
  const manifest = {
    name,
    version,
    type: "module",
    description: "Hello plugin",
    license: "MIT",
    author: "ann",
    repository: "github:ann/hello",
    engines: { fuyu: engines },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "你好", en: "Hello" },
      description: { "zh-CN": "示例插件", en: "Demo plugin" },
      icon: "assets/icon.svg",
      categories: ["productivity"],
      host: "dist/host.js",
      nodeApis: ["os"],
      ...(replaces.length ? { provides: replaces, replaces } : {}),
      builtWith: "2.0.0",
    },
  };
  return packFiles([
    { path: "package.json", data: JSON.stringify(manifest, null, 2) },
    { path: "assets/icon.svg", data: "<svg xmlns='http://www.w3.org/2000/svg'/>" },
    { path: "dist/host.js", data: "export const name = 'hello'; export function apply() {}\n" },
  ]);
}

test("manual installation is refused by default and allowed when allowManual is true", () => {
  const { zip } = makeBuiltPackage();
  assert.throws(() => inspectPackage(zip, { source: "manual" }), { code: "manual-disabled" });
  const inspected = inspectPackage(zip, { source: "manual", allowManual: true });
  assert.equal(inspected.id, "@ann/hello");
  assert.equal(inspected.confirmation.unreviewed, true);
  assert.deepEqual(inspected.confirmation.nodeApis, ["os"]);
});

test("a beta app build installs a package whose engine range is older", () => {
  const { zip } = makeBuiltPackage({ engines: ">=0.3.10" });
  const inspected = inspectPackage(zip, { source: "manual", allowManual: true, appVersion: "0.3.11-beta.4" });
  assert.equal(inspected.id, "@ann/hello");
  assert.throws(
    () => inspectPackage(zip, { source: "manual", allowManual: true, appVersion: "0.3.10-beta.1" }),
    { code: "bad-manifest" },
  );
});

test("installPackage unpacks into packages/<scope>/<name>, writes plugins.yml, and uninstallPackage removes it", () => {
  const dir = tempDir();
  const { zip, sha256: _unused } = makeBuiltPackage({ replaces: ["lyrics/v1"] });
  assert.throws(() => installPackage(zip, { dir, expectedSha256: "0".repeat(64) }), { code: "bad-sha256" });

  const installed = installPackage(zip, { dir, source: "market" });
  assert.equal(installed.id, "@ann/hello");
  assert.ok(existsSync(join(installed.root, "package.json")));
  assert.ok(existsSync(join(installed.root, "dist", "host.js")));
  const yml = readFileSync(join(dir, "plugins.yml"), "utf8");
  assert.match(yml, /- id: "@ann\/hello"/);
  assert.match(yml, /source: market/);
  assert.match(yml, /- "lyrics\/v1"/);

  uninstallPackage(dir, "@ann/hello");
  assert.ok(!existsSync(installed.root));
  assert.equal(readFileSync(join(dir, "plugins.yml"), "utf8").trim(), "[]");
});

test("revocations block installing a disabled version and disable already installed versions without deleting files", () => {
  const dir = tempDir();
  const { zip } = makeBuiltPackage({ version: "1.0.0" });
  const installed = installPackage(zip, { dir, source: "market" });

  const merged = mergeRevoked(emptyRevocations(), {
    format: 3,
    serial: 1,
    generatedAt: "2026-11-17T00:00:00Z",
    expires: "2027-01-01T00:00:00Z",
    entries: [
      {
        id: "rev-1",
        name: "@ann/hello",
        version: "1.0.0",
        level: "disable",
        reason: { "zh-CN": "含恶意代码", en: "Malicious code" },
      },
    ],
    withdrawn: [],
  });
  assert.equal(merged.ok, true);

  assert.throws(() => installPackage(zip, { dir, revocations: merged.state }), { code: "revoked" });

  const applied = applyRevocationsToDir(dir, merged.state, {
    installed: [{ id: "@ann/hello", version: "1.0.0", source: "market" }],
  });
  assert.deepEqual(applied.disabled, ["@ann/hello"]);
  assert.ok(existsSync(join(installed.root, "package.json")));
  assert.match(readFileSync(join(dir, "plugins.yml"), "utf8"), /disabled: true/);
});

test("package names whose scope or name is only dots are refused before any path is built", async () => {
  const { isPackageId } = await import("../src/installer.mjs");
  for (const id of ["@x/..", "@x/.", "@x/...", "@../x", "@./x", "@x/../y", "@x", "x/y", "", null, 7]) {
    assert.equal(isPackageId(id), false, String(id));
  }
  for (const id of ["@ann/hello", "@ann/hello.world", "@ann/.hidden", "@ann/a..b"]) assert.equal(isPackageId(id), true, id);

  const dir = tempDir();
  const installed = installPackage(makeBuiltPackage().zip, { dir, source: "market" });
  mkdirSync(join(dir, "data", "@x"), { recursive: true });
  writeFileSync(join(dir, "data", "@x", "keep.json"), "{}");
  for (const id of ["@x/..", "@x/.", "@../x", "@./x"]) {
    assert.throws(() => uninstallPackage(dir, id, { removeData: true }), { code: "bad-name" }, id);
  }
  assert.ok(existsSync(join(installed.root, "package.json")));
  assert.ok(existsSync(join(dir, "data", "@x", "keep.json")));

  const merged = mergeRevoked(emptyRevocations(), {
    format: 3,
    serial: 1,
    generatedAt: "2026-11-01T00:00:00Z",
    expires: "2099-01-01T00:00:00Z",
    entries: [{ id: "rev-dots", name: "@x/..", version: "1.0.0", level: "disable", reason: { en: "x" } }],
    withdrawn: [],
  });
  assert.ok(merged.ok);
  const applied = applyRevocationsToDir(dir, merged.state, { installed: [{ id: "@x/..", version: "1.0.0", source: "market" }] });
  assert.deepEqual(applied.disabled, []);
  assert.doesNotMatch(readFileSync(join(dir, "plugins.yml"), "utf8"), /@x\/\.\./);
});
