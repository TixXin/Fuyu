import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { registerDevEntry } from "../../packages/plugin-cli/src/dev.mjs";
import { writeInstalledToYml } from "../../packages/plugin-cli/src/installer.mjs";
import { createMarketService } from "../../src/features/updater/host/market.mjs";
import { installedEntries } from "../../src/windows/settings/pluginEntries.ts";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "fuyu-dev-remove-"));
  const devFolder = join(root, "work", "hello", "dist");
  mkdirSync(devFolder, { recursive: true });
  writeFileSync(join(devFolder, "host.js"), "export function apply() {}\n");
  const yml = join(root, "plugins.yml");
  writeInstalledToYml(yml, { id: "@someone/clock", source: "market" });
  registerDevEntry(yml, "hello", devFolder);
  let changed = 0;
  const market = createMarketService({ dataDir: join(root, "data", "updater"), pluginsDir: root, onConfigChanged: () => { changed += 1; } });
  return { root, devFolder, yml, market, changes: () => changed };
}

test("removing a dev plugin drops only its plugins.yml entry and leaves the dev folder", async () => {
  const { root, devFolder, yml, market, changes } = setup();
  try {
    const data = join(root, "data", "hello");
    mkdirSync(data, { recursive: true });
    assert.deepEqual(await market.uninstall({ id: "hello" }), { id: "hello", removed: true });
    const after = readFileSync(yml, "utf8");
    assert.doesNotMatch(after, /hello/);
    assert.match(after, /- id: "@someone\/clock"\n {2}source: market/);
    assert.ok(existsSync(join(devFolder, "host.js")));
    assert.ok(existsSync(data));
    assert.equal(changes(), 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("removing a dev plugin with removeData deletes data/<id>, even for an unscoped id", async () => {
  const { root, devFolder, market } = setup();
  try {
    const data = join(root, "data", "hello");
    mkdirSync(data, { recursive: true });
    writeFileSync(join(data, "state.json"), "{}");
    await market.uninstall({ id: "hello", removeData: true });
    assert.equal(existsSync(data), false);
    assert.ok(existsSync(devFolder));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("removing a dev plugin keeps the market package installed under the same id", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-dev-remove-"));
  try {
    const pkgDir = join(root, "packages", "@someone", "clock");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "@someone/clock", version: "1.0.0" }));
    const devFolder = join(root, "work", "clock", "dist");
    mkdirSync(devFolder, { recursive: true });
    registerDevEntry(join(root, "plugins.yml"), "@someone/clock", devFolder);
    const market = createMarketService({ dataDir: join(root, "data", "updater"), pluginsDir: root });
    await market.uninstall({ id: "@someone/clock", removeData: true });
    assert.ok(existsSync(join(pkgDir, "package.json")));
    assert.ok(existsSync(devFolder));
    assert.equal(readFileSync(join(root, "plugins.yml"), "utf8").trim(), "[]");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a dev plugin is removable on the plugin page but not managed", () => {
  const context = { live: true, runtime: "ready", builtins: [] };
  const entries = installedEntries([
    { id: "hello", name: "hello", state: "running", kind: "third-party", source: "dev" },
    { id: "@someone/clock", name: "Clock", state: "running", kind: "third-party", source: "market" },
    { id: "@me/gadget", name: "Gadget", state: "running", kind: "third-party", source: "manual" },
    { id: "my-local-tool", name: "./my-local-tool/index.mjs", state: "running", kind: "third-party" },
    { id: "loose", name: "./loose.mjs", state: "running", kind: "third-party", source: "file" },
  ], new Set(), null, context, "en");
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, [entry.managed, entry.removable]]));
  assert.deepEqual(byId, { hello: [false, true], "@someone/clock": [true, true], "@me/gadget": [true, true], "my-local-tool": [false, false], loose: [false, true] });
});

test("a plugin listed by file path is removed the same way, but a built-in's settings entry is not", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-dev-remove-"));
  try {
    const folder = join(root, "hello");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "host.mjs"), "export const name = 'hello';\n");
    const yml = join(root, "plugins.yml");
    writeFileSync(yml, "- id: hello\n  name: ./hello/host.mjs\n- id: claude-usage\n  disabled: true\n");
    mkdirSync(join(root, "data", "hello"), { recursive: true });
    const market = createMarketService({ dataDir: join(root, "data", "updater"), pluginsDir: root });
    await market.uninstall({ id: "hello", removeData: true });
    assert.equal(readFileSync(yml, "utf8"), "- id: claude-usage\n  disabled: true\n");
    assert.ok(existsSync(join(folder, "host.mjs")));
    assert.equal(existsSync(join(root, "data", "hello")), false);
    await assert.rejects(market.uninstall({ id: "claude-usage" }), { code: "not-found" });
    assert.equal(readFileSync(yml, "utf8"), "- id: claude-usage\n  disabled: true\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
