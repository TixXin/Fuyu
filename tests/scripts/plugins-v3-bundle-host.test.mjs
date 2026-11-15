import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { after, before, test } from "node:test";
import { bundleHost } from "../../scripts/plugins-v3/bundle-host.mjs";
import { PLUGINS, config, workspace } from "../../packages/plugin-base/test/workspace.mjs";

const children = [];
const folders = [];
let built;

before(async () => {
  const outDir = join(mkdtempSync(join(tmpdir(), "fuyu-host-bundle-")), "host");
  folders.push(join(outDir, ".."));
  built = await bundleHost({ outDir });
});

function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000);
    child.once("exit", () => (clearTimeout(timer), resolve()));
    try {
      child.kill();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

after(async () => {
  await Promise.all(children.map(stopChild));
  for (const folder of folders) {
    try {
      rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  }
});

function launch(entries, files = {}) {
  const space = workspace({ ...PLUGINS, "plugins.yml": typeof entries === "string" ? entries : config(entries), ...files });
  folders.push(space.dir);
  const child = spawn(process.execPath, ["--disallow-code-generation-from-strings", built.main, "--dir", space.dir], { stdio: ["pipe", "pipe", "pipe"] });
  children.push(child);
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const messages = [];
  const waiters = [];
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line);
    messages.push(message);
    for (const waiter of waiters.filter((entry) => entry.match(message))) {
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  });
  const next = (match, ms = 15000) =>
    new Promise((resolve, reject) => {
      const found = messages.find(match);
      if (found) return resolve(found);
      const timer = setTimeout(() => reject(new Error(`no matching message in ${ms} ms; stderr: ${stderr}`)), ms);
      waiters.push({ match, resolve: (message) => (clearTimeout(timer), resolve(message)) });
    });
  const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  return { child, next, send, exited };
}

test("the host bundles into one folder of ES modules with the createRequire banner", () => {
  assert.deepEqual(built.files.filter((name) => !name.startsWith("chunk-")), ["client-only.mjs", "hmr.mjs", "index.mjs", "main.mjs", "plugins-file.mjs"]);
  assert.ok(built.files.every((name) => name.endsWith(".mjs")));
  for (const name of built.files) assert.match(readFileSync(join(built.outDir, name), "utf8"), /^import \{ createRequire as __fuyuCreateRequire \}/);
  assert.ok(built.bytes > 100_000 && built.bytes < 3_000_000, `${built.bytes} bytes`);
});

test("the bundled host runs outside the repository without eval, loads plugins that import the API, and stops", async () => {
  const { next, send, exited } = launch([
    { id: "user", name: "./user.mjs" },
    { id: "counter", name: "./counter.mjs" },
  ]);
  const ready = await next((message) => message.method === "ready");
  assert.equal(ready.params.protocol, 2);
  assert.ok(ready.params.windows.port > 0);
  assert.deepEqual(ready.params.plugins.map((entry) => [entry.id, entry.state]), [
    ["user", "running"],
    ["counter", "running"],
  ]);
  send({ id: 1, method: "ping", params: "hi" });
  assert.equal((await next((message) => message.id === 1)).result.echo, "hi");
  send({ id: 2, method: "stop" });
  assert.equal((await next((message) => message.id === 2)).result, true);
  assert.equal(await exited, 0);
});

test("the bundled host reports a broken plugin instead of dying", async () => {
  const { next, send, exited } = launch([{ id: "broken", name: "./broken.mjs" }]);
  const log = await next((message) => message.method === "log" && message.params.type === "error");
  assert.match(log.params.text, /broken on purpose/);
  const ready = await next((message) => message.method === "ready");
  assert.equal(ready.params.plugins[0].state, "failed");
  send({ id: 1, method: "stop" });
  assert.equal(await exited, 0);
});

function packageJson(name, app) {
  return JSON.stringify({
    name,
    version: "1.0.0",
    type: "module",
    license: "MIT",
    repository: `github:${name.slice(1).split("/")[0]}/plugin`,
    engines: { fuyu: ">=0.5.0" },
    fuyu: { manifest: 1, displayName: { "zh-CN": "示例", en: "Example" }, description: { "zh-CN": "示例", en: "Example" }, icon: "icon.png", categories: ["utilities"], ...app },
  });
}

test("the bundled host carries the manifest check: it loads an installed package by its package.json and refuses one with experimental interfaces", async () => {
  for (const name of built.files) assert.doesNotMatch(readFileSync(join(built.outDir, name), "utf8"), /["']@fuyu\/plugin-manifest["']/, name);
  const plugin = 'export const name = "ok";\nexport function apply() {}\n';
  const { next, send, exited } = launch('- id: "@ann/ok"\n  source: market\n- id: "@ann/lab"\n  source: market\n', {
    "packages/@ann/ok/package.json": packageJson("@ann/ok", { host: "host.mjs", client: { island: "island.js" } }),
    "packages/@ann/ok/host.mjs": plugin,
    "packages/@ann/ok/island.js": "export default () => {};\n",
    "packages/@ann/lab/package.json": packageJson("@ann/lab", { host: "host.mjs", experimental: ["island.peek"] }),
    "packages/@ann/lab/host.mjs": plugin,
  });
  const ready = await next((message) => message.method === "ready");
  const byId = Object.fromEntries(ready.params.plugins.map((entry) => [entry.id, entry]));
  assert.equal(byId["@ann/ok"].state, "running", JSON.stringify(byId["@ann/ok"]));
  assert.equal(byId["@ann/ok"].source, "market");
  assert.equal(byId["@ann/lab"].state, "failed");
  assert.equal(byId["@ann/lab"].blocked.by, "manifest");
  assert.ok(byId["@ann/lab"].blocked.errors.some((issue) => issue.code === "experimental"));
  send({ id: 1, method: "stop" });
  assert.equal(await exited, 0);
});
