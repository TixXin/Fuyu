import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLoader, createLocaleStore, createSlots, normalizeLocale, pickLocale } from "../src/client/index.mjs";
import { startHost } from "../src/host/index.mjs";

test("normalizeLocale and pickLocale follow slotTitle fallback rules", () => {
  assert.equal(normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("ja"), "zh-CN");
  assert.equal(normalizeLocale(null), "zh-CN");

  assert.equal(pickLocale("  hello  ", "zh-CN"), "hello");
  assert.equal(pickLocale({ "zh-CN": "天气", en: "Weather" }, "zh-CN"), "天气");
  assert.equal(pickLocale({ "zh-CN": "天气", en: "Weather" }, "en"), "Weather");
  assert.equal(pickLocale({ "zh-CN": "天气" }, "en"), "天气");
  assert.equal(pickLocale({ en: "Weather" }, "zh-CN"), "Weather");
  assert.equal(pickLocale({ zh: "简中", en: "English" }, "zh-CN"), "简中");
  assert.equal(pickLocale({ fr: "Bonjour" }, "en"), "Bonjour");
  assert.equal(pickLocale({}, "en"), "");
  assert.equal(pickLocale(null, "en"), "");
});

test("host ctx.locale exposes initial locale, pushes changes, and cleans up on plugin stop", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fuyu-locale-host-"));
  try {
    writeFileSync(
      join(dir, "reader.mjs"),
      `export const inject = ["locale"];
export const seen = [];
export let currentLocale = null;
export let picked = null;
export function apply(ctx) {
  currentLocale = ctx.locale.current;
  picked = ctx.locale.pick({ "zh-CN": "中文", en: "English" });
  ctx.locale.onChange((next) => {
    seen.push({ next, picked: ctx.locale.pick({ "zh-CN": "中文", en: "English" }) });
  });
}
`,
    );
    writeFileSync(join(dir, "plugins.yml"), "- id: reader\n  name: ./reader.mjs\n");

    const host = await startHost({ dir, locale: "en" });
    await host.settle();
    const mod = await import(`${new URL(`file://${join(dir, "reader.mjs")}`).href}`);
    assert.equal(host.locale.current(), "en");
    assert.equal(mod.currentLocale, "en");
    assert.equal(mod.picked, "English");

    assert.equal(host.locale.set("en-US"), false);
    assert.equal(host.locale.set("zh-CN"), true);
    assert.deepEqual(mod.seen, [{ next: "zh-CN", picked: "中文" }]);

    await host.stop();
    host.locale.set("en");
    assert.equal(mod.seen.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("client loader injects ctx.locale and unsubscribes when the plugin unloads", async () => {
  const store = createLocaleStore("en");
  const seen = [];
  let initial = null;
  let picked = null;
  const registry = createSlots({ "island.page/v1": { kind: "list", perPlugin: 2, meta: [] } }, { window: "island" });
  const loader = createLoader({
    registry,
    base: "fuyu-plugin://localhost",
    locale: store,
    checkFile: async () => {},
    importModule: async () => ({
      default(ctx) {
        initial = ctx.locale.current;
        picked = ctx.locale.pick({ "zh-CN": "标题", en: "Title" });
        ctx.locale.onChange((next) => seen.push(next));
      },
    }),
  });

  await loader.sync([{ id: "one", plugin: "one", window: "island", path: "one/island.js", version: "1" }]);
  assert.equal(initial, "en");
  assert.equal(picked, "Title");

  store.set("zh-CN");
  assert.deepEqual(seen, ["zh-CN"]);

  await loader.sync([]);
  store.set("en");
  assert.deepEqual(seen, ["zh-CN"]);
});
