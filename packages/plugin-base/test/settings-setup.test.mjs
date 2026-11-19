import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";
import { SETUP_HINT_MAX, startHost } from "@fuyu/plugin-base/host";
import { workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of [...cleanup].reverse()) await step();
});

const setupOf = (host, id) => host.status().find((item) => item.id === id)?.setup;

async function hostWith(files) {
  const made = workspace(files);
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

test("a plugin that says it still needs setup carries the mark until it says it is done", async () => {
  const host = await hostWith({
    "data/plugins.yml": "- id: weather\n  name: ./weather.mjs\n- id: quiet\n  name: ./quiet.mjs\n",
    "data/weather.mjs": [
      'export const name = "weather";',
      'export const inject = ["settings"];',
      "export function apply(ctx) {",
      '  void ctx.settings.setup({ needed: true, hint: { "zh-CN": "  选一个\\n城市 ", en: "Pick a city", fr: "Choisir" } });',
      "  globalThis.setupProbe = (state) => ctx.settings.setup(state);",
      "}",
    ].join("\n"),
    "data/quiet.mjs": 'export const name = "quiet";\nexport function apply() {}\n',
  });
  assert.equal(host.status().find((item) => item.id === "weather")?.state, "running");
  assert.deepEqual(setupOf(host, "weather"), { hint: { "zh-CN": "选一个 城市", en: "Pick a city" } });
  assert.equal("setup" in host.status().find((item) => item.id === "quiet"), false);

  let changes = 0;
  const stop = host.watchStatus(() => void (changes += 1));
  await globalThis.setupProbe({ needed: false, hint: "ignored" });
  await new Promise((resolve) => setTimeout(resolve, 80));
  stop();
  assert.equal(setupOf(host, "weather"), undefined);
  assert.equal(changes, 1);

  await globalThis.setupProbe({ needed: true, hint: "x".repeat(SETUP_HINT_MAX + 20) });
  assert.deepEqual(setupOf(host, "weather"), { hint: "x".repeat(SETUP_HINT_MAX) });
  await globalThis.setupProbe({ needed: true, hint: 42 });
  assert.deepEqual(setupOf(host, "weather"), { hint: null });
  await globalThis.setupProbe("yes");
  assert.equal(setupOf(host, "weather"), undefined);
});

test("window code reports for its own plugin, and the last report wins", async () => {
  const host = await hostWith({
    "data/plugins.yml": "- id: issues\n  name: ./issues.mjs\n- id: off\n  name: ./issues.mjs\n  disabled: true\n",
    "data/issues.mjs": 'export const name = "issues";\nexport function apply() {}\n',
  });
  let report = null;
  const loader = createLoader({
    registry: createSlots({}),
    base: "fuyu-plugin://localhost",
    reportSetup: (plugin, state) => host.settingsOpener.setup(plugin, state),
    importModule: async () => ({ default: (ctx) => void (report = (state) => ctx.settings.setup(state)) }),
    checkFile: async () => undefined,
  });
  await loader.sync([{ id: "issues#island", plugin: "issues", window: "island", path: "issues/island.js", version: "1" }]);
  await report({ needed: true, hint: "Add a repository", plugin: "someone-else" });
  assert.deepEqual(setupOf(host, "issues"), { hint: "Add a repository" });
  assert.equal(host.status().some((item) => item.id === "someone-else"), false);
  await report({ needed: false });
  assert.equal(setupOf(host, "issues"), undefined);
  await loader.stop();

  host.settingsOpener.setup("off", { needed: true });
  assert.equal(setupOf(host, "off"), undefined);
  assert.equal(host.settingsOpener.setupOf("off"), null);
  assert.throws(() => host.settingsOpener.setup("", { needed: true }), { code: "bad-params" });
});

test("a window that cannot report rejects with not-ready, and the plugin still loads", async () => {
  let report = null;
  const loader = createLoader({
    registry: createSlots({}),
    base: "fuyu-plugin://localhost",
    importModule: async () => ({ default: (ctx) => void (report = () => ctx.settings.setup({ needed: true })) }),
    checkFile: async () => undefined,
  });
  await loader.sync([{ id: "clock#island", plugin: "clock", window: "island", path: "clock/island.js", version: "1" }]);
  assert.equal(loader.status().get("clock#island").state, "running");
  await assert.rejects(report(), { code: "not-ready" });
  await loader.stop();
});
