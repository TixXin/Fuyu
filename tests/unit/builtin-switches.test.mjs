import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { zhCN, en } from "../../src/i18n/sections/settings/pluginsV3.ts";
import { disabledBuiltinIds, normalizeBuiltinPlugins } from "../../src/features/plugin-kernel/builtinSwitches.ts";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const catalog = JSON.parse(readFileSync(join(BUILTINS, "builtins.json"), "utf8"));
const ids = catalog.plugins.map((plugin) => plugin.id);
const RUST_WRITES = (off) => (off.length ? off.map((id) => `- id: ${id}\n  disabled: true\n`).join("") : "[]\n");

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return check();
}

test("the built-in list names all 22 plugins, each with a host entry, and only the updater is essential", () => {
  assert.equal(ids.length, 22);
  assert.equal(new Set(ids).size, 22);
  for (const plugin of catalog.plugins) {
    assert.ok(existsSync(join(BUILTINS, plugin.root, plugin.host)), `${plugin.id} has no host entry at ${plugin.root}/${plugin.host}`);
    if (plugin.background !== undefined) assert.ok(Array.isArray(plugin.background) && plugin.background.every((name) => typeof name === "string"), plugin.id);
  }
  assert.deepEqual(catalog.plugins.filter((plugin) => plugin.kind === "essential").map((plugin) => plugin.id), ["updater"]);
});

test("every built-in plugin has a name in both languages", () => {
  for (const text of [zhCN, en]) {
    assert.deepEqual(Object.keys(text.builtinNames).sort(), [...ids].sort());
    assert.ok(Object.values(text.builtinNames).every((name) => typeof name === "string" && name.trim()));
  }
});

test("the switch list from Rust is checked before the window uses it", () => {
  assert.equal(normalizeBuiltinPlugins(null), null);
  assert.equal(normalizeBuiltinPlugins({}), null);
  const plugins = normalizeBuiltinPlugins([
    { id: "timer", kind: "builtin", enabled: false, background: [{ name: "ticker", registered: true, running: false }, { bad: 1 }] },
    { id: "updater", kind: "essential", enabled: true },
    { id: 3, enabled: true },
    null,
    { id: "odd", kind: "weird", enabled: true, background: "no" },
  ]);
  assert.deepEqual(plugins, [
    { id: "timer", kind: "builtin", enabled: false, background: [{ name: "ticker", registered: true, running: false }] },
    { id: "updater", kind: "essential", enabled: true, background: [] },
    { id: "odd", kind: "builtin", enabled: true, background: [] },
  ]);
  assert.deepEqual(disabledBuiltinIds(plugins), ["timer"]);
  assert.deepEqual(disabledBuiltinIds(null), []);
});

test("the host switches built-in plugins off and on from the plugins.yml Rust writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "builtin-switches-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), RUST_WRITES([]));
  const host = await startHost({ dir, builtins: BUILTINS, watch: true });
  cleanup.push(() => host.stop());
  await host.settle();
  const state = (id) => host.status().find((plugin) => plugin.id === id)?.state;
  assert.deepEqual(ids.filter((id) => state(id) === undefined || state(id) === "disabled"), []);
  for (const id of ["timer", "translation", "clipboard"]) assert.equal(state(id), "running", id);
  writeFileSync(join(dir, "plugins.yml"), RUST_WRITES(["timer", "translation"]));
  assert.ok(await until(() => state("timer") === "disabled" && state("translation") === "disabled"), `timer ${state("timer")}, translation ${state("translation")}`);
  const timer = host.status().find((plugin) => plugin.id === "timer");
  assert.equal(timer.usage?.timers ?? 0, 0);
  assert.equal(state("clipboard"), "running");
  writeFileSync(join(dir, "plugins.yml"), RUST_WRITES([]));
  assert.ok(await until(() => state("timer") === "running" && state("translation") === "running"), `timer ${state("timer")}, translation ${state("translation")}`);
});
