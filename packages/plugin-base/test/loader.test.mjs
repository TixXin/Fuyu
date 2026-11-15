import assert from "node:assert/strict";
import { test } from "node:test";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";

const View = () => null;

function fakeModules(table) {
  const imported = [];
  return {
    imported,
    importModule: async (url) => {
      imported.push(url);
      const path = new URL(url).pathname.slice(1);
      const module = table[path];
      if (!module) throw new Error(`no module at ${path}`);
      return module;
    },
    checkFile: async (url) => {
      if (!table[new URL(url).pathname.slice(1)]) throw new Error(`the file is missing: ${url}`);
    },
  };
}

const entry = (id, path, version = "1") => ({ id, plugin: id.split("#")[0], window: "main", path, version });

test("a plugin's window code is loaded, puts its items in slots, and they go when the plugin goes", async () => {
  const registry = createSlots({ "island.page/v1": {} });
  const modules = fakeModules({
    "hello/island.js": { default: (ctx) => ctx.slots.add("island.page/v1", { id: "hello", component: View }) },
  });
  const loader = createLoader({ registry, base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("hello#1", "hello/island.js")]);
  assert.deepEqual(registry.items("island.page/v1").map((item) => [item.id, item.owner]), [["hello", "hello"]]);
  assert.equal(loader.status().get("hello#1").state, "running");
  assert.equal(modules.imported[0], "fuyu-plugin://localhost/hello/island.js?v=1");
  await loader.sync([]);
  assert.deepEqual(registry.items("island.page/v1"), []);
  assert.equal(loader.status().size, 0);
});

test("a new version is loaded from a new address, and the old one's items are gone first", async () => {
  const registry = createSlots({ "island.page/v1": {} });
  const V1 = () => "v1";
  const V2 = () => "v2";
  const table = { "hello/island.js": { default: (ctx) => ctx.slots.add("island.page/v1", { id: "hello", component: V1 }) } };
  const modules = fakeModules(table);
  const loader = createLoader({ registry, base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("hello#1", "hello/island.js", "1")]);
  table["hello/island.js"] = { default: { apply: (ctx) => ctx.slots.add("island.page/v1", { id: "hello", component: V2 }) } };
  await loader.sync([entry("hello#1", "hello/island.js", "2")]);
  assert.deepEqual(modules.imported, ["fuyu-plugin://localhost/hello/island.js?v=1", "fuyu-plugin://localhost/hello/island.js?v=2"]);
  assert.deepEqual(registry.items("island.page/v1").map((item) => item.component), [V2]);
});

test("a missing file, a module without a plugin and a plugin that throws are each reported, and the others still load", async () => {
  const registry = createSlots({ "island.page/v1": {} });
  const modules = fakeModules({
    "empty/island.js": { something: 1 },
    "broken/island.js": {
      default: (ctx) => {
        ctx.slots.add("island.page/v1", { id: "half", component: View });
        throw new Error("broken on purpose");
      },
    },
    "good/island.js": { default: (ctx) => ctx.slots.add("island.page/v1", { id: "good", component: View }) },
  });
  const loader = createLoader({ registry, base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("ghost#1", "ghost/island.js"), entry("empty#1", "empty/island.js"), entry("broken#1", "broken/island.js"), entry("good#1", "good/island.js")]);
  const status = loader.status();
  assert.match(status.get("ghost#1").error, /missing/);
  assert.match(status.get("empty#1").error, /does not export a plugin/);
  assert.equal(status.get("good#1").state, "running");
  assert.deepEqual(registry.items("island.page/v1").map((item) => item.id), ["good"], "the broken plugin's half-made item was taken back");
});

test("a plugin that adds to a slot that does not exist fails without taking the window down", async () => {
  const registry = createSlots({ "island.page/v1": {} });
  const modules = fakeModules({ "lost/island.js": { default: (ctx) => ctx.slots.add("nowhere/v1", { id: "x", component: View }) } });
  const loader = createLoader({ registry, base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("lost#1", "lost/island.js")]);
  const status = loader.status().get("lost#1");
  assert.equal(status.state, "failed");
  assert.match(status.error, /nowhere\/v1/);
});
