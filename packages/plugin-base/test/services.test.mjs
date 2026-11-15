import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { SERVICE_NAME as PROTOCOL_NAME } from "@fuyu/plugin-base/protocol";
import * as base from "@fuyu/plugin-base/services";
import { SERVICE_NAME as MANIFEST_NAME } from "@fuyu/plugin-manifest";
import * as compat from "@fuyu/plugin-services";
import { defineService } from "@fuyu/plugin-services";
import { config, sleep, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

const echoV1 = defineService("demo.echo/v1", {
  methods: { echo: true, slow: { timeoutMs: 50 }, hang: true, stream: { progress: true }, odd: true },
  events: { said: true },
});

const ECHO = {
  echo: ({ text }, caller) => ({ text, plugin: caller.plugin ?? null, window: caller.window ?? null }),
  slow: () => new Promise(() => {}),
  hang: () => new Promise(() => {}),
  stream: ({ pieces }, caller) => {
    for (const piece of pieces) caller.progress(piece);
    return { count: pieces.length };
  },
  odd: () => ({ big: 1n }),
  secret: () => "never reachable",
};

async function host(files = {}, entries = []) {
  const space = workspace({ ...files, "plugins.yml": config(entries) });
  const started = await startHost({ dir: space.dir });
  cleanup.push(space.remove, () => started.stop());
  await started.settle();
  return started;
}

async function plugin(started, name, apply) {
  const fiber = started.ctx.plugin({ name, apply });
  await fiber;
  return fiber;
}

function serviceHooks(ctx) {
  return Object.entries(ctx.events._hooks)
    .filter(([name]) => name.startsWith("service:"))
    .reduce((total, [, hooks]) => total + hooks.length, 0);
}

test("plugin-services hands out plugin-base's defineService, and the service name rule exists once", () => {
  for (const name of ["defineService", "isServiceDefinition", "SERVICE_NAME", "MEMBER_NAME", "DEFAULT_TIMEOUT_MS"]) assert.equal(compat[name], base[name], name);
  assert.equal(base.SERVICE_NAME, MANIFEST_NAME);
  assert.equal(PROTOCOL_NAME, MANIFEST_NAME);
});

test("@fuyu/plugin-base/services pulls in neither Cordis nor Node modules, so window code can use it", () => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const [, spec] of readFileSync(file, "utf8").matchAll(/^(?:import|export)\b[^"']*?from\s+["']([^"']+)["']/gm)) {
      assert.ok(!spec.startsWith("node:") && !/^(cordis|@cordisjs\/)/.test(spec), `${file} imports ${spec}`);
      visit(createRequire(file).resolve(spec));
    }
  };
  visit(createRequire(import.meta.url).resolve("@fuyu/plugin-base/services"));
  assert.deepEqual([...seen].map((file) => file.split(/[\\/]/).slice(-2).join("/")), ["src/services.mjs", "src/protocol.mjs", "src/names.mjs"]);
});

test("a plugin provides a declared service and another calls it and hears its events", async () => {
  const started = await host();
  let handle;
  await plugin(started, "echoer", (ctx) => {
    handle = ctx.services.provide(echoV1, ECHO);
  });
  const heard = [];
  let client;
  await plugin(started, "caller", (ctx) => {
    client = ctx.services.get(echoV1);
    client.on("said", (data) => heard.push(data));
  });
  assert.deepEqual(await client.echo({ text: "hi" }), { text: "hi", plugin: "caller", window: null });
  assert.equal(handle.emit("said", { text: "hi" }), true);
  assert.deepEqual(heard, [{ text: "hi" }]);
  assert.deepEqual(started.services(), [{ name: "demo.echo/v1", plugin: "echoer", methods: ["echo", "slow", "hang", "stream", "odd"], events: ["said"] }]);
  const chunks = [];
  assert.deepEqual(await client.stream({ pieces: ["a", "b"] }, { onProgress: (chunk) => chunks.push(chunk) }), { count: 2 });
  assert.deepEqual(chunks, ["a", "b"]);
  assert.throws(() => handle.emit("shouted", {}), { code: "no-event" });
  assert.throws(() => client.on("shouted", () => {}), { code: "no-event" });
});

