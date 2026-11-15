import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { HOST_SHARED_MODULES } from "@fuyu/plugin-base/protocol";
import { DEFAULT_SOURCE, buildBuiltins } from "../../scripts/plugins-v3/build-builtins.mjs";

const MAIN = fileURLToPath(new URL("../../packages/plugin-base/src/host/main.mjs", import.meta.url));
const IN_REPO = fileURLToPath(new URL("../../node_modules/.cache/", import.meta.url));
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
  const logs = [];
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ready in 15 s; stderr: ${stderr}`)), 15000);
    createInterface({ input: child.stdout }).on("line", (line) => {
      const message = JSON.parse(line);
      if (message.method === "log") logs.push(message.params);
      if (message.method !== "ready") return;
      clearTimeout(timer);
      resolve({ ready: message.params, stderr: () => stderr, explain: (plugin) => JSON.stringify({ plugin, logs, stderr }, null, 2) });
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
  assert.equal(timer.state, "running", fromBuild.explain(timer));
  assert.equal(timer.kind, "builtin");
  const fromSource = await readyFrom(DEFAULT_SOURCE);
  const failed = fromSource.ready.plugins.find((plugin) => plugin.id === "timer");
  assert.equal(failed.state, "failed");
  assert.match(fromSource.stderr() + failed.error, /\.ts/);
});

const OFFICIAL = {
  name: "@fuyu/pager",
  version: "1.0.0",
  type: "module",
  license: "MIT",
  repository: "github:TixXin/fuyu",
  engines: { fuyu: ">=0.5.0" },
  fuyu: { manifest: 1, displayName: { "zh-CN": "翻页", en: "Pager" }, description: { "zh-CN": "翻页", en: "Pager" }, icon: "icon.svg", categories: ["utilities"], host: "host.mjs" },
};

function sourceFolder(files, parent = tmpdir()) {
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, "fuyu-builtins-src-"));
  folders.push(root);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
}

test("a built-in plugin described by its package.json is built too, and the copied manifest names the built file", async () => {
  const source = sourceFolder({
    "builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "pager", root: "pager" }] }),
    "pager/package.json": JSON.stringify(OFFICIAL),
    "pager/host.mjs": 'import { greeting } from "./greeting.ts";\nexport const name = "pager";\nexport function apply() {\n  console.error(greeting);\n}\n',
    "pager/greeting.ts": 'export const greeting: string = "pager says hi";\n',
  });
  const out = await buildBuiltins({ source, outDir: `${source}-out` });
  folders.push(out.outDir);
  assert.equal(JSON.parse(readFileSync(join(out.outDir, "pager", "package.json"), "utf8")).fuyu.host, "host.mjs");
  const { ready, stderr } = await readyFrom(out.outDir);
  const pager = ready.plugins.find((plugin) => plugin.id === "pager");
  assert.equal(pager.state, "running", stderr());
  assert.equal(pager.source, "builtin");
  writeFileSync(join(source, "pager", "package.json"), JSON.stringify({ ...OFFICIAL, fuyu: { ...OFFICIAL.fuyu, client: { island: "host.mjs" } } }));
  await assert.rejects(buildBuiltins({ source, outDir: `${source}-out` }), /window code/);
});

test("only the modules the host shares stay outside a built-in plugin; its subpaths are bundled and load", async () => {
  const imports = HOST_SHARED_MODULES.map((name, index) => `import * as shared${index} from ${JSON.stringify(name)};`).join("\n");
  const source = sourceFolder(
    {
      "builtins.json": JSON.stringify({ format: 1, plugins: [{ id: "pager", root: "pager" }] }),
      "pager/package.json": JSON.stringify(OFFICIAL),
      "pager/host.mjs": `${imports}\nimport { HOST_PROTOCOL } from "@fuyu/plugin-base/protocol";\nexport const name = "pager";\nexport function apply() {\n  console.error(HOST_PROTOCOL, ${HOST_SHARED_MODULES.map((_, index) => `typeof shared${index}`).join(", ")});\n}\n`,
    },
    IN_REPO,
  );
  const out = await buildBuiltins({ source, outDir: join(mkdtempSync(join(tmpdir(), "fuyu-builtins-out-")), "builtins") });
  folders.push(dirname(out.outDir));
  assert.deepEqual(out.external, [...HOST_SHARED_MODULES].sort());
  const text = readFileSync(join(out.outDir, "pager", "host.mjs"), "utf8");
  assert.doesNotMatch(text, /@fuyu\/plugin-base\//);
  const { ready, stderr } = await readyFrom(out.outDir);
  const pager = ready.plugins.find((plugin) => plugin.id === "pager");
  assert.equal(pager.state, "running", `${pager.error ?? ""}\n${stderr()}`);
});
