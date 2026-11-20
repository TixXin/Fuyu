import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { secretsV1 } from "@fuyu/plugin-services";
import { registerDevEntry } from "../../packages/plugin-cli/src/dev.mjs";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { createMarketService } from "../../src/features/updater/host/market.mjs";

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust() {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const vault = new Map();
  const seen = [];
  const names = (plugin) => [...vault.keys()].filter((key) => key.startsWith(`${plugin}\n`)).map((key) => key.split("\n")[1]).sort();
  const methods = {
    "pluginKernel.secretList": ({ plugin }) => ({ names: names(plugin) }),
    "pluginKernel.secretGet": ({ plugin, name }) => ({ value: vault.get(`${plugin}\n${name}`) ?? null }),
    "pluginKernel.secretSet": ({ plugin, name, value }) => {
      if (names(plugin).length >= 2 && !vault.has(`${plugin}\n${name}`)) throw Object.assign(new Error("pluginKernel.secretSet: a plugin keeps at most 2 secrets"), { code: "too-many" });
      vault.set(`${plugin}\n${name}`, value);
      return { names: names(plugin) };
    },
    "pluginKernel.secretRemove": ({ plugin, name }) => {
      vault.delete(`${plugin}\n${name}`);
      return { names: names(plugin) };
    },
  };
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    seen.push(message);
    if (message.id === undefined) return;
    try {
      write({ id: message.id, result: await methods[message.method](message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: () => seen.filter((message) => message.method?.startsWith("pluginKernel.secret")).map((message) => message.params) };
}

async function open() {
  const dir = mkdtempSync(join(tmpdir(), "plugin-secrets-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust();
  const host = await startHost({ dir, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  const clients = {};
  for (const name of ["alpha", "beta"]) {
    await host.ctx.plugin({ name, inject: ["secrets/v1"], apply: (ctx) => void (clients[name] = ctx.services.get(secretsV1)) });
  }
  return { host, rust, ...clients };
}

test("secrets/v1 keeps each plugin's secrets apart and sends Rust the caller's id, never one the plugin names", async () => {
  const { rust, alpha, beta } = await open();
  assert.deepEqual(await alpha.set({ name: "secret-key", value: "s3cr3t", plugin: "beta" }), { names: ["secret-key"] });
  assert.deepEqual(rust.asked()[0], { plugin: "alpha", name: "secret-key", value: "s3cr3t" });
  assert.deepEqual(await alpha.get({ name: "secret-key" }), { value: "s3cr3t" });
  assert.deepEqual(await beta.get({ name: "secret-key" }), { value: null });
  assert.deepEqual(await beta.list({}), { names: [] });
  assert.deepEqual(await alpha.set({ name: "access-key", value: "AKIA" }), { names: ["access-key", "secret-key"] });
  await assert.rejects(alpha.set({ name: "third", value: "x" }), { code: "too-many" });
  assert.deepEqual(await alpha.remove({ name: "access-key" }), { names: ["secret-key"] });
  assert.deepEqual(await alpha.list({}), { names: ["secret-key"] });
});

test("secrets/v1 refuses windows and bad parameters before reaching Rust", async () => {
  const { host, rust, alpha } = await open();
  for (const method of ["list", "get", "set", "remove"]) {
    await assert.rejects(host.serviceHub.callFromWindow({ service: "secrets/v1", method, params: { name: "secret-key", value: "v" } }, "island"), { code: "forbidden" }, method);
  }
  for (const params of [{}, { name: "" }, { name: 3 }, { name: "n" }, { name: "n", value: "" }, { name: "n", value: 5 }]) {
    await assert.rejects(alpha.set(params), { code: "bad-params" }, JSON.stringify(params));
  }
  await assert.rejects(alpha.get(null), { code: "bad-params" });
  assert.deepEqual(rust.asked(), []);
});

test("without Rust, secrets/v1 says it is not ready", async () => {
  const dir = mkdtempSync(join(tmpdir(), "plugin-secrets-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const host = await startHost({ dir });
  cleanup.push(() => host.stop());
  await host.settle();
  let client;
  await host.ctx.plugin({ name: "alpha", apply: (ctx) => void (client = ctx.services.get(secretsV1)) });
  await assert.rejects(client.list({}), { code: "not-ready" });
});

test("uninstalling a plugin with its data also forgets its secrets; keeping the data keeps them", async () => {
  const root = mkdtempSync(join(tmpdir(), "plugin-secrets-uninstall-"));
  cleanup.push(() => rmSync(root, { recursive: true, force: true }));
  const yml = join(root, "plugins.yml");
  writeFileSync(yml, "[]\n");
  for (const id of ["kept", "gone"]) {
    const folder = join(root, "work", id, "dist");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "host.js"), "export function apply() {}\n");
    registerDevEntry(yml, id, folder);
  }
  const forgotten = [];
  const market = createMarketService({ dataDir: join(root, "data", "updater"), pluginsDir: root, forgetSecrets: async (id) => void forgotten.push(id) });
  await market.uninstall({ id: "kept" });
  await market.uninstall({ id: "gone", removeData: true });
  assert.deepEqual(forgotten, ["gone"]);
  const failing = createMarketService({ dataDir: join(root, "data", "updater"), pluginsDir: root, forgetSecrets: async () => { throw new Error("locked"); } });
  registerDevEntry(yml, "again", join(root, "work", "gone", "dist"));
  assert.deepEqual(await failing.uninstall({ id: "again", removeData: true }), { id: "again", removed: true });
});
