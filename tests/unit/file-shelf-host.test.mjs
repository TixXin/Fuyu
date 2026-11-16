import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { fileShelfV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { MAX_PATHS, fromRust, pathsOf, serviceItems } from "../../src/features/file-shelf/host/index.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

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
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

async function open(methods) {
  const dir = mkdtempSync(join(tmpdir(), "file-shelf-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let shelf;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (shelf = ctx.services.get(fileShelfV1)) });
  return { host, rust, shelf };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}

const SHOT = { id: "a-1", path: "/Users/me/Pictures/shot.png", name: "shot.png", isDir: false, size: 2048, addedAt: 10, pinned: false, missing: false, unreachable: false };

test("the file-shelf plugin provides file-shelf/v1 and adds paths through Rust", async () => {
  const { host, rust, shelf } = await open({
    "fileShelf.add": ({ paths }) => ({ items: paths.map((path, index) => ({ ...SHOT, id: `n-${index}`, path })) }),
    "fileShelf.list": () => ({ items: [SHOT] }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "file-shelf").state, "running");
  assert.deepEqual(await shelf.add({ paths: [SHOT.path] }), { items: [{ ...SHOT, id: "n-0" }] });
  assert.deepEqual(rust.asked("fileShelf.add"), [{ paths: [SHOT.path] }]);
  assert.deepEqual(await shelf.list(), { items: [SHOT] });
  assert.deepEqual(rust.asked("fileShelf.list"), [null]);
  await assert.rejects(shelf.add({ paths: [] }), { code: "bad-params" });
  await assert.rejects(shelf.add({ paths: ["/a"], move: true }), { code: "bad-params" });
  await assert.rejects(shelf.add({ paths: Array.from({ length: MAX_PATHS + 1 }, (_, n) => `/f${n}`) }), { code: "bad-params" });
  assert.equal(rust.asked("fileShelf.add").length, 1);
});

test("a Rust failure keeps its reason, and a stopped file shelf is not-ready", async () => {
  const { host, shelf } = await open({
    "fileShelf.list": () => {
      throw Object.assign(new Error("The file shelf is not initialized."), { code: "failed" });
    },
  });
  await assert.rejects(shelf.list(), (error) => error.code === "failed" && error.data.reason === "failed");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "file-shelf").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "file-shelf/v1")));
  await assert.rejects(shelf.list(), { code: "not-ready" });
});

test("the window's snapshot and the host's answer turn into the same shape", () => {
  assert.deepEqual(serviceItems({ items: [{ ...SHOT, extra: true }, { name: "no id" }] }), { items: [SHOT] });
  assert.deepEqual(serviceItems(null), { items: [] });
  assert.deepEqual(pathsOf({ paths: ["/a", "/b"] }), ["/a", "/b"]);
  assert.throws(() => pathsOf(undefined), { code: "bad-params" });
  assert.throws(() => pathsOf({ paths: [""] }), { code: "bad-params" });
  assert.equal(fromRust({ code: "timeout", message: "late" }).code, "timeout");
  assert.equal(fromRust({ code: "inactive", message: "gone" }).code, "peer-gone");
  assert.equal(fromRust("plain").data.reason, "failed");
});
