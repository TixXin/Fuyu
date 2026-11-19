import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";
import { SETTINGS_OPEN_EVENT, startHost } from "@fuyu/plugin-base/host";
import { workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of [...cleanup].reverse()) await step();
});

function fakeModules(table) {
  return {
    importModule: async (url) => table[new URL(url).pathname.slice(1)],
    checkFile: async () => undefined,
  };
}

const entry = (id, path) => ({ id, plugin: id.split("#")[0], window: "island", path, version: "1" });

test("window code opens its own settings, whatever it passes", async () => {
  const opened = [];
  let open = null;
  const modules = fakeModules({
    "weather/island.js": {
      default: (ctx) => {
        open = (...args) => ctx.settings.open(...args);
      },
    },
  });
  const loader = createLoader({ registry: createSlots({}), base: "fuyu-plugin://localhost", openSettings: (plugin) => void opened.push(plugin), ...modules });
  await loader.sync([entry("@fuyu/weather#island", "weather/island.js")]);
  assert.equal(loader.status().get("@fuyu/weather#island").state, "running");
  await open();
  await open("@someone/else");
  assert.deepEqual(opened, ["@fuyu/weather", "@fuyu/weather"]);
  await loader.stop();
});

test("a window without an opener rejects with not-ready, and the plugin still loads", async () => {
  let open = null;
  const modules = fakeModules({ "clock/island.js": { default: (ctx) => void (open = () => ctx.settings.open()) } });
  const loader = createLoader({ registry: createSlots({}), base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("clock#island", "clock/island.js")]);
  assert.equal(loader.status().get("clock#island").state, "running");
  await assert.rejects(open(), { code: "not-ready" });
  await loader.stop();
});

test("host code asks the island window to open the calling plugin's settings", async () => {
  const made = workspace({
    "data/plugins.yml": "- id: opener\n  name: ./opener.mjs\n",
    "data/opener.mjs": [
      'export const name = "opener";',
      'export const inject = ["settings"];',
      "export function apply(ctx) {",
      "  globalThis.settingsProbe = { open: (...args) => ctx.settings.open(...args) };",
      "}",
    ].join("\n"),
  });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.equal(host.status().find((item) => item.id === "opener")?.state, "running");

  await assert.rejects(globalThis.settingsProbe.open(), { code: "not-ready" });

  const published = [];
  let connected = ["settings"];
  const detach = host.settingsOpener.attachWindows({ connected: () => connected, publish: (name, data) => published.push([name, data]) });
  await assert.rejects(globalThis.settingsProbe.open(), { code: "not-ready" });
  connected = ["settings", "island"];
  await globalThis.settingsProbe.open("@someone/else");
  assert.deepEqual(published, [[SETTINGS_OPEN_EVENT, { plugin: "opener" }]]);
  detach();
  await assert.rejects(globalThis.settingsProbe.open(), { code: "not-ready" });
});
