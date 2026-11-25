import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";
import { startHost, openWindowSocket } from "@fuyu/plugin-base/host";
import { connectHost, createServiceProxy } from "@fuyu/plugin-base/client";
import { marketV1, timersV1 } from "@fuyu/plugin-services";

const WebSocket = createRequire(new URL("../../packages/plugin-base/package.json", import.meta.url))("ws");
import { packFiles } from "../../packages/plugin-manifest/src/index.mjs";
import { SETTINGS_ONLY_METHODS } from "../../src/features/updater/host/market.mjs";

function manualZip(name = "@localdev/notes-helper") {
  const pkg = {
    name,
    version: "1.0.0",
    type: "module",
    license: "MIT",
    repository: "https://github.com/localdev/notes-helper",
    engines: { fuyu: ">=0.3.10" },
    fuyu: {
      manifest: 1,
      displayName: { "zh-CN": "笔记助手", en: "Notes helper" },
      description: { "zh-CN": "示例", en: "Demo" },
      categories: ["productivity"],
      icon: "assets/icon.svg",
      platforms: ["windows", "macos"],
      host: "dist/host.js",
      network: [],
      nodeApis: [],
      provides: [],
      replaces: [],
      slots: [],
      inject: { required: [], optional: [] },
      commands: [],
      builtWith: "2.0.0",
    },
  };
  return packFiles([
    { path: "package.json", data: `${JSON.stringify(pkg, null, 2)}\n` },
    { path: "assets/icon.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n" },
    { path: "dist/host.js", data: "export const name = 'notes-helper';\nexport function apply() {}\n" },
  ]).zip;
}

async function withHost(run) {
  const root = mkdtempSync(join(tmpdir(), "fuyu-market-caller-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-market-caller-builtins-"));
  let host = null;
  try {
    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({
        format: 1,
        plugins: [{ id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] }],
      }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    const entryUrl = new URL("../../src/features/updater/host/index.mjs", import.meta.url).href;
    writeFileSync(join(builtinsDir, "updater", "host", "index.mjs"), `export { name, apply } from ${JSON.stringify(entryUrl)};\n`);
    writeFileSync(join(root, "plugins.yml"), "[]\n");
    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.11" });
    await host.settle();
    const fromWindow = (window, method, params) => host.serviceHub.windowCall("service.call", { service: marketV1.name, method, params }, window);
    const fromPlugin = (plugin, method, params) => host.serviceHub.invoke(marketV1.name, method, params, { plugin });
    await run({ root, fromWindow, fromPlugin });
  } finally {
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
}

test("market/v1 refuses every disk-changing method unless the settings window calls it", async () => {
  assert.deepEqual([...SETTINGS_ONLY_METHODS].sort(), ["dismissAutoUpdated", "installBundle", "installFile", "installMarket", "refresh", "setEnabled", "setManualAllowed", "uninstall"]);
  await withHost(async ({ root, fromWindow, fromPlugin }) => {
    const base64 = manualZip().toString("base64");
    const params = {
      refresh: {},
      installMarket: { name: "@localdev/notes-helper" },
      installBundle: { id: "starter" },
      installFile: { base64 },
      setManualAllowed: { allowed: true },
      setEnabled: { id: "@localdev/notes-helper", enabled: false },
      uninstall: { id: "@localdev/notes-helper", removeData: true },
      dismissAutoUpdated: { at: 0 },
    };
    for (const method of SETTINGS_ONLY_METHODS) {
      for (const window of ["island", "plugin-window", "", "Settings"]) {
        await assert.rejects(fromWindow(window, method, params[method]), { code: "forbidden" }, `${window} ${method}`);
      }
      await assert.rejects(fromPlugin("@evil/thief", method, params[method]), { code: "forbidden" }, `plugin ${method}`);
      await assert.rejects(fromPlugin("timer", method, params[method]), { code: "forbidden" }, `builtin ${method}`);
    }
    assert.equal((await fromWindow("settings", "catalog", {})).manualAllowed, false);
    assert.equal(existsSync(join(root, "packages", "@localdev", "notes-helper")), false);

    const catalog = await fromWindow("island", "catalog", {});
    assert.deepEqual(catalog.installed, []);
    const inspected = await fromPlugin("@evil/thief", "inspectPackage", { base64 });
    assert.equal(inspected.id, "@localdev/notes-helper");
  });
});

test("the settings window still toggles manual installs, installs a file and uninstalls it", async () => {
  await withHost(async ({ root, fromWindow }) => {
    const base64 = manualZip().toString("base64");
    await assert.rejects(fromWindow("settings", "installFile", { base64 }), { code: "manual-disabled" });
    assert.deepEqual(await fromWindow("settings", "setManualAllowed", { allowed: true }), { manualAllowed: true });
    const installed = await fromWindow("settings", "installFile", { base64 });
    assert.equal(installed.id, "@localdev/notes-helper");
    const pkgDir = join(root, "packages", "@localdev", "notes-helper");
    assert.ok(existsSync(join(pkgDir, "package.json")));

    assert.deepEqual(await fromWindow("settings", "setEnabled", { id: installed.id, enabled: false }), { id: installed.id, enabled: false });
    assert.match(readFileSync(join(root, "plugins.yml"), "utf8"), /disabled: true/);

    const dataDir = join(root, "data", "@localdev", "notes-helper");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "state.json"), "{}");
    assert.deepEqual(await fromWindow("settings", "uninstall", { id: installed.id, removeData: true }), { id: installed.id, removed: true });
    assert.equal(existsSync(pkgDir), false);
    assert.equal(existsSync(dataDir), false);
    assert.deepEqual(await fromWindow("settings", "setManualAllowed", { allowed: false }), { manualAllowed: false });
  });
});

