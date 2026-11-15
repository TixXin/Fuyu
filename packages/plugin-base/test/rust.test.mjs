import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { connect } from "../src/host/rpc.mjs";
import { config, sleep, until, workspace } from "./workspace.mjs";

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

async function host(rust = fakeRust(METHODS)) {
  const space = workspace({ "plugins.yml": config([]) });
  const started = await startHost({ dir: space.dir, rpc: rust.rpc });
  cleanup.push(space.remove, () => started.stop());
  await started.settle();
  return { started, rust };
}

async function plugin(started, name, apply) {
  const fiber = started.ctx.plugin({ name, apply });
  await fiber;
  return fiber;
}

function rustHooks(ctx) {
  return Object.entries(ctx.events._hooks)
    .filter(([name]) => name.startsWith("rust:"))
    .reduce((total, [, hooks]) => total + hooks.length, 0);
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

test("Rust events reach the plugins listening, and stop when the plugin stops", async () => {
  const { started, rust } = await host();
  const heard = [];
  const fiber = await plugin(started, "listener", (ctx) => void ctx.rust.on("clipboard.changed", (data) => heard.push(data)));
  assert.equal(rustHooks(started.ctx), 1);
  rust.emit("clipboard.changed", { text: "x" });
  rust.emit("other", 1);
  await until(() => heard.length === 1);
  assert.deepEqual(heard, [{ text: "x" }]);
  await fiber.dispose();
  assert.equal(rustHooks(started.ctx), 0);
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
  const space = workspace({ "plugins.yml": config([]) });
  const started = await startHost({ dir: space.dir });
  cleanup.push(space.remove, () => started.stop());
  let caller;
  await plugin(started, "caller", (ctx) => void (caller = ctx.rust));
  await assert.rejects(caller.call("app.echo"), { code: "peer-gone" });
});
