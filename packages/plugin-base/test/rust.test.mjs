import assert from "node:assert/strict";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { connect } from "../src/host/rpc.mjs";
import { builtinFiles, config, sleep, until, workspace } from "./workspace.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const seen = [];
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    seen.push(message);
    const method = methods[message.method];
    if (message.id === undefined) return;
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      const result = await method(message.params, { progress: (data) => write({ method: "progress", params: { id: message.id, data } }) });
      if (result !== undefined) write({ id: message.id, result });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, seen, emit: (name, data) => write({ method: "event", params: { name, data } }), leave: () => toHost.end() };
}

const METHODS = {
  "app.echo": (params) => ({ echo: params }),
  "app.later": (params) => sleep(params.ms).then(() => params.n),
  "test.stream": (params, call) => {
    for (const piece of params.pieces) call.progress({ piece });
    return "done";
  },
  "test.never": () => undefined,
  "test.fail": () => {
    throw Object.assign(new Error("no key"), { code: "no-secret" });
  },
};

const BUILTIN = builtinFiles([{ id: "probe", kind: "builtin", file: "host.mjs" }], {
  "host.mjs": `export const name = "probe";\nexport function apply(ctx) {\n  globalThis.builtinProbe = ctx;\n}\n`,
});

async function startWithBuiltin(rpc, files = {}, dir = ".") {
  globalThis.builtinProbe = null;
  const space = workspace({ "plugins.yml": config([]), ...BUILTIN, ...files });
  const started = await startHost({ dir: join(space.dir, dir), builtins: join(space.dir, "builtins"), rpc });
  cleanup.push(space.remove, () => started.stop());
  await started.settle();
  assert.ok(globalThis.builtinProbe, "the built-in probe plugin started");
  return started;
}

async function host(rust = fakeRust(METHODS)) {
  return { started: await startWithBuiltin(rust.rpc), rust };
}

async function plugin(started, name, apply) {
  const fiber = globalThis.builtinProbe.plugin({ name, apply });
  await fiber;
  return fiber;
}

test("a plugin calls Rust and gets the answer or Rust's own error code", async () => {
  const { started } = await host();
  let rust;
  await plugin(started, "caller", (ctx) => void (rust = ctx.rust));
  assert.deepEqual(await rust.call("app.echo", { text: "hi" }), { echo: { text: "hi" } });
  assert.deepEqual(await rust.call("app.echo"), { echo: null });
  await assert.rejects(rust.call("app.missing"), { code: "no-method", message: "Rust has no method app.missing" });
  await assert.rejects(rust.call("test.fail"), { code: "no-secret", message: "no key" });
  await assert.rejects(rust.call("Not A Name"), { code: "bad-params" });
});

test("a hundred calls at once each get their own answer", async () => {
  const { started } = await host();
  let rust;
  await plugin(started, "caller", (ctx) => void (rust = ctx.rust));
  const answers = await Promise.all(Array.from({ length: 100 }, (_, n) => rust.call("app.later", { n, ms: (n * 7) % 13 })));
  assert.deepEqual(answers, Array.from({ length: 100 }, (_, n) => n));
});

test("progress from Rust reaches onProgress before the answer", async () => {
  const { started } = await host();
  let rust;
  await plugin(started, "caller", (ctx) => void (rust = ctx.rust));
  const pieces = [];
  assert.equal(await rust.call("test.stream", { pieces: ["a", "b", "c"] }, { onProgress: (data) => pieces.push(data.piece) }), "done");
  assert.deepEqual(pieces, ["a", "b", "c"]);
});

test("Rust events reach the plugins listening, count as theirs, and stop when the plugin stops", async () => {
  const { started, rust } = await host();
  const heard = [];
  const fiber = await plugin(started, "listener", (ctx) => {
    ctx.rust.on("clipboard.changed", () => {
      throw new Error("listener broke");
    });
    ctx.rust.on("clipboard.changed", (data) => heard.push(data));
  });
  assert.deepEqual(started.rustListeners(), { probe: 2 });
  assert.equal(started.status().find((plugin) => plugin.id === "probe").usage.listeners, 2);
  rust.emit("clipboard.changed", { text: "x" });
  rust.emit("other", 1);
  await until(() => heard.length === 1);
  assert.deepEqual(heard, [{ text: "x" }]);
  const { usage } = started.status().find((plugin) => plugin.id === "probe");
  assert.equal(usage.errors, 1);
  assert.ok(usage.calls >= 2);
  await fiber.dispose();
  assert.deepEqual(started.rustListeners(), {});
  rust.emit("clipboard.changed", { text: "y" });
  await sleep(20);
  assert.deepEqual(heard, [{ text: "x" }]);
});

test("a call still waiting when its plugin stops fails at once and Rust is told to cancel it", async () => {
  const { started, rust } = await host();
  let pending;
  const fiber = await plugin(started, "caller", (ctx) => void (pending = ctx.rust.call("test.never")));
  assert.ok(await until(() => rust.seen.some((message) => message.method === "test.never")));
  const askedAt = Date.now();
  await fiber.dispose();
  await assert.rejects(pending, { code: "inactive" });
  assert.ok(Date.now() - askedAt < 10000);
  const asked = rust.seen.find((message) => message.method === "test.never");
  assert.ok(await until(() => rust.seen.some((message) => message.method === "cancel" && message.params.id === asked.id)));
});