test("uninstall from the settings window only accepts ids that are installed, so dot names cannot reach packages/ or data/", async () => {
  await withHost(async ({ root, fromWindow }) => {
    await fromWindow("settings", "setManualAllowed", { allowed: true });
    await fromWindow("settings", "installFile", { base64: manualZip().toString("base64") });
    const keepPkg = join(root, "packages", "@localdev", "notes-helper", "package.json");
    const keepData = join(root, "data", "@x", "keep.json");
    mkdirSync(join(root, "data", "@x"), { recursive: true });
    writeFileSync(keepData, "{}");

    for (const id of ["@x/..", "@x/.", "@../x", "@localdev/..", "@localdev/.", "@someone/not-installed"]) {
      await assert.rejects(fromWindow("settings", "uninstall", { id, removeData: true }), { code: "not-found" }, id);
    }
    assert.ok(existsSync(keepPkg));
    assert.ok(existsSync(keepData));
    assert.deepEqual((await fromWindow("settings", "catalog", {})).installed.map((item) => item.id), ["@localdev/notes-helper"]);
  });
});

test("plugin code running in the settings window gets its own plugin identity via handshake token, blocked from market/v1 writes and isolated in timers/v1", async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-e68-caller-"));
  const builtinsDir = mkdtempSync(join(tmpdir(), "fuyu-e68-builtins-"));
  let host = null;
  let server = null;
  let settingsConn = null;
  let pluginAConn = null;
  let pluginBConn = null;
  const origin = "tauri://localhost";
  const open = (url) => new WebSocket(url, { origin });
  try {
    writeFileSync(
      join(builtinsDir, "builtins.json"),
      JSON.stringify({
        format: 1,
        plugins: [
          { id: "updater", kind: "essential", root: "updater", host: "host/index.mjs", background: [], provides: ["market/v1"] },
          { id: "timer", kind: "builtin", root: "timer", host: "host/index.mjs", background: [], provides: ["timers/v1"] },
        ],
      }),
    );
    mkdirSync(join(builtinsDir, "updater", "host"), { recursive: true });
    mkdirSync(join(builtinsDir, "timer", "host"), { recursive: true });
    writeFileSync(
      join(builtinsDir, "updater", "host", "index.mjs"),
      `export { name, apply } from ${JSON.stringify(new URL("../../src/features/updater/host/index.mjs", import.meta.url).href)};\n`,
    );
    writeFileSync(
      join(builtinsDir, "timer", "host", "index.mjs"),
      `export { name, apply } from ${JSON.stringify(new URL("../../src/features/timer/host/index.mjs", import.meta.url).href)};\n`,
    );
    writeFileSync(join(root, "plugins.yml"), "[]\n");
    host = await startHost({ dir: root, builtins: builtinsDir, appVersion: "0.3.14" });
    await host.settle();

    server = await openWindowSocket({
      origins: [origin],
      snapshot: () => ({ services: host.services() }),
      onCall: (method, params, window, plugin) => host.serviceHub.windowCall(method, params, window, plugin),
    });

    const tokenA = server.issuePluginToken("@evil/rogue");
    const tokenB = server.issuePluginToken("@other/buddy");
    const waitOpen = (conn) => new Promise((resolve, reject) => {
      const start = Date.now();
      const tick = () => {
        if (conn.state === "open") return resolve();
        if (Date.now() - start > 3000) return reject(new Error("socket did not open"));
        setTimeout(tick, 10);
      };
      tick();
    });
    settingsConn = connectHost({ resolve: async () => ({ port: server.port, token: server.token }), window: "settings", open });
    pluginAConn = connectHost({ resolve: async () => ({ port: server.port, token: tokenA }), window: "settings", open });
    pluginBConn = connectHost({ resolve: async () => ({ port: server.port, token: tokenB }), window: "settings", open });
    await Promise.all([waitOpen(settingsConn), waitOpen(pluginAConn), waitOpen(pluginBConn)]);

    const settingsMarket = createServiceProxy((m, p, o) => settingsConn.call(m, p, o)).get(marketV1);
    const rogueMarket = createServiceProxy((m, p, o) => pluginAConn.call(m, p, o)).get(marketV1);
    const pluginATimers = createServiceProxy((m, p, o) => pluginAConn.call(m, p, o)).get(timersV1);
    const pluginBTimers = createServiceProxy((m, p, o) => pluginBConn.call(m, p, o)).get(timersV1);

    for (const method of SETTINGS_ONLY_METHODS) {
      await assert.rejects(
        rogueMarket[method](method === "setManualAllowed" ? { allowed: true } : method === "dismissAutoUpdated" ? { at: 0 } : { id: "x", name: "x", base64: "QQ==", enabled: false }),
        (error) => error.code === "forbidden" && error.message.includes("@evil/rogue"),
        `settings-window plugin must be rejected on ${method} with its plugin id`,
      );
    }
    assert.deepEqual(await settingsMarket.setManualAllowed({ allowed: true }), { manualAllowed: true });

    const { timer } = await pluginATimers.start({ kind: "countdown", durationMs: 60_000, label: "Rogue timer" });
    assert.ok(timer.id);
    assert.equal(timer.owner, "@evil/rogue");
    assert.deepEqual(await pluginBTimers.remove({ id: timer.id }), { removed: false });
    await assert.rejects(
      pluginBTimers.pause({ id: timer.id }),
      (error) => error.code === "not-found" || error.code === "forbidden",
      "another plugin running in a window cannot pause timers owned by @evil/rogue",
    );
    assert.deepEqual(await pluginATimers.remove({ id: timer.id }), { removed: true });
  } finally {
    settingsConn?.close();
    pluginAConn?.close();
    pluginBConn?.close();
    if (server) await server.close();
    if (host) await host.stop();
    rmSync(root, { recursive: true, force: true });
    rmSync(builtinsDir, { recursive: true, force: true });
  }
});
