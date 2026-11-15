import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import WebSocket from "ws";
import { connectHost, createBridge, createLoader, createSlots } from "@fuyu/plugin-base/client";
import { until } from "./workspace.mjs";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../examples/hello", import.meta.url));
const children = [];
const dirs = [];
after(async () => {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    } catch {}
  }
});

async function hostWithExample() {
  const dir = mkdtempSync(join(tmpdir(), "plugin-bridge-"));
  dirs.push(dir);
  cpSync(EXAMPLE, join(dir, "hello"), { recursive: true });
  writeFileSync(join(dir, "plugins.yml"), "- id: hello\n  name: ./hello/host.mjs\n");
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", MAIN, "--dir", dir], { stdio: ["pipe", "pipe", "inherit"] });
  children.push(child);
  return new Promise((resolve) => {
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.method === "ready") resolve(message.params);
    });
  });
}

test("the example plugin's host part registers its window code, answers its window and pushes to it", async () => {
  const ready = await hostWithExample();
  assert.deepEqual(ready.plugins.map((entry) => [entry.id, entry.state]), [["hello", "running"]]);
  let connection;
  const bridge = createBridge((method, params) => connection.call(method, params));
  let snapshot = null;
  const ticks = [];
  bridge.subscribe((message) => message.topic === "tick" && ticks.push(message.data));
  connection = connectHost({
    resolve: async () => ready.windows,
    window: "island",
    open: (url) => {
      const socket = new WebSocket(url, { origin: "tauri://localhost" });
      socket.on("error", () => {});
      return socket;
    },
    onSnapshot: (value) => (snapshot = value),
    onEvent: (name, data) => name === "plugin" && bridge.deliver(data),
  });
  assert.ok(await until(() => connection.state === "open"));
  assert.deepEqual(snapshot.clients.map((entry) => [entry.plugin, entry.window, entry.path]), [["hello", "island", "hello/island.js"]]);
  assert.match(await bridge.call("hello", "greet", { who: "test" }), /^hello test, from the plugin host/);
  await assert.rejects(bridge.call("hello", "missing"), (error) => error.code === "no-method");
  await assert.rejects(bridge.call("nobody", "greet"), (error) => error.code === "no-method");
  assert.ok(await until(() => ticks.length >= 2, 4000), `ticks: ${ticks}`);
  assert.ok(ticks[1] > ticks[0]);
  connection.close();
});

test("a window plugin's ctx.host reaches only its own plugin, and its listeners go when it goes", async () => {
  const sent = [];
  const bridge = createBridge(async (method, params) => {
    sent.push([method, params]);
    return "answer";
  });
  const registry = createSlots({ "island.dev/v1": {} });
  const heard = [];
  let answer;
  const loader = createLoader({
    registry,
    base: "fuyu-plugin://localhost",
    bridge,
    checkFile: async () => {},
    importModule: async () => ({
      default: async (ctx) => {
        ctx.host.on("tick", (data) => heard.push(data));
        answer = await ctx.host.call("greet", { who: "me" });
      },
    }),
  });
  await loader.sync([{ id: "hello#1", plugin: "hello", window: "island", path: "hello/island.js", version: "1" }]);
  assert.equal(answer, "answer");
  assert.deepEqual(sent, [["plugin.call", { plugin: "hello", method: "greet", params: { who: "me" } }]]);
  bridge.deliver({ plugin: "hello", topic: "tick", data: 1 });
  bridge.deliver({ plugin: "other", topic: "tick", data: 99 });
  bridge.deliver({ plugin: "hello", topic: "other", data: 98 });
  assert.deepEqual(heard, [1]);
  await loader.sync([]);
  bridge.deliver({ plugin: "hello", topic: "tick", data: 2 });
  assert.deepEqual(heard, [1]);
});
