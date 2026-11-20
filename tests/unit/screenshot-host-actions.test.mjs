import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { screenshotActionsV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { createScreenshotActionRegistry } from "../../src/features/screenshot/host/actions.mjs";
import { imageLine, todoTitle } from "../../src/features/todos/host/screenshotActions.mjs";
import { noteImagePaths } from "../../src/features/todos/noteImages.ts";

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
    write({ id: message.id, result: await method(message.params) });
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

test("actions say whether they keep the picture, and run with the source and the locale", async () => {
  const registry = createScreenshotActionRegistry();
  let seen;
  registry.register({
    id: "keeper",
    keeps: true,
    icon: "notebook",
    label: { "zh-CN": "留着", en: "Keep" },
    run: (context) => {
      seen = context;
      return { dismiss: true };
    },
  });
  registry.register({ id: "plain", label: { "zh-CN": "普通", en: "Plain" }, run: () => ({}) });
  assert.deepEqual(
    registry.list().map((item) => [item.id, item.keeps, item.icon]),
    [
      ["keeper", true, "notebook"],
      ["plain", false, "sparkles"],
    ],
  );
  await registry.run("keeper", { path: "/k/a.png", source: { app: "Safari", title: "Docs", url: "https://a.example", extra: 1 }, locale: "en" });
  assert.deepEqual(seen.source, { app: "Safari", title: "Docs", url: "https://a.example" });
  assert.equal(seen.locale, "en");
  await registry.run("keeper", { path: "/k/a.png", source: { title: "no app" }, locale: "fr" });
  assert.equal(seen.source, null);
  assert.equal(seen.locale, "zh-CN");
});

test("screenshot.actions/v1 lists what host plugins registered, runs them and says when the list changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "screenshot-host-actions-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust({
    "todos.setNote": ({ append }) => ({ date: "2026-11-20", note: append }),
    "todos.add": ({ title, note }) => ({ id: "t-1", title, note, completed: false, createdAt: 1 }),
  });
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let service;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (service = ctx.services.get(screenshotActionsV1)) });

  const { actions } = await service.list({});
  assert.deepEqual(
    actions.map((item) => [item.id, item.keeps, item.icon]),
    [
      ["todos.note", true, "notebook"],
      ["todos.todo", true, "list-todo"],
    ],
  );

  const source = { app: "Safari", title: "Fuyu docs", url: null };
  assert.deepEqual(await service.run({ id: "todos.note", context: { path: "/kept/a.png", saved: true, locale: "zh-CN" } }), { message: "已放进今日笔记", dismiss: true });
  assert.deepEqual(rust.asked("todos.setNote"), [{ append: "![截图](</kept/a.png>)" }]);
  assert.deepEqual(await service.run({ id: "todos.todo", context: { path: "/kept/b.png", saved: true, source, locale: "en" } }), { message: "Todo added", dismiss: true });
  assert.deepEqual(rust.asked("todos.add"), [{ title: "Screenshot: Fuyu docs", note: "![Screenshot](</kept/b.png>)" }]);

  let changed;
  const off = service.on("changed", (event) => {
    changed = event.actions.map((item) => item.id);
  });
  const fiber = await host.ctx.plugin({
    name: "uploader",
    inject: ["screenshot.actions"],
    apply: (ctx) => void ctx.screenshotActions.register({ id: "upload", order: 5, label: { "zh-CN": "上传", en: "Upload" }, run: () => ({}) }),
  });
  const deadline = Date.now() + 2000;
  while (!changed && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(changed, ["upload", "todos.note", "todos.todo"]);
  await fiber.dispose();
  await off?.();
  await assert.rejects(service.run({ id: "upload", context: { path: "/a.png" } }));
});

test("the todo actions write a markdown picture line and name the todo after where the shot came from", () => {
  assert.equal(imageLine("/a/<b>.png", "en"), "![Screenshot](</a/b.png>)");
  assert.equal(todoTitle({ source: { app: "Code", title: null }, locale: "zh-CN" }), "截图: Code");
  assert.equal(todoTitle({ source: null, locale: "en" }, new Date(2026, 10, 20, 9, 5)), "Screenshot 09:05");
});

test("note pictures are the markdown picture lines that point at png files, each once", () => {
  const note = "今天\n![截图](</kept/a.png>)\n![x](</kept/b.PNG>) ![截图](</kept/a.png>)\n![no](</kept/c.jpg>) ![bare](/kept/d.png)";
  assert.deepEqual(noteImagePaths(note), ["/kept/a.png", "/kept/b.PNG"]);
  assert.deepEqual(noteImagePaths(""), []);
  assert.deepEqual(noteImagePaths(null), []);
});
