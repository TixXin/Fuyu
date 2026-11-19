import assert from "node:assert/strict";
import { join } from "node:path";
import { after, test } from "node:test";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";
import { ISLAND_REQUEST_EVENT, startHost } from "@fuyu/plugin-base/host";
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

test("window code reaches the island under its own id and gets collapse's answer back", async () => {
  const calls = [];
  let island = null;
  const modules = fakeModules({ "launchpad/island.js": { default: (ctx) => void (island = ctx.island) } });
  const control = {
    open: async (plugin, page) => void calls.push(["open", plugin, page]),
    collapse: async (plugin) => {
      calls.push(["collapse", plugin]);
      return false;
    },
  };
  const loader = createLoader({ registry: createSlots({}), base: "fuyu-plugin://localhost", island: control, ...modules });
  await loader.sync([entry("@fuyu/launchpad#island", "launchpad/island.js")]);
  assert.equal(loader.status().get("@fuyu/launchpad#island").state, "running");
  await island.open();
  await island.open("launchpad-recent");
  assert.equal(await island.collapse(), false);
  await assert.rejects(island.open(42), { code: "bad-params" });
  assert.deepEqual(calls, [
    ["open", "@fuyu/launchpad", undefined],
    ["open", "@fuyu/launchpad", "launchpad-recent"],
    ["collapse", "@fuyu/launchpad"],
  ]);
  await loader.stop();
});

test("a window without an island control rejects with not-ready, and the plugin still loads", async () => {
  let island = null;
  const modules = fakeModules({ "clock/island.js": { default: (ctx) => void (island = ctx.island) } });
  const loader = createLoader({ registry: createSlots({}), base: "fuyu-plugin://localhost", ...modules });
  await loader.sync([entry("clock#island", "clock/island.js")]);
  assert.equal(loader.status().get("clock#island").state, "running");
  await assert.rejects(island.open(), { code: "not-ready" });
  await assert.rejects(island.collapse(), { code: "not-ready" });
  await loader.stop();
});

test("host code asks the island window to open its page and gets the island's refusal back", async () => {
  const made = workspace({
    "data/plugins.yml": "- id: opener\n  name: ./opener.mjs\n",
    "data/opener.mjs": [
      'export const name = "opener";',
      'export const inject = ["island"];',
      "export function apply(ctx) {",
      "  globalThis.islandProbe = { open: (...args) => ctx.island.open(...args), collapse: ctx.island.collapse, notify: ctx.island.notify, onNoticeAction: ctx.island.onNoticeAction };",
      "}",
    ].join("\n"),
  });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  assert.equal(host.status().find((item) => item.id === "opener")?.state, "running");
  assert.equal(globalThis.islandProbe.collapse, undefined);
  assert.equal(globalThis.islandProbe.notify, undefined);
  assert.equal(globalThis.islandProbe.onNoticeAction, undefined);

  await assert.rejects(globalThis.islandProbe.open(), { code: "not-ready" });

  const published = [];
  const detach = host.islandControl.attachWindows({ connected: () => ["island"], publish: (name, data) => published.push([name, data]) });
  const opened = globalThis.islandProbe.open("opener-page");
  const refused = globalThis.islandProbe.open("weather");
  assert.deepEqual(published, [
    [ISLAND_REQUEST_EVENT, { id: 1, action: "open", plugin: "opener", page: "opener-page" }],
    [ISLAND_REQUEST_EVENT, { id: 2, action: "open", plugin: "opener", page: "weather" }],
  ]);
  assert.throws(() => host.islandControl.settle({ id: 1, value: null }, "settings"), { code: "bad-params" });
  assert.equal(host.islandControl.settle({ id: 1, value: null }, "island"), true);
  assert.equal(host.islandControl.settle({ id: 2, error: { code: "not-owner", message: "weather is not one of opener's island pages" } }, "island"), true);
  assert.equal(await opened, undefined);
  await assert.rejects(refused, { code: "not-owner" });
  assert.equal(host.islandControl.settle({ id: 2, value: null }, "island"), false);

  const pending = globalThis.islandProbe.open();
  detach();
  await assert.rejects(pending, { code: "peer-gone" });
});

test("windows other than the island go through the host, and a silent island times out", async () => {
  const made = workspace({ "data/plugins.yml": "[]\n" });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  host.islandControl.timeoutMs = 20;
  const published = [];
  host.islandControl.attachWindows({ connected: () => ["island", "settings"], publish: (name, data) => published.push([name, data]) });
  const collapsing = host.islandControl.request("collapse", "@fuyu/launchpad");
  host.islandControl.settle({ id: published[0][1].id, value: false }, "island");
  assert.equal(await collapsing, false);
  await assert.rejects(host.islandControl.request("open", ""), { code: "bad-params" });
  await assert.rejects(host.islandControl.request("open", "@fuyu/launchpad"), { code: "timeout" });
});

test("a host notice goes to the island once and comes back with the island's shown, or false when the island cannot answer", async () => {
  const made = workspace({ "data/plugins.yml": "[]\n" });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  const control = host.islandControl;
  control.noticeTimeoutMs = 20;
  const notice = { source: "alarm", pluginId: "@fuyu/alarm", title: "Wake up", body: "7:00", actions: ["snooze"] };

  assert.equal(await control.notify(notice), false);
  const published = [];
  let connected = ["settings"];
  const detach = control.attachWindows({ connected: () => connected, publish: (name, data) => published.push([name, data]) });
  assert.equal(await control.notify(notice), false);
  assert.deepEqual(published, []);

  connected = ["island", "settings"];
  const shown = control.notify(notice);
  assert.deepEqual(published, [[ISLAND_REQUEST_EVENT, { id: published[0]?.[1].id, action: "notify", plugin: "@fuyu/alarm", notice }]]);
  control.settle({ id: published[0][1].id, value: true }, "island");
  assert.equal(await shown, true);

  const hidden = control.notify(notice);
  control.settle({ id: published[1][1].id, value: false }, "island");
  assert.equal(await hidden, false);

  const refused = control.notify(notice);
  control.settle({ id: published[2][1].id, error: { code: "not-ready", message: "the island cannot show notices yet" } }, "island");
  assert.equal(await refused, false);

  assert.equal(await control.notify(notice), false);
  assert.equal(published.length, 4);

  const leaving = control.notify(notice);
  detach();
  assert.equal(await leaving, false);
  assert.equal(await control.notify({ title: "no plugin id" }), false);
  assert.equal(published.length, 5);
});

test("notice actions come only from the island window and reach every listener until it stops listening", async () => {
  const made = workspace({ "data/plugins.yml": "[]\n" });
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data") });
  cleanup.push(() => host.stop());
  await host.settle();
  const heard = [];
  const off = host.islandControl.onNoticeAction((data) => heard.push(data));
  assert.throws(() => host.islandControl.noticeAction({ pluginId: "@fuyu/pomodoro", action: "skip" }, "settings"), { code: "bad-params" });
  assert.throws(() => host.islandControl.noticeAction({ pluginId: "@fuyu/pomodoro" }, "island"), { code: "bad-params" });
  assert.equal(host.islandControl.noticeAction({ pluginId: "@fuyu/pomodoro", action: "skip" }, "island"), true);
  off();
  host.islandControl.noticeAction({ pluginId: "@fuyu/pomodoro", action: "again" }, "island");
  assert.deepEqual(heard, [{ pluginId: "@fuyu/pomodoro", action: "skip" }]);
});
