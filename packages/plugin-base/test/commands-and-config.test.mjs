import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { KEYBINDINGS_FILE, CONFIG_FILE, readManifest, startHost } from "@fuyu/plugin-base/host";
import { commandsV1, pluginConfigV1 } from "@fuyu/plugin-base/services";
import { until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of [...cleanup].reverse()) await step();
});

function manifest(name, app = {}) {
  const owner = name.split("/")[0].slice(1);
  return JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    license: "MIT",
    repository: `github:${owner}/plugin`,
    engines: { fuyu: ">=0.5.0" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "示例", en: "Demo" },
      description: { "zh-CN": "示例描述", en: "Demo description" },
      icon: "icon.svg",
      categories: ["utilities"],
      ...app,
    },
  });
}

function createMockRpc(onCall = async () => ({})) {
  const handlers = new Map();
  const calls = [];
  return {
    calls,
    handlers,
    handle(method, fn) {
      handlers.set(method, fn);
    },
    async call(method, params) {
      calls.push({ method, params });
      return onCall(method, params);
    },
    invoke(method, params) {
      const fn = handlers.get(method);
      if (!fn) throw new Error(`missing rpc handler ${method}`);
      return fn(params);
    },
  };
}

async function openHost(files, options = {}) {
  const made = workspace(files);
  cleanup.push(made.remove);
  const host = await startHost({ dir: join(made.dir, "data"), ...options });
  cleanup.push(() => host.stop());
  await host.settle();
  return { made, host, dataDir: join(made.dir, "data") };
}

test("commands/v1 lists declared commands of disabled plugins, runs active ones, tracks undeclared commands and syncs hotkeys", async () => {
  let conflictMap = {};
  const rpc = createMockRpc(async (method) => {
    if (method === "pluginKernel.syncHotkeys") return { conflicts: conflictMap };
    throw Object.assign(new Error(`no method ${method}`), { code: "no-method" });
  });

  const cmdList = [
    { id: "quick-open", title: { "zh-CN": "快速打开", en: "Quick Open" }, keybinding: "Alt+O" },
    { id: "refresh", title: { "zh-CN": "刷新", en: "Refresh" } },
  ];

  const { host, dataDir } = await openHost(
    {
      "data/plugins.yml": [
        '- id: "@ann/alpha"\n  source: market\n',
        '- id: "@ann/beta"\n  source: market\n  disabled: true\n',
      ].join(""),
      "data/packages/@ann/alpha/package.json": manifest("@ann/alpha", {
        host: "host.mjs",
        inject: { required: ["commands"] },
        commands: cmdList,
      }),
      "data/packages/@ann/alpha/icon.svg": "<svg/>",
      "data/packages/@ann/alpha/host.mjs": [
        'export const name = "alpha";',
        'export const inject = ["commands"];',
        "export function apply(ctx) {",
        '  ctx.commands.register("quick-open", (args) => ({ opened: args?.target ?? "home" }));',
        '  ctx.commands.register("secret-cmd", () => "shh");',
        "}",
      ].join("\n"),
      "data/packages/@ann/beta/package.json": manifest("@ann/beta", {
        commands: [{ id: "sleep", title: { "zh-CN": "休眠", en: "Sleep" }, keybinding: "Alt+S" }],
      }),
      "data/packages/@ann/beta/icon.svg": "<svg/>",
    },
    { rpc },
  );

  assert.deepEqual(host.services(), []);
  const alphaStatus = host.status().find((entry) => entry.id === "@ann/alpha");
  assert.equal(alphaStatus.state, "running");
  assert.deepEqual(alphaStatus.undeclared, { commands: ["secret-cmd"] });

  assert.ok(await until(() => rpc.calls.some((call) => call.method === "pluginKernel.syncHotkeys")));
  const lastSync = rpc.calls.filter((call) => call.method === "pluginKernel.syncHotkeys").at(-1);
  assert.deepEqual(lastSync.params.bindings, [{ pluginId: "@ann/alpha", command: "quick-open", shortcut: "Alt+O" }]);

  let client;
  const changedEvents = [];
  await host.ctx.plugin({
    name: "inspector",
    apply(ctx) {
      client = ctx.services.get(commandsV1);
      client.on("changed", (payload) => changedEvents.push(payload));
    },
  });

  const listed = await client.list();
  const byKey = Object.fromEntries(listed.items.map((item) => [`${item.pluginId}:${item.id}`, item]));
  assert.equal(byKey["@ann/alpha:quick-open"].active, true);
  assert.equal(byKey["@ann/alpha:quick-open"].keybinding, "Alt+O");
  assert.deepEqual(byKey["@ann/alpha:quick-open"].pluginName, { "zh-CN": "示例", en: "Demo" });
  assert.equal(byKey["@ann/beta:sleep"].active, false);
  assert.equal(byKey["@ann/beta:sleep"].defaultKeybinding, "Alt+S");

  assert.deepEqual(await client.run({ plugin: "@ann/alpha", command: "quick-open", args: { target: "inbox" } }), { opened: "inbox" });
  assert.deepEqual(await rpc.invoke("hotkey", { pluginId: "@ann/alpha", command: "quick-open" }), { opened: "home" });
  await assert.rejects(client.run({ plugin: "@ann/alpha", command: "refresh" }), { code: "not-running" });
  await assert.rejects(client.run({ plugin: "@ann/beta", command: "sleep" }), { code: "not-running" });

  conflictMap = { "@ann/alpha": ["Alt+K"] };
  const rebound = await client.setKeybinding({ plugin: "@ann/alpha", command: "quick-open", keybinding: "Alt+K" });
  const quickRebound = rebound.items.find((item) => item.pluginId === "@ann/alpha" && item.id === "quick-open");
  assert.equal(quickRebound.keybinding, "Alt+K");
  assert.equal(quickRebound.defaultKeybinding, "Alt+O");
  assert.deepEqual(quickRebound.conflicts, ["Alt+K"]);
  assert.ok(changedEvents.length >= 1);

  const cleared = await client.setKeybinding({ plugin: "@ann/alpha", command: "quick-open", keybinding: "" });
  const quickCleared = cleared.items.find((item) => item.pluginId === "@ann/alpha" && item.id === "quick-open");
  assert.equal(quickCleared.keybinding, null);
  assert.equal(quickCleared.defaultKeybinding, "Alt+O");
  assert.deepEqual(JSON.parse(readFileSync(join(dataDir, KEYBINDINGS_FILE), "utf8")), {
    "@ann/alpha": { "quick-open": "" },
  });

  conflictMap = {};
  const restored = await client.setKeybinding({ plugin: "@ann/alpha", command: "quick-open", keybinding: null });
  const quickRestored = restored.items.find((item) => item.pluginId === "@ann/alpha" && item.id === "quick-open");
  assert.equal(quickRestored.keybinding, "Alt+O");
  assert.deepEqual(quickRestored.conflicts, []);
  assert.deepEqual(JSON.parse(readFileSync(join(dataDir, KEYBINDINGS_FILE), "utf8")), {});
});