test("a call times out naming the method and how long it waited, and when Rust goes away waiting calls fail with peer-gone", async () => {
  const { started, rust } = await host();
  let caller;
  await plugin(started, "caller", (ctx) => void (caller = ctx.rust));
  await assert.rejects(caller.call("test.never", null, { timeoutMs: 30 }), (error) => error.code === "timeout" && error.message === "test.never got no answer in 30 ms" && error.data.timeoutMs === 30);
  assert.ok(await until(() => rust.seen.some((message) => message.method === "cancel")));
  const waiting = caller.call("test.never");
  rust.leave();
  await assert.rejects(waiting, { code: "peer-gone" });
  await assert.rejects(caller.call("app.echo"), { code: "peer-gone" });
});

test("without Rust, ctx.rust.call fails with peer-gone instead of hanging", async () => {
  const started = await startWithBuiltin(null);
  let caller;
  await plugin(started, "caller", (ctx) => void (caller = ctx.rust));
  await assert.rejects(caller.call("app.echo"), { code: "peer-gone" });
});

function manifest(name) {
  return JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    license: "MIT",
    repository: "github:ann/plugin",
    engines: { fuyu: ">=0.5.0" },
    fuyu: { manifest: 1, displayName: { "zh-CN": "示例", en: "Example" }, description: { "zh-CN": "示例插件", en: "An example plugin" }, icon: "icon.png", categories: ["utilities"], host: "host.mjs" },
  });
}

const ASKS = (who) => `export const name = ${JSON.stringify(who)};
export async function apply(ctx) {
  const tried = { call: await ctx.rust.call("app.echo", { from: ${JSON.stringify(who)} }).then(() => "answered", (error) => [error.code, error.data]) };
  try {
    ctx.rust.on("clipboard.changed", () => {});
    tried.on = "listening";
  } catch (error) {
    tried.on = error.code;
  }
  ctx.on("rust:clipboard.changed", (data) => globalThis.rustOverheard.push([${JSON.stringify(who)}, data]));
  globalThis.rustAsks[${JSON.stringify(who)}] = tried;
}
`;

test("only built-in plugins call Rust: market, hand-installed, development and loose plugins get forbidden", async () => {
  globalThis.rustAsks = {};
  globalThis.rustOverheard = [];
  const rust = fakeRust(METHODS);
  const started = await startWithBuiltin(
    rust.rpc,
    {
      "data/plugins.yml": ['- id: "@ann/market"\n  source: market\n', '- id: "@ann/manual"\n  source: manual\n', "- id: lab\n  source: dev\n  path: ../app/lab\n", "- id: loose\n  name: ./loose.mjs\n"].join(""),
      "data/packages/@ann/market/package.json": manifest("@ann/market"),
      "data/packages/@ann/market/host.mjs": ASKS("market"),
      "data/packages/@ann/manual/package.json": manifest("@ann/manual"),
      "data/packages/@ann/manual/host.mjs": ASKS("manual"),
      "app/lab/package.json": manifest("@ann/lab"),
      "app/lab/host.mjs": ASKS("dev"),
      "data/loose.mjs": ASKS("loose"),
    },
    "data",
  );
  assert.ok(await until(() => Object.keys(globalThis.rustAsks).length === 4), JSON.stringify(started.status()));
  assert.deepEqual(globalThis.rustAsks, {
    market: { call: ["forbidden", { plugin: "@ann/market", source: "market" }], on: "forbidden" },
    manual: { call: ["forbidden", { plugin: "@ann/manual", source: "manual" }], on: "forbidden" },
    dev: { call: ["forbidden", { plugin: "lab", source: "dev" }], on: "forbidden" },
    loose: { call: ["forbidden", { plugin: "loose", source: null }], on: "forbidden" },
  });
  let fromRoot;
  await started.ctx.plugin({ name: "root-level", apply: (ctx) => void (fromRoot = ctx.rust) });
  await assert.rejects(fromRoot.call("app.echo"), { code: "forbidden", data: { plugin: null, source: null } });
  assert.throws(() => started.ctx.rust.on("clipboard.changed", () => {}), { code: "forbidden" });
  assert.deepEqual(started.rustListeners(), {});
  let builtin;
  const heard = [];
  started.ctx.on("rust:clipboard.changed", (data) => globalThis.rustOverheard.push(["root", data]));
  await plugin(started, "inside-builtin", (ctx) => {
    builtin = ctx.rust;
    ctx.rust.on("clipboard.changed", (data) => heard.push(data));
  });
  assert.deepEqual(await builtin.call("app.echo", { from: "builtin" }), { echo: { from: "builtin" } });
  assert.deepEqual(rust.seen.filter((message) => message.method === "app.echo").map((message) => message.params), [{ from: "builtin" }]);
  rust.emit("clipboard.changed", { text: "copied" });
  assert.ok(await until(() => heard.length === 1));
  await sleep(20);
  assert.deepEqual(heard, [{ text: "copied" }]);
  assert.deepEqual(globalThis.rustOverheard, []);
});
