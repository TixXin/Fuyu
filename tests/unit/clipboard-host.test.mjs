import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { clipboardV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { MAX_LIMIT, fromRust, limitOf, serviceTexts } from "../../src/features/clipboard/host/index.mjs";

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
  const dir = mkdtempSync(join(tmpdir(), "clipboard-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let clipboard;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (clipboard = ctx.services.get(clipboardV1)) });
  return { host, rust, clipboard };
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

const NOTE = { id: "c-1", text: "meeting at 3", truncated: false, copiedAt: 10, favorite: true };

test("the clipboard plugin provides clipboard/v1 and reads the history through Rust", async () => {
  const { host, rust, clipboard } = await open({
    "clipboard.history": ({ limit }) => ({ items: limit === 1 ? [NOTE] : [NOTE, { ...NOTE, id: "c-2", favorite: false }] }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "clipboard").state, "running");
  assert.deepEqual(await clipboard.history({ limit: 1 }), { items: [NOTE] });
  assert.equal((await clipboard.history({})).items.length, 2);
  assert.deepEqual(rust.asked("clipboard.history"), [{ limit: 1 }, { limit: null }]);
  await assert.rejects(clipboard.history({ limit: 0 }), { code: "bad-params" });
  await assert.rejects(clipboard.history({ limit: MAX_LIMIT + 1 }), { code: "bad-params" });
  await assert.rejects(clipboard.history({ limit: 2, images: true }), { code: "bad-params" });
  assert.equal(rust.asked("clipboard.history").length, 2);
});

test("a switched-off clipboard in Rust is peer-gone, and a stopped clipboard plugin is not-ready", async () => {
  const { host, clipboard } = await open({
    "clipboard.history": () => {
      throw Object.assign(new Error("The clipboard plugin is switched off."), { code: "inactive" });
    },
  });
  await assert.rejects(clipboard.history({}), (error) => error.code === "peer-gone" && error.data.reason === "inactive");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "clipboard").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "clipboard/v1")));
  await assert.rejects(clipboard.history({}), { code: "not-ready" });
});

test("the window's answer and the host's answer turn into the same shape", () => {
  assert.deepEqual(serviceTexts({ items: [{ ...NOTE, extra: true }, { text: "no id" }] }), { items: [NOTE] });
  assert.deepEqual(serviceTexts(null), { items: [] });
  assert.equal(limitOf({}), undefined);
  assert.equal(limitOf(null), undefined);
  assert.equal(limitOf({ limit: 5 }), 5);
  assert.throws(() => limitOf({ limit: 1.5 }), { code: "bad-params" });
  assert.throws(() => limitOf({ limit: "5" }), { code: "bad-params" });
  assert.equal(fromRust({ code: "bad-params", message: "no" }).code, "bad-params");
  assert.equal(fromRust("plain").data.reason, "failed");
});
