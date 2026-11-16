import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const catalog = JSON.parse(readFileSync(join(BUILTINS, "builtins.json"), "utf8"));
const RUST_WRITES = (off) => (off.length ? off.map((id) => `- id: ${id}\n  disabled: true\n`).join("") : "[]\n");
const COUNTED = ["timers", "listeners", "services", "clients"];
const HANDLES = new Set(["Timeout", "Immediate", "FSEventWrap", "StatWatcher", "TCPServerWrap", "TCPSocketWrap", "PipeWrap", "ProcessWrap", "UDPWrap"]);

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await pause(20);
  }
  return check();
}

function handles() {
  const counts = new Map();
  for (const type of process.getActiveResourcesInfo()) if (HANDLES.has(type)) counts.set(type, (counts.get(type) ?? 0) + 1);
  return counts;
}

async function quietHandles() {
  let least = null;
  for (let round = 0; round < 3; round += 1) {
    await pause(25);
    const now = handles();
    if (!least) least = now;
    else for (const type of new Set([...least.keys(), ...now.keys()])) least.set(type, Math.min(least.get(type) ?? 0, now.get(type) ?? 0));
  }
  return least;
}

async function hostOn(builtins, dir) {
  writeFileSync(join(dir, "plugins.yml"), RUST_WRITES([]));
  const host = await startHost({ dir, builtins, watch: true });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

async function switchTo(host, dir, off) {
  writeFileSync(join(dir, "plugins.yml"), RUST_WRITES(off));
  const want = (plugin) => (off.includes(plugin.id) ? plugin.state === "disabled" : plugin.state !== "disabled");
  await until(() => host.status().every(want));
  await host.settle();
}

async function residueAfterOff(host, dir, id) {
  const found = [];
  await switchTo(host, dir, [id]);
  const before = await quietHandles();
  await switchTo(host, dir, []);
  const back = host.status().find((plugin) => plugin.id === id);
  if (back?.state !== "running") found.push(`${id} is ${back?.state ?? "missing"} after it is switched back on`);
  await switchTo(host, dir, [id]);
  const status = host.status().find((plugin) => plugin.id === id);
  if (status?.state !== "disabled") found.push(`${id} is ${status?.state ?? "missing"}, not disabled`);
  for (const key of COUNTED) {
    if ((status?.usage?.[key] ?? 0) !== 0) found.push(`${id} still has ${status.usage[key]} ${key}`);
  }
  for (const service of host.services()) {
    if (service.plugin === id) found.push(`${id} still provides ${service.name}`);
  }
  for (const client of host.clients()) {
    if (client.plugin === id) found.push(`${id} still has the window file ${client.path}`);
  }
  const afterwards = await quietHandles();
  for (const [type, count] of afterwards) {
    if (count > (before.get(type) ?? 0)) found.push(`${id} left ${count - (before.get(type) ?? 0)} ${type} behind after one round of on and off`);
  }
  await switchTo(host, dir, []);
  return found;
}

test("every built-in plugin, switched off, is disabled with no timers, listeners, services, window files or handles left", { timeout: 120_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "builtins-off-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const host = await hostOn(BUILTINS, dir);
  const residue = [];
  for (const plugin of catalog.plugins) {
    if (plugin.kind === "essential") continue;
    residue.push(...(await residueAfterOff(host, dir, plugin.id)));
  }
  assert.deepEqual(residue, []);
});

test("the check finds what a plugin leaves behind when it goes around ctx", { timeout: 30_000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), "builtins-off-leaky-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const builtins = join(root, "builtins");
  const dir = join(root, "data");
  mkdirSync(join(builtins, "leaky", "host"), { recursive: true });
  mkdirSync(join(builtins, "tidy", "host"), { recursive: true });
  mkdirSync(dir);
  writeFileSync(join(builtins, "builtins.json"), JSON.stringify({ format: 1, plugins: [{ id: "leaky", root: "leaky", host: "host/index.mjs" }, { id: "tidy", root: "tidy", host: "host/index.mjs" }] }));
  writeFileSync(join(builtins, "leaky", "host", "index.mjs"), 'export const name = "leaky";\nexport function apply() {\n  (globalThis.leakyTimers ??= []).push(setInterval(() => {}, 60_000));\n}\n');
  writeFileSync(join(builtins, "tidy", "host", "index.mjs"), 'export const name = "tidy";\nexport function apply(ctx) {\n  ctx.setInterval(() => {}, 60_000);\n}\n');
  cleanup.push(() => (globalThis.leakyTimers ?? []).forEach(clearInterval));
  const host = await hostOn(builtins, dir);
  assert.deepEqual(await residueAfterOff(host, dir, "tidy"), []);
  const leaky = await residueAfterOff(host, dir, "leaky");
  assert.equal(leaky.length, 1, leaky.join("\n"));
  assert.match(leaky[0], /^leaky left 1 Timeout behind/);
});
