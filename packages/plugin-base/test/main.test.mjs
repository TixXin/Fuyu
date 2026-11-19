import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { PLUGINS, builtinFiles, config, workspace } from "./workspace.mjs";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const cleanup = [];
after(() => cleanup.forEach((step) => step()));

const NOISY = {
  "noisy.mjs": `export const name = "noisy";
export function apply() {
  console.log("a plugin printing to stdout");
  process.stdout.write("more noise\\n");
}
`,
};

const ASKS = {
  "host.mjs": `export const name = "asks";
export async function apply(ctx) {
  ctx.rust.on("tick", (data) => void ctx.rust.call("test.heard", data));
  const pieces = [];
  const answer = await ctx.rust.call("app.echo", { x: 1 }, { onProgress: (data) => pieces.push(data) });
  await ctx.rust.call("test.report", { answer, pieces });
}
`,
};

function launch(entries, files = PLUGINS, builtins = []) {
  const space = workspace({ ...files, "plugins.yml": config(entries), ...(builtins.length ? builtinFiles(builtins, files) : {}) });
  cleanup.push(space.remove);
  const extra = builtins.length ? ["--builtins", join(space.dir, "builtins")] : [];
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", MAIN, "--dir", space.dir, ...extra], { stdio: ["pipe", "pipe", "pipe"] });
  cleanup.push(() => child.kill());
  const messages = [];
  const waiters = [];
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.match(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const next = (match, ms = 10000) =>
    new Promise((resolve, reject) => {
      const found = messages.find(match);
      if (found) return resolve(found);
      const timer = setTimeout(() => reject(new Error(`no matching message in ${ms} ms; stderr: ${stderr}`)), ms);
      waiters.push({ match, resolve: (message) => (clearTimeout(timer), resolve(message)) });
    });
  const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, next, send, exited, stderr: () => stderr };
}

test("the host says it is ready with its plugins, and answers ping and status", async () => {
  const { next, send } = launch([
    { id: "user", name: "./user.mjs" },
    { id: "counter", name: "./counter.mjs" },
  ]);
  const ready = await next((message) => message.method === "ready");
  assert.equal(ready.params.protocol, 2);
  assert.ok(ready.params.windows.port > 0);
  assert.match(ready.params.windows.token, /^[0-9a-f]{64}$/);
  assert.deepEqual(ready.params.plugins.map((entry) => entry.state), ["running", "running"]);
  send({ id: 1, method: "ping" });
  assert.ok((await next((message) => message.id === 1)).result.at > 0);
  send({ id: 2, method: "status" });
  assert.equal((await next((message) => message.id === 2)).result.length, 2);
});

test("the host tells Rust which window code it registered before it says it is ready", async () => {
  const files = {
    "painter/host.mjs": `export const name = "painter";
export const inject = ["clients"];
export function apply(ctx) {
  ctx.clients.add("island", new URL("./island.js", import.meta.url).href);
  ctx.clients.add("settings", new URL("./island.js", import.meta.url).href);
}
`,
    "painter/island.js": "export default () => {};\n",
  };
  const { next } = launch([{ id: "painter", name: "./painter/host.mjs" }], files);
  const ready = next((message) => message.method === "ready");
  const clients = next((message) => message.method === "clients");
  assert.deepEqual((await ready).params.plugins.map((entry) => entry.state), ["running"]);
  const before = await next((message) => message.method === "clients" || message.method === "ready", 0);
  assert.equal(before.method, "clients", "the list reaches Rust before ready");
  assert.deepEqual((await clients).params, { paths: ["painter/island.js"], roots: [] });
});

test("a built-in plugin calls Rust over stdin and stdout, sees progress, and hears Rust's events", async () => {
  const { next, send } = launch([], ASKS, [{ id: "asks", kind: "builtin", file: "host.mjs" }]);
  const echo = await next((message) => message.method === "app.echo");
  assert.deepEqual(echo.params, { x: 1 });
  send({ method: "progress", params: { id: echo.id, data: "half" } });
  send({ id: echo.id, result: { echo: { x: 1 } } });
  const report = await next((message) => message.method === "test.report");
  assert.deepEqual(report.params, { answer: { echo: { x: 1 } }, pieces: ["half"] });
  send({ id: report.id, result: null });
  await next((message) => message.method === "ready");
  send({ method: "event", params: { name: "tick", data: 7 } });
  assert.equal((await next((message) => message.method === "test.heard")).params, 7);
});

