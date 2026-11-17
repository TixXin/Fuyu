import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { createServiceProxy } from "@fuyu/plugin-base/client";
import { createWindowServices } from "@fuyu/plugin-base/client/window-services";
import { defineService, lyricsV1, mediaV1 } from "@fuyu/plugin-services";
import { zhCN as pluginsV3Text } from "../../src/i18n/sections/settings/pluginsV3.ts";
import {
  BUILTIN_PROVIDES,
  detectServiceConflicts,
  explainReplacedServices,
  explainWaitingFor,
  stateOf,
} from "../../src/windows/settings/pluginServiceStatus.ts";
import { createWaitingMonitor } from "../../src/features/plugin-kernel/waitingMonitor.ts";

const BUILTINS_DIR = fileURLToPath(new URL("../../src/features/", import.meta.url));
const BUILTINS_JSON = JSON.parse(readFileSync(join(BUILTINS_DIR, "builtins.json"), "utf8"));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

test("builtins.json declares provides for all built-in service plugins and matches BUILTIN_PROVIDES", () => {
  const byId = new Map(BUILTINS_JSON.plugins.map((p) => [p.id, p.provides ?? []]));
  for (const [id, services] of Object.entries(BUILTIN_PROVIDES)) {
    assert.deepEqual(byId.get(id), services, `mismatch on ${id}`);
  }
});

test("disabledServices or replaces yields only the conflicting service without disabling the whole built-in plugin", async () => {
  const dir = mkdtempSync(join(tmpdir(), "service-replace-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, "custom-lyrics.mjs"),
    `import { defineService } from "@fuyu/plugin-base/services";
const lyricsV1 = defineService("lyrics/v1", { methods: { lookup: true, sources: true }, events: { changed: true } });
export const name = "custom-lyrics";
export function apply(ctx) {
  ctx.services.provide(lyricsV1, {
    lookup: () => ({ source: "custom-plugin", lrc: "[00:00.00]replaced" }),
    sources: () => ({ sources: [{ id: "custom-plugin", order: 1 }] }),
  });
}
`,
  );
  writeFileSync(
    join(dir, "plugins.yml"),
    `- id: custom-lyrics\n  name: ./custom-lyrics.mjs\n  replaces:\n    - lyrics/v1\n`,
  );
  const host = await startHost({ dir, builtins: BUILTINS_DIR });
  cleanup.push(() => host.stop());
  await host.settle();

  const musicStatus = host.status().find((p) => p.id === "music");
  assert.equal(musicStatus.state, "running");
  assert.deepEqual(musicStatus.disabledServices, ["lyrics/v1"]);
  assert.deepEqual(musicStatus.replacedServices, [{ service: "lyrics/v1", by: "custom-lyrics" }]);

  const services = host.services();
  assert.equal(services.find((s) => s.name === "media/v1")?.plugin, "music");
  assert.equal(services.find((s) => s.name === "lyrics/v1")?.plugin, "custom-lyrics");

  let client;
  await host.ctx.plugin({ name: "caller", apply: (ctx) => void (client = ctx.services.get(lyricsV1)) });
  assert.deepEqual(await client.lookup({ title: "Any" }), { source: "custom-plugin", lrc: "[00:00.00]replaced" });
});

test("windowServices automatically yields to a non-owner host provider and restores local provider when removed", async () => {
  const demoV1 = defineService("demo/v1", { methods: { ask: true } });
  const proxy = createServiceProxy(async (method, params) => {
    if (method === "service.call" && params.service === "demo/v1") return { from: "host-replacement" };
    return null;
  });
  const win = createWindowServices({ remote: proxy });
  win.provide(demoV1, { ask: () => ({ from: "window-builtin" }) }, { owner: "music" });

  assert.deepEqual(await win.get(demoV1).ask({}), { from: "window-builtin" });

  proxy.update([{ name: "demo/v1", plugin: "custom-plugin", methods: ["ask"], events: [] }]);
  assert.deepEqual(await win.get(demoV1).ask({}), { from: "host-replacement" });

  proxy.update([{ name: "demo/v1", plugin: "music", methods: ["ask"], events: [] }]);
  assert.deepEqual(await win.get(demoV1).ask({}), { from: "window-builtin" });

  win.setDisabledServices(["demo/v1"]);
  assert.deepEqual(await win.get(demoV1).ask({}), { from: "host-replacement" });
  win.setDisabledServices([]);
  assert.deepEqual(await win.get(demoV1).ask({}), { from: "window-builtin" });
});

test("explainWaitingFor, explainReplacedServices and detectServiceConflicts cover the 3 waiting reasons and conflicts", () => {
  const hostPlugins = [
    { id: "timer", name: "timer", state: "disabled" },
    { id: "agents", name: "agents", state: "loading" },
    {
      id: "music",
      name: "music",
      state: "running",
      disabledServices: ["media/v1"],
      replacedServices: [{ service: "lyrics/v1", by: "custom-lyrics" }],
    },
  ];
  const reasons = explainWaitingFor(["unknown/v1", "timers/v1", "agents/v1"], hostPlugins, null, pluginsV3Text, stateOf);
  assert.equal(reasons.length, 3);
  assert.ok(reasons[0].includes("unknown/v1"));
  assert.ok(reasons[1].includes("计时器") && reasons[1].includes("已停用"));
  assert.ok(reasons[2].includes("AI 代理") && reasons[2].includes("正在启动"));

  const replaced = explainReplacedServices("music", hostPlugins[2], pluginsV3Text);
  assert.deepEqual(replaced, [
    "服务 lyrics/v1 已由插件 custom-lyrics 接管",
    "已让出服务 media/v1",
  ]);

  const conflicts = detectServiceConflicts(
    "custom-lyrics",
    ["lyrics/v1", "translator/v1"],
    [
      { id: "music", kind: "builtin", enabled: true, background: [], config: {} },
      { id: "translation", kind: "builtin", enabled: true, background: [], config: {} },
    ],
    [],
  );
  assert.deepEqual(conflicts, [
    { service: "lyrics/v1", existingPluginId: "music", canYieldOnlyService: true },
    { service: "translator/v1", existingPluginId: "translation", canYieldOnlyService: false },
  ]);
});

test("createWaitingMonitor notifies once when a built-in plugin waits longer than threshold and clears when resolved", () => {
  const scheduled = [];
  const overdue = [];
  const monitor = createWaitingMonitor({
    delayMs: 10_000,
    onOverdue: (info) => overdue.push(info),
    setTimer: (fn, ms) => {
      const task = { fn, ms, cleared: false };
      scheduled.push(task);
      return task;
    },
    clearTimer: (task) => {
      task.cleared = true;
    },
  });

  monitor.update([
    { id: "todos", kind: "builtin", state: "waiting", waitingFor: ["timers/v1"] },
    { id: "session-ring", kind: "builtin", state: "waiting", waitingFor: ["agents/v1"] },
  ]);
  assert.equal(scheduled.length, 2);

  monitor.update([
    { id: "todos", kind: "builtin", state: "running" },
    { id: "session-ring", kind: "builtin", state: "waiting", waitingFor: ["agents/v1"] },
  ]);
  assert.equal(scheduled[0].cleared, true);
  assert.equal(scheduled[1].cleared, false);

  scheduled[1].fn();
  assert.deepEqual(overdue, [{ id: "session-ring", waitingFor: ["agents/v1"] }]);
  monitor.dispose();
});
