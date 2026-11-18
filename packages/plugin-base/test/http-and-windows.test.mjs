import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { WINDOW_RULES_FILE, startHost } from "@fuyu/plugin-base/host";
import { pluginWindowsV1 } from "@fuyu/plugin-base/services";
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

function createMockRpc() {
  const handlers = new Map();
  const calls = [];
  return {
    calls,
    handle(method, fn) {
      handlers.set(method, fn);
    },
    async call(method, params) {
      calls.push({ method, params });
      return {};
    },
    emitWindowEvent(params) {
      handlers.get("windowEvent")?.(params);
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

test("ctx.http enforces declared network hosts, wildcard subdomains and localhost rules, and reports undeclared.network", async () => {
  const fetched = [];
  const fetchImpl = async (input) => {
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    fetched.push(url);
    return { ok: true, status: 200, url };
  };

  const { host } = await openHost(
    {
      "app/builtins.json": JSON.stringify({
        format: 1,
        plugins: [{ id: "core-net", kind: "builtin", root: "core-net", host: "index.mjs" }],
      }),
      "app/core-net/index.mjs": [
        'export const name = "core-net";',
        "export async function apply(ctx) {",
        '  await ctx.http.fetch("http://arbitrary.internal.local:9000/health");',
        "}",
      ].join("\n"),
      "data/plugins.yml": '- id: "@ann/net"\n  source: market\n',
      "data/packages/@ann/net/package.json": manifest("@ann/net", {
        host: "host.mjs",
        inject: { required: ["http"] },
        network: ["api.weather.com", "*.cdn.example.org", "localhost"],
      }),
      "data/packages/@ann/net/icon.svg": "<svg/>",
      "data/packages/@ann/net/host.mjs": [
        'export const name = "net";',
        'export const inject = ["http"];',
        "export function apply(ctx) {",
        "  globalThis.netHttp = ctx.http;",
        "}",
      ].join("\n"),
    },
    { builtins: null, fetchImpl },
  );

  const statuses = [];
  const unwatch = host.watchStatus((list) => statuses.push(list), 0);
  cleanup.push(unwatch);

  let inlineHttp;
  await host.ctx.plugin({
    name: "inline-builtin",
    apply(ctx) {
      inlineHttp = ctx.http;
    },
  });
  await inlineHttp.fetch("http://unrestricted.local/test");

  const netHttp = globalThis.netHttp;
  await netHttp.fetch("https://api.weather.com/v1/now");
  await netHttp.fetch(new URL("https://img.cdn.example.org/icon.png"));
  await netHttp.fetch({ url: "http://localhost:11434/api/tags" });
  await netHttp.fetch("http://127.0.0.1:8080/ping");

  await assert.rejects(
    netHttp.fetch("https://cdn.example.org/root-not-wildcard"),
    (err) => err.code === "undeclared-network" && err.host === "cdn.example.org",
  );
  await assert.rejects(
    netHttp.fetch("http://api.weather.com/insecure"),
    (err) => err.code === "undeclared-network" && err.host === "api.weather.com",
  );
  await assert.rejects(
    netHttp.fetch("https://tracker.evil.net/collect"),
    (err) => err.code === "undeclared-network" && err.host === "tracker.evil.net",
  );

  assert.deepEqual(fetched, [
    "http://unrestricted.local/test",
    "https://api.weather.com/v1/now",
    "https://img.cdn.example.org/icon.png",
    "http://localhost:11434/api/tags",
    "http://127.0.0.1:8080/ping",
  ]);

  const netStatus = host.status().find((entry) => entry.id === "@ann/net");
  assert.deepEqual(netStatus.undeclared, {
    network: ["cdn.example.org", "api.weather.com", "tracker.evil.net"],
  });
  assert.ok(await until(() => statuses.some((s) => s.find((e) => e.id === "@ann/net")?.undeclared?.network?.includes("tracker.evil.net"))));
});

test("ctx.windows gates on experimental windows/v1, enforces limits and guardrails via plugin-windows/v1, and cleans up on unload", async () => {
  const rpc = createMockRpc();
  const { made, host, dataDir } = await openHost(
    {
      "data/plugins.yml": [
        '- id: "@ann/plain"\n  source: market\n',
        "- id: hud\n  source: dev\n  path: ../dev-hud\n",
      ].join(""),
      "data/packages/@ann/plain/package.json": manifest("@ann/plain", { host: "host.mjs" }),
      "data/packages/@ann/plain/icon.svg": "<svg/>",
      "data/packages/@ann/plain/host.mjs": [
        'export const name = "plain";',
        "export function apply(ctx) {",
        "  globalThis.plainWindows = ctx.windows;",
        "}",
      ].join("\n"),
      "dev-hud/package.json": manifest("@ann/hud", {
        host: "host.mjs",
        experimental: ["windows/v1"],
        slots: ["plugin-window.view/v1"],
        inject: { required: ["windows"] },
      }),
      "dev-hud/icon.svg": "<svg/>",
      "dev-hud/host.mjs": [
        'export const name = "hud";',
        'export const inject = ["windows"];',
        "export function apply(ctx) {",
        "  globalThis.hudEvents = [];",
        "  ctx.windows.onEvent((event) => globalThis.hudEvents.push(event));",
        "  globalThis.hudWindows = ctx.windows;",
        "}",
      ].join("\n"),
    },
    { watch: true, rpc },
  );

  await assert.rejects(globalThis.plainWindows.create({ id: "blocked" }), { code: "experimental-required" });
  assert.throws(() => globalThis.plainWindows.list(), { code: "experimental-required" });

  let winService;
  await host.ctx.plugin({
    name: "win-admin",
    apply(ctx) {
      winService = ctx.services.get(pluginWindowsV1);
    },
  });

  assert.deepEqual(await winService.getRules({ id: "hud" }), {
    disallowAlwaysOnTop: false,
    disallowClickThrough: false,
    hideAll: false,
  });

  const created = await globalThis.hudWindows.create({
    id: "overlay-1",
    title: "HUD 1",
    alwaysOnTop: true,
    clickThrough: true,
  });
  assert.equal(created.alwaysOnTop, true);
  assert.equal(created.clickThrough, true);
  assert.equal(created.visible, true);
  assert.ok(rpc.calls.some((c) => c.method === "pluginKernel.windowOpen" && c.params.windowId === "overlay-1" && c.params.alwaysOnTop === true));

  const updatedRules = await winService.setRules({
    id: "hud",
    disallowAlwaysOnTop: true,
    disallowClickThrough: true,
    hideAll: true,
  });
  assert.deepEqual(updatedRules, { disallowAlwaysOnTop: true, disallowClickThrough: true, hideAll: true });
  assert.deepEqual(JSON.parse(readFileSync(join(dataDir, WINDOW_RULES_FILE), "utf8")), {
    hud: { disallowAlwaysOnTop: true, disallowClickThrough: true, hideAll: true },
  });
  assert.ok(rpc.calls.some((c) => c.method === "pluginKernel.windowControl" && c.params.action === "hide" && c.params.windowId === "overlay-1"));
  assert.ok(
    rpc.calls.some(
      (c) =>
        c.method === "pluginKernel.windowControl" &&
        c.params.action === "update" &&
        c.params.alwaysOnTop === false &&
        c.params.clickThrough === false,
    ),
  );
  const [listedWin] = (await winService.list({ id: "hud" })).items;
  assert.equal(listedWin.visible, false);
  assert.equal(listedWin.alwaysOnTop, false);
  assert.equal(listedWin.clickThrough, false);

  await winService.setRules({ id: "hud", hideAll: false });
  assert.equal(globalThis.hudWindows.list()[0].visible, true);

  for (let i = 2; i <= 8; i += 1) {
    await globalThis.hudWindows.create({ id: `overlay-${i}` });
  }
  assert.equal(globalThis.hudWindows.list().length, 8);
  await assert.rejects(globalThis.hudWindows.create({ id: "overlay-9" }), { code: "limit" });

  rpc.emitWindowEvent({ pluginId: "hud", windowId: "overlay-8", type: "closed" });
  assert.deepEqual(globalThis.hudEvents, [{ windowId: "overlay-8", type: "closed" }]);
  assert.equal(globalThis.hudWindows.list().length, 7);

  await globalThis.hudWindows.close("overlay-7");
  assert.equal(globalThis.hudWindows.list().length, 6);

  made.write({
    "data/plugins.yml": [
      '- id: "@ann/plain"\n  source: market\n',
      "- id: hud\n  source: dev\n  path: ../dev-hud\n  disabled: true\n",
    ].join(""),
  });
  assert.ok(await until(() => host.status().find((entry) => entry.id === "hud")?.state === "disabled"));
  assert.deepEqual((await winService.list()).items, []);
});