test("only declared methods can be called, from a window or from a plugin", async () => {
  const started = await host();
  await plugin(started, "echoer", (ctx) => void ctx.services.provide(echoV1, ECHO));
  const services = started.serviceHub;
  await assert.rejects(services.windowCall("service.call", { service: "demo.echo/v1", method: "secret" }, "main"), { code: "no-method" });
  await assert.rejects(services.windowCall("service.call", { service: "demo.echo/v1", method: "constructor" }, "main"), { code: "no-method" });
  await assert.rejects(services.windowCall("service.call", { service: "demo.echo/v1", method: "toString" }, "main"), { code: "no-method" });
  assert.deepEqual(await services.windowCall("service.call", { service: "demo.echo/v1", method: "echo", params: { text: "x" } }, "main"), { text: "x", plugin: null, window: "main" });
  await assert.rejects(services.windowCall("service.call", { service: "demo.echo/v1", method: "odd" }, "main"), { code: "bad-result" });
  await assert.rejects(services.windowCall("service.call", { service: "Echo", method: "echo" }, "main"), { code: "bad-params" });
  await assert.rejects(services.windowCall("service.call", { service: "nobody/v1", method: "echo" }, "main"), { code: "not-ready" });
  assert.throws(() => services.windowCall("service.on", { service: "demo.echo/v1", event: "shouted" }, "main"), { code: "no-event" });
  assert.equal(services.windowCall("service.on", { service: "nobody/v1", event: "later" }, "main"), true);
});

test("a provider must implement every declared method, and a second provider fails while the first keeps the service", async () => {
  const started = await host();
  await assert.rejects(
    plugin(started, "half", (ctx) => void ctx.services.provide(echoV1, { echo: () => null })),
    /has no method slow/,
  );
  await plugin(started, "first", (ctx) => void ctx.services.provide(echoV1, ECHO));
  await assert.rejects(
    plugin(started, "second", (ctx) => void ctx.services.provide(echoV1, ECHO)),
    /service "demo.echo\/v1" has been registered/,
  );
  assert.equal(started.services()[0].plugin, "first");
});

test("calls time out, keep the provider's error code, and fail with peer-gone when the provider stops", async () => {
  const started = await host();
  const fiber = await plugin(started, "echoer", (ctx) => {
    ctx.services.provide(echoV1, { ...ECHO, echo: () => Promise.reject(Object.assign(new Error("too long"), { code: "limit", data: { max: 3 } })) });
  });
  let client;
  await plugin(started, "caller", (ctx) => void (client = ctx.services.get(echoV1)));
  await assert.rejects(client.slow(), (error) => error.code === "timeout" && /demo\.echo\/v1 slow did not answer within 50 ms/.test(error.message));
  await assert.rejects(client.echo({ text: "x" }), { code: "limit", message: "too long", data: { max: 3 } });
  const pending = client.hang();
  await sleep(10);
  await fiber.dispose();
  await assert.rejects(pending, { code: "peer-gone" });
  await assert.rejects(client.echo({ text: "x" }), { code: "not-ready" });
  assert.deepEqual(started.services(), []);
});

test("when the provider is replaced, subscribers and windows hear the new one", async () => {
  const started = await host();
  const published = [];
  started.serviceHub.attachWindows({ connected: () => ["main"], publish: (name, data) => published.push({ name, data }) });
  started.serviceHub.windowCall("service.on", { service: "demo.echo/v1", event: "said" }, "main");
  let oldHandle;
  const old = await plugin(started, "old", (ctx) => void (oldHandle = ctx.services.provide(echoV1, ECHO)));
  const heard = [];
  let client;
  await plugin(started, "listener", (ctx) => {
    client = ctx.services.get(echoV1);
    client.on("said", (data) => heard.push(data.by));
  });
  oldHandle.emit("said", { by: "old" });
  await old.dispose();
  assert.equal(oldHandle.emit("said", { by: "old, late" }), false);
  let newHandle;
  await plugin(started, "new", (ctx) => void (newHandle = ctx.services.provide(echoV1, { ...ECHO, echo: () => ({ from: "new" }) })));
  newHandle.emit("said", { by: "new" });
  assert.deepEqual(heard, ["old", "new"]);
  assert.deepEqual(await client.echo({}), { from: "new" });
  assert.deepEqual(
    published.filter((entry) => entry.name === "service").map((entry) => entry.data),
    [
      { service: "demo.echo/v1", event: "said", data: { by: "old" } },
      { service: "demo.echo/v1", event: "said", data: { by: "new" } },
    ],
  );
});

test("events go to windows only while a connected window wants them", async () => {
  const started = await host();
  let connected = ["main"];
  const published = [];
  started.serviceHub.attachWindows({ connected: () => connected, publish: (name, data) => published.push(data) });
  let handle;
  await plugin(started, "echoer", (ctx) => void (handle = ctx.services.provide(echoV1, ECHO)));
  handle.emit("said", { n: 1 });
  started.serviceHub.windowCall("service.on", { service: "demo.echo/v1", event: "said" }, "main");
  handle.emit("said", { n: 2 });
  started.serviceHub.windowCall("service.off", { service: "demo.echo/v1", event: "said" }, "main");
  handle.emit("said", { n: 3 });
  started.serviceHub.windowCall("service.on", { service: "demo.echo/v1", event: "said" }, "main");
  connected = [];
  handle.emit("said", { n: 4 });
  assert.deepEqual(published.map((data) => data.data.n), [2]);
  assert.equal(started.serviceHub.interest.size, 0);
});