test("readManifest validates fuyu.config JSON schema, and ctx.config + plugin-config/v1 validate, persist and reset values", async () => {
  const schema = {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      mode: { type: "string", enum: ["fast", "deep"], default: "fast" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
    },
  };

  const badSpace = workspace({
    "bad/package.json": manifest("@ann/bad", { config: "config.schema.json" }),
    "bad/icon.svg": "<svg/>",
    "bad/config.schema.json": "not-json",
  });
  cleanup.push(badSpace.remove);
  assert.throws(() => readManifest(join(badSpace.dir, "bad"), {}), /fuyu\.config/);

  const { host, dataDir } = await openHost({
    "data/plugins.yml": '- id: "@ann/writer"\n  source: market\n',
    "data/packages/@ann/writer/package.json": manifest("@ann/writer", {
      host: "host.mjs",
      config: "dist/config.schema.json",
      inject: { required: ["config"] },
    }),
    "data/packages/@ann/writer/icon.svg": "<svg/>",
    "data/packages/@ann/writer/dist/config.schema.json": JSON.stringify(schema),
    "data/packages/@ann/writer/host.mjs": [
      'export const name = "writer";',
      'export const inject = ["config"];',
      "export function apply(ctx) {",
      "  globalThis.writerConfigProbe = { initial: ctx.config.get(), changes: [], api: ctx.config };",
      "  ctx.config.onChange((values) => globalThis.writerConfigProbe.changes.push(values));",
      "}",
    ].join("\n"),
  });

  assert.equal(host.status().find((entry) => entry.id === "@ann/writer").state, "running");
  assert.deepEqual(globalThis.writerConfigProbe.initial, {
    enabled: true,
    mode: "fast",
    limit: 10,
    temperature: 0.7,
  });

  let cfgService;
  const serviceEvents = [];
  await host.ctx.plugin({
    name: "settings-ui",
    apply(ctx) {
      cfgService = ctx.services.get(pluginConfigV1);
      cfgService.on("changed", (event) => serviceEvents.push(event));
    },
  });

  const listed = await cfgService.list();
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].id, "@ann/writer");
  assert.deepEqual(listed.items[0].defaults, { enabled: true, mode: "fast", limit: 10, temperature: 0.7 });

  const updated = await cfgService.set({ id: "@ann/writer", values: { mode: "deep", limit: 25 } });
  assert.deepEqual(updated.values, { enabled: true, mode: "deep", limit: 25, temperature: 0.7 });
  const configFile = join(dataDir, "data", "@ann", "writer", CONFIG_FILE);
  assert.deepEqual(JSON.parse(readFileSync(configFile, "utf8")), { mode: "deep", limit: 25 });
  assert.deepEqual(globalThis.writerConfigProbe.changes, [{ enabled: true, mode: "deep", limit: 25, temperature: 0.7 }]);
  assert.deepEqual(serviceEvents, [{ id: "@ann/writer", values: { enabled: true, mode: "deep", limit: 25, temperature: 0.7 } }]);

  const viaCtx = await globalThis.writerConfigProbe.api.set({ enabled: false });
  assert.equal(viaCtx.enabled, false);
  assert.equal(viaCtx.mode, "deep");

  await assert.rejects(cfgService.set({ id: "@ann/writer", values: { mode: "invalid" } }), { code: "bad-config" });
  await assert.rejects(cfgService.set({ id: "@ann/writer", values: { limit: 0 } }), { code: "bad-config" });
  await assert.rejects(cfgService.set({ id: "@ann/writer", values: { limit: 1.5 } }), { code: "bad-config" });
  await assert.rejects(cfgService.set({ id: "@ann/writer", values: { temperature: 5 } }), { code: "bad-config" });
  await assert.rejects(cfgService.set({ id: "@ann/writer", values: { unknownKey: true } }), { code: "bad-config" });

  const afterReset = await cfgService.reset({ id: "@ann/writer" });
  assert.deepEqual(afterReset.values, afterReset.defaults);
  assert.equal(existsSync(configFile), false);
});
