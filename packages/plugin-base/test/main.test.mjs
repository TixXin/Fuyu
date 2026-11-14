import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { PLUGINS, config, workspace } from "./workspace.mjs";

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

function launch(entries, files = PLUGINS) {
  const space = workspace({ ...files, "plugins.yml": config(entries) });
  cleanup.push(space.remove);
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", MAIN, "--dir", space.dir], { stdio: ["pipe", "pipe", "pipe"] });
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
  assert.equal(ready.params.protocol, 1);
  assert.deepEqual(ready.params.plugins.map((entry) => entry.state), ["running", "running"]);
  send({ id: 1, method: "ping" });
  assert.ok((await next((message) => message.id === 1)).result.at > 0);
  send({ id: 2, method: "status" });
  assert.equal((await next((message) => message.id === 2)).result.length, 2);
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