test("a plugin that injects a versioned service waits for it by name", async () => {
  const files = {
    "user.mjs": `export const name = "user";
export const inject = ["demo.echo/v1"];
export function apply() {
  globalThis.echoUserStarted = true;
}
`,
  };
  const started = await host(files, [{ id: "user", name: "./user.mjs" }]);
  const [user] = started.status();
  assert.equal(user.state, "waiting");
  assert.deepEqual(user.waitingFor, ["demo.echo/v1"]);
  await plugin(started, "echoer", (ctx) => void ctx.services.provide(echoV1, ECHO));
  assert.ok(await until(() => started.status()[0].state === "running"));
  assert.equal(globalThis.echoUserStarted, true);
});

test("providing, subscribing and unloading 1000 times leaves no providers, listeners or window interest", async () => {
  const started = await host();
  const services = started.serviceHub;
  services.attachWindows({ connected: () => ["main"], publish: () => {} });
  const watchers = services.watchers.size;
  const hooks = serviceHooks(started.ctx);
  for (let round = 0; round < 1000; round += 1) {
    let handle;
    const provider = await plugin(started, "echoer", (ctx) => void (handle = ctx.services.provide(echoV1, ECHO)));
    const user = await plugin(started, "user", (ctx) => void ctx.services.get(echoV1).on("said", () => {}));
    services.windowCall("service.on", { service: "demo.echo/v1", event: "said" }, "main");
    handle.emit("said", { round });
    services.windowCall("service.off", { service: "demo.echo/v1", event: "said" }, "main");
    await user.dispose();
    await provider.dispose();
  }
  assert.equal(services.providers.size, 0);
  assert.equal(serviceHooks(started.ctx), hooks);
  assert.equal(services.watchers.size, watchers);
  assert.equal(services.interest.size, 0);
  assert.deepEqual(started.services(), []);
  assert.deepEqual(started.timers(), {});
});

test("a window sees the services in its snapshot, calls them and hears their events over the socket", async () => {
  const { default: WebSocket } = await import("ws");
  const { connectHost, createServiceProxy } = await import("@fuyu/plugin-base/client");
  const space = workspace({
    "echoer.mjs": `export const name = "echoer";
export function apply(ctx) {
  const handle = ctx.services.provide({ name: "demo.echo/v1", methods: { echo: {} }, events: { said: {} } }, {
    echo: ({ text }, caller) => ({ text, window: caller.window }),
  });
  ctx.setInterval(() => handle.emit("said", { at: Date.now() }), 20);
}
`,
    "plugins.yml": config([{ id: "echoer", name: "./echoer.mjs" }]),
  });
  const main = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", main, "--dir", space.dir], { stdio: ["pipe", "pipe", "inherit"] });
  const exited = once(child, "exit");
  cleanup.push(async () => {
    child.kill();
    await exited;
    space.remove();
  });
  const lines = createInterface({ input: child.stdout });
  const ready = await new Promise((resolve) => lines.on("line", (line) => JSON.parse(line).method === "ready" && resolve(JSON.parse(line).params)));
  let snapshot = null;
  const events = [];
  const connection = connectHost({
    resolve: async () => ready.windows,
    window: "settings",
    open: (url) => new WebSocket(url, { origin: "tauri://localhost" }),
    onSnapshot: (value) => (snapshot = value),
    onEvent: (name, data) => name === "service" && events.push(data),
  });
  assert.ok(await until(() => snapshot));
  assert.deepEqual(snapshot.services, [{ name: "demo.echo/v1", plugin: "echoer", methods: ["echo"], events: ["said"] }]);
  assert.deepEqual(await connection.call("service.call", { service: "demo.echo/v1", method: "echo", params: { text: "hi" } }), { text: "hi", window: "settings" });
  await assert.rejects(connection.call("service.call", { service: "demo.echo/v1", method: "apply" }), { code: "no-method" });
  await sleep(100);
  assert.equal(events.length, 0);
  assert.equal(await connection.call("service.on", { service: "demo.echo/v1", event: "said" }), true);
  assert.ok(await until(() => events.length >= 2));
  assert.equal(events[0].service, "demo.echo/v1");
  assert.equal(events[0].event, "said");
  const proxy = createServiceProxy(connection.call);
  const echo = proxy.get(defineService("demo.echo/v1", { methods: { echo: true }, events: { said: true } }));
  assert.deepEqual(await echo.echo({ text: "via proxy" }), { text: "via proxy", window: "settings" });
  const heard = [];
  const off = echo.on("said", (data) => heard.push(data.at));
  events.forEach((message) => proxy.deliver(message));
  assert.ok(heard.length >= 2);
  await off();
  connection.close();
});
