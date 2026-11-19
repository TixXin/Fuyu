import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SLOT_THEME } from "../../packages/plugin-base/src/protocol.mjs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const declared = (css) => [...new Set([...css.matchAll(/^\s*(--fuyu-plugin-[\w-]+)\s*:/gm)].map((match) => match[1]))];
const used = (source) => [...new Set([...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]))];

test("the island's plugin slot defines exactly the public theme variables", () => {
  assert.deepEqual(declared(read("src/features/plugin-kernel/PluginSlot.css")).sort(), [...SLOT_THEME].sort());
});

test("the slot sets color-scheme for the dark island and the light one, so light-dark() follows the island", () => {
  const css = read("src/features/plugin-kernel/PluginSlot.css");
  const rule = (selector) => new RegExp(`^${selector.replace(/\./g, "\\.")} \\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";
  assert.match(rule(".plugin-slot"), /color-scheme:\s*dark;/);
  assert.match(rule(".island-light .plugin-slot"), /color-scheme:\s*light;/);
  assert.deepEqual(declared(rule(".island-light .plugin-slot")).filter((name) => !SLOT_THEME.includes(name)), []);
});

test("the public theme variables all start with --fuyu-plugin- and are unique", () => {
  assert.ok(SLOT_THEME.every((name) => name.startsWith("--fuyu-plugin-")));
  assert.equal(new Set(SLOT_THEME).size, SLOT_THEME.length);
});

test("the example plugin colors itself only with the public theme variables", () => {
  const names = used(read("packages/plugin-base/examples/hello/island.js"));
  assert.ok(names.length > 0);
  assert.deepEqual(names.filter((name) => !SLOT_THEME.includes(name)), []);
});
