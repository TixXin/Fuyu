import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { DEFAULT_SOURCE, buildBuiltins } from "../../scripts/plugins-v3/build-builtins.mjs";

const MAIN = fileURLToPath(new URL("../../packages/plugin-base/src/host/main.mjs", import.meta.url));
const NO_TYPE_STRIPPING = ["--no-experimental-strip-types", "--disallow-code-generation-from-strings"];
const folders = [];
const children = [];
let built;

before(async () => {
  const root = mkdtempSync(join(tmpdir(), "fuyu-builtins-"));
  folders.push(root);
  built = await buildBuiltins({ outDir: join(root, "builtins") });
});

after(async () => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }
  }
  for (const folder of folders) rmSync(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function readyFrom(builtins) {
  const data = mkdtempSync(join(tmpdir(), "fuyu-builtins-data-"));
  folders.push(data);
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, "plugins.yml"), "[]\n");
  const child = spawn(process.execPath, [...NO_TYPE_STRIPPING, MAIN, "--dir", data, "--builtins", builtins], { stdio: ["pipe", "pipe", "pipe"] });
  children.push(child);
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ready in 15 s; stderr: ${stderr}`)), 15000);
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.method !== "ready") return;
      clearTimeout(timer);
      resolve({ ready: message.params, stderr: () => stderr });
    });
  });
}

test("each built-in plugin's host part is one .mjs file at the path the copied list names", () => {
  const source = JSON.parse(readFileSync(join(DEFAULT_SOURCE, "builtins.json"), "utf8"));
  const output = JSON.parse(readFileSync(join(built.outDir, "builtins.json"), "utf8"));
  assert.deepEqual(output.plugins.map((plugin) => plugin.id), source.plugins.map((plugin) => plugin.id));
  assert.ok(built.plugins.includes("timer"));
  for (const plugin of output.plugins) {
    assert.match(plugin.host, /\.mjs$/);
    const text = readFileSync(join(built.outDir, plugin.root, plugin.host), "utf8");
    assert.doesNotMatch(text, /from\s+["'][^"']+\.ts["']/, `${plugin.id} still imports a .ts file`);
  }
});

test("the built plugins load on a Node that cannot strip types, where the sources cannot", async () => {
  const fromBuild = await readyFrom(built.outDir);
  const timer = fromBuild.ready.plugins.find((plugin) => plugin.id === "timer");
  assert.equal(timer.state, "running", fromBuild.stderr());
  assert.equal(timer.kind, "builtin");
  const fromSource = await readyFrom(DEFAULT_SOURCE);
  const failed = fromSource.ready.plugins.find((plugin) => plugin.id === "timer");
  assert.equal(failed.state, "failed");
  assert.match(fromSource.stderr() + failed.error, /\.ts/);
});
