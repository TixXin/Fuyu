import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { join } from "node:path";
import { builtinFiles, config, sleep, workspace } from "./workspace.mjs";

const MAIN = fileURLToPath(new URL("../src/host/main.mjs", import.meta.url));
const cleanup = [];
after(async () => {
  for (const step of cleanup) await step();
});

function launch(files, entries, args = [], nodeArgs = ["--disallow-code-generation-from-strings"]) {
  const space = workspace({ ...files, "plugins.yml": config(entries) });
  const extra = typeof args === "function" ? args(space.dir) : args;
  const child = spawn(process.execPath, [...nodeArgs, MAIN, "--dir", space.dir, ...extra], { stdio: ["pipe", "pipe", "pipe"] });
  const exited = once(child, "exit");
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await exited;
    }
    space.remove();
  });
  const messages = [];
  createInterface({ input: child.stdout }).on("line", (line) => messages.push(JSON.parse(line)));
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const next = async (match, ms = 10000) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const found = messages.find(match);
      if (found) return found;
      await sleep(10);
    }
    throw new Error(`no matching message in ${ms} ms; stderr: ${stderr}`);
  };
  let id = 100;
  const call = async (method) => {
    id += 1;
    const mine = id;
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: mine, method })}\n`);
    return (await next((message) => message.id === mine)).result;
  };
  return { space, next, call, stderr: () => stderr };
}

test("a plugin whose stray rejections keep coming is switched off and says why", async () => {
  const { next, call } = launch(
    {
      "stray.mjs": `export const name = "stray";
export function apply(ctx) {
  ctx.setInterval(() => Promise.reject(new Error("stray again")), 5);
}
`,
    },
    [{ id: "stray", name: "./stray.mjs" }],
  );
  await next((message) => message.method === "ready");
  const deadline = Date.now() + 5000;
  let stray;
  while (Date.now() < deadline) {
    stray = (await call("status")).find((entry) => entry.id === "stray");
    if (stray.state === "auto-disabled") break;
    await sleep(20);
  }
  assert.equal(stray.state, "auto-disabled");
  assert.match(stray.reason, /stray again/);
  assert.equal(stray.usage.timers, 0);
  assert.ok((await call("ping")).at > 0);
});

test("the host started with --safe holds back third-party plugins and says so in ready", async () => {
  const files = { "plain.mjs": `export const name = "plain";\nexport function apply() {}\n` };
  const { next } = launch(
    { ...files, ...builtinFiles([{ id: "inside", kind: "builtin", file: "plain.mjs" }], files) },
    [
      { id: "outside", name: "./plain.mjs" },
      { id: "posing", name: "./plain.mjs", extra: "  kind: builtin\n" },
    ],
    (dir) => ["--safe", "third-party", "--builtins", join(dir, "builtins")],
  );
  const ready = (await next((message) => message.method === "ready")).params;
  assert.equal(ready.safe, "third-party");
  assert.deepEqual(
    ready.plugins.map((entry) => [entry.id, entry.state]),
    [
      ["inside", "running"],
      ["outside", "safe-mode"],
      ["posing", "safe-mode"],
    ],
  );
});

test("an unknown --safe value starts every plugin instead of failing the host", async () => {
  const files = { "plain.mjs": `export const name = "plain";\nexport function apply() {}\n` };
  const { next, stderr } = launch(files, [{ id: "outside", name: "./plain.mjs" }], ["--safe", "nope"]);
  const ready = (await next((message) => message.method === "ready")).params;
  assert.equal(ready.safe, null);
  assert.equal(ready.plugins[0].state, "running");
  assert.match(stderr(), /unknown safe mode nope/);
});

test("a window gets the host's own numbers and each plugin's usage in its snapshot", async () => {
  const { default: WebSocket } = await import("ws");
  const { connectHost } = await import("@fuyu/plugin-base/client");
  const files = { "plain.mjs": `export const name = "plain";\nexport function apply(ctx) {\n  ctx.on("probe/x", () => {});\n}\n` };
  const { next } = launch(files, [{ id: "plain", name: "./plain.mjs" }]);
  const ready = (await next((message) => message.method === "ready")).params;
  let snapshot = null;
  const connection = connectHost({
    resolve: async () => ready.windows,
    window: "settings",
    open: (url) => new WebSocket(url, { origin: "tauri://localhost" }),
    onSnapshot: (value) => (snapshot = value),
  });
  const deadline = Date.now() + 5000;
  while (!snapshot && Date.now() < deadline) await sleep(10);
  assert.ok(snapshot.host.pid > 0);
  assert.ok(snapshot.host.rssBytes > 0);
  assert.equal(snapshot.host.safe, null);
  assert.equal(snapshot.plugins[0].usage.listeners, 1);
  assert.equal(typeof (await connection.call("host")).heapUsedBytes, "number");
  connection.close();
});

test("with --dev the host swaps in a plugin's new code when its file changes", async () => {
  const plugin = (version) => `export const name = "live";\nexport function apply() {\n  console.error("live version ${version}");\n}\n`;
  const { space, next, stderr } = launch({ "live.mjs": plugin(1) }, [{ id: "live", name: "./live.mjs" }], ["--dev"], ["--expose-internals"]);
  await next((message) => message.method === "ready");
  assert.match(stderr(), /live version 1/);
  await sleep(300);
  space.write({ "live.mjs": plugin(2) });
  const deadline = Date.now() + 8000;
  while (!/live version 2/.test(stderr()) && Date.now() < deadline) await sleep(20);
  assert.match(stderr(), /live version 2/);
});
