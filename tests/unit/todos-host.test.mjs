import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { todosV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { fromAnswer, fromRust, paramsOf } from "../../src/features/todos/host/index.mjs";

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
  const dir = mkdtempSync(join(tmpdir(), "todos-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let todos;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (todos = ctx.services.get(todosV1)) });
  return { host, rust, todos };
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

const TODO = { id: "t-1", title: "写报告", completed: false, createdAt: 10 };

test("the todos plugin provides todos/v1 and reaches Rust for every method", async () => {
  const { host, rust, todos } = await open({
    "todos.list": () => ({ date: "2026-11-16", todos: [TODO], scheduled: [], activeTodoId: null }),
    "todos.days": ({ from, to }) => ({ days: [{ date: from, total: 1, completed: 0, hasNote: false, archived: false }, { date: to, total: 0, completed: 0, hasNote: false, archived: true }] }),
    "todos.add": ({ title, project }) => ({ ...TODO, title, ...(project ? { project } : {}) }),
    "todos.update": ({ id, completed }) => ({ ...TODO, id, completed }),
    "todos.remove": ({ id }) => ({ id }),
    "todos.note": () => ({ date: "2026-11-16", note: "今天" }),
    "todos.setNote": ({ append }) => ({ date: "2026-11-16", note: `今天\n${append}` }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "todos").state, "running");
  assert.deepEqual((await todos.list({})).todos, [TODO]);
  assert.equal((await todos.days({ from: "2026-11-01", to: "2026-11-16" })).days.length, 2);
  assert.deepEqual(await todos.add({ title: "新", project: "工作" }), { ...TODO, title: "新", project: "工作" });
  assert.equal((await todos.update({ id: "t-1", completed: true })).completed, true);
  assert.deepEqual(await todos.remove({ id: "t-1" }), { id: "t-1" });
  assert.equal((await todos.note({})).note, "今天");
  assert.equal((await todos.setNote({ append: "再写一行" })).note, "今天\n再写一行");
  assert.deepEqual(rust.asked("todos.add"), [{ title: "新", project: "工作" }]);
  assert.deepEqual(rust.asked("todos.list"), [{}]);
});

test("Rust's errors keep their codes, and a stopped todos plugin is not-ready", async () => {
  const { host, todos } = await open({
    "todos.add": () => {
      throw Object.assign(new Error("todos.add: \"title\" must be a non-empty string"), { code: "bad-params" });
    },
    "todos.remove": () => {
      throw Object.assign(new Error("todos.remove: Todo not found."), { code: "not-found" });
    },
    "todos.list": () => {
      throw Object.assign(new Error("todos.list: the todos are kept by the island window right now"), { code: "unavailable" });
    },
  });
  await assert.rejects(todos.add({ title: "" }), { code: "bad-params" });
  await assert.rejects(todos.remove({ id: "x" }), { code: "not-found" });
  await assert.rejects(todos.list({}), (error) => error.code === "unavailable" && error.data.reason === "unavailable");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "todos").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "todos/v1")));
  await assert.rejects(todos.list({}), { code: "not-ready" });
});

test("the window's answers turn into the same results and codes as the host's", async () => {
  assert.deepEqual(await fromAnswer("add", { ok: true, data: TODO }), TODO);
  await assert.rejects(fromAnswer("add", { ok: false, status: 400, error: "bad title" }), (error) => error.code === "bad-params" && error.message.includes("bad title") && error.data.error === "bad title" && error.data.status === 400);
  await assert.rejects(fromAnswer("remove", { ok: false, status: 404, error: "Todo not found." }), { code: "not-found" });
  await assert.rejects(fromAnswer("list", { ok: false, status: 503, error: "off" }), { code: "not-ready" });
  await assert.rejects(fromAnswer("list", undefined), { code: "failed" });
  assert.deepEqual(paramsOf(undefined), {});
  assert.deepEqual(paramsOf(["x"]), {});
  assert.equal(fromRust({ code: "inactive", message: "off" }).code, "peer-gone");
  assert.equal(fromRust({ code: "timeout", message: "late" }).code, "timeout");
  assert.equal(fromRust("plain").data.reason, "failed");
});