test("what plugins print goes to stderr, so the pipe to Rust stays clean", async () => {
  const { next, send, stderr } = launch([{ id: "noisy", name: "./noisy.mjs" }], NOISY);
  await next((message) => message.method === "ready");
  send({ id: 1, method: "ping" });
  await next((message) => message.id === 1);
  assert.match(stderr(), /a plugin printing to stdout/);
  assert.match(stderr(), /more noise/);
});

test("the host passes on errors from the kernel, such as a plugin that failed", async () => {
  const { next } = launch([{ id: "broken", name: "./broken.mjs" }]);
  const log = await next((message) => message.method === "log" && message.params.type === "error");
  assert.match(log.params.text, /broken on purpose/);
});

test("the host stops its plugins and exits when its stdin closes", async () => {
  const { child, next, exited } = launch([
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ]);
  await next((message) => message.method === "ready");
  const started = Date.now();
  child.stdin.end();
  assert.equal(await exited, 0);
  assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
});

test("the host exits when asked to stop", async () => {
  const { next, send, exited } = launch([{ id: "counter", name: "./counter.mjs" }]);
  await next((message) => message.method === "ready");
  send({ id: 9, method: "stop" });
  assert.equal((await next((message) => message.id === 9)).result, true);
  assert.equal(await exited, 0);
});

test("a window connected to the host hears about plugin changes as they happen", async () => {
  const { default: WebSocket } = await import("ws");
  const { connectHost } = await import("@fuyu/plugin-base/client");
  const entries = [
    { id: "counter", name: "./counter.mjs" },
    { id: "user", name: "./user.mjs" },
  ];
  const space = workspace({ ...PLUGINS, "plugins.yml": config(entries) });
  cleanup.push(space.remove);
  const child = spawn(process.execPath, [MAIN, "--dir", space.dir, "--watch"], { stdio: ["pipe", "pipe", "inherit"] });
  cleanup.push(() => child.kill());
  const ready = await new Promise((resolve) => {
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.method === "ready") resolve(message.params);
    });
  });
  const updates = [];
  let snapshot = null;
  const connection = connectHost({
    resolve: async () => ready.windows,
    window: "island",
    open: (url) => new WebSocket(url, { origin: "tauri://localhost" }),
    onSnapshot: (value) => (snapshot = value),
    onEvent: (name, data) => name === "plugins" && updates.push(data),
  });
  const deadline = Date.now() + 5000;
  while (connection.state !== "open" && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(snapshot.plugins.map((entry) => entry.state), ["running", "running"]);
  space.write({ "plugins.yml": config([entries[0], { ...entries[1], disabled: true }]) });
  while (!updates.some((list) => list.find((entry) => entry.id === "user")?.state === "disabled") && Date.now() < deadline + 5000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(updates.some((list) => list.find((entry) => entry.id === "user")?.state === "disabled"), JSON.stringify(updates));
  connection.close();
});

test("a stray error in a plugin is logged under that plugin and the host keeps running", async () => {
  const { next, send } = launch([{ id: "stray", name: "./stray.mjs" }], {
    "stray.mjs": `export const name = "stray";
export function apply() {
  setTimeout(() => Promise.reject(new Error("stray rejection")), 10);
}
`,
  });
  await next((message) => message.method === "ready");
  const log = await next((message) => message.method === "log" && /stray rejection/.test(message.params.text));
  assert.equal(log.params.plugin, "stray");
  assert.match(log.params.text, /^unhandled rejection in plugin stray/);
  send({ id: 5, method: "ping" });
  assert.ok((await next((message) => message.id === 5)).result.at > 0);
});
