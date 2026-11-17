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
import { MAX_LIMIT, copyParamsOf, fromRust, limitOf, pasteParamsOf, serviceTexts } from "../../src/features/clipboard/host/index.mjs";
import { clearClipboardActionsForTest, getClipboardActionsForItem, registerClipboardAction, resolveClipboardActionLabel } from "../../src/features/clipboard/host/actions.mjs";
import { filterActions, withPluginClipboardActions } from "../../src/features/clipboard/popupActions.ts";

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
  assert.deepEqual(copyParamsOf({ text: "hello" }), { text: "hello" });
  assert.throws(() => copyParamsOf({ text: "  " }), { code: "bad-params" });
  assert.throws(() => copyParamsOf({ text: "hi", extra: 1 }), { code: "bad-params" });
  assert.deepEqual(pasteParamsOf({ text: "hello" }), { text: "hello", enter: false });
  assert.deepEqual(pasteParamsOf({ text: "hello", enter: true }), { text: "hello", enter: true });
  assert.throws(() => pasteParamsOf({ text: "" }), { code: "bad-params" });
  assert.throws(() => pasteParamsOf({ text: "hi", enter: "yes" }), { code: "bad-params" });
  assert.equal(fromRust({ code: "bad-params", message: "no" }).code, "bad-params");
  assert.equal(fromRust("plain").data.reason, "failed");
});

test("clipboard/v1 supports copyText and pasteText, and plugins can register clipboard actions that clean up on stop", async () => {
  const { host, rust, clipboard } = await open({
    "clipboard.history": () => ({ items: [NOTE] }),
    "clipboard.copyText": () => ({}),
    "clipboard.pasteText": () => ({}),
  });
  assert.deepEqual(await clipboard.copyText({ text: "copied" }), { ok: true });
  assert.deepEqual(await clipboard.pasteText({ text: "pasted", enter: true }), { ok: true });
  assert.deepEqual(rust.asked("clipboard.copyText"), [{ text: "copied" }]);
  assert.deepEqual(rust.asked("clipboard.pasteText"), [{ text: "pasted", enter: true }]);

  let ranWith = null;
  let actionsApi;
  const sub = host.ctx.plugin({
    name: "url-opener",
    inject: ["clipboard.actions"],
    apply(ctx) {
      actionsApi = ctx.clipboardActions;
      ctx.clipboardActions.register({
        id: "uppercase-paste",
        label: { zh: "转为大写粘贴", en: "Paste Uppercase" },
        keywords: ["upper", "caps"],
        group: "paste",
        match: (item) => item.kind === "text" && !item.masked,
        run: (context) => {
          ranWith = context.item.text?.toUpperCase() ?? "";
        },
      });
    },
  });
  await host.settle();
  const matched = actionsApi.forItem({ id: "1", kind: "text", text: "abc", preview: "abc", hash: "h", createdAt: 1, copiedAt: 1 });
  assert.equal(matched.length, 1);
  assert.equal(resolveClipboardActionLabel(matched[0].label, "en"), "Paste Uppercase");
  assert.deepEqual(matched[0].keywords, ["upper", "caps"]);
  assert.equal(
    actionsApi.forItem({ id: "2", kind: "image", preview: "img", hash: "h2", createdAt: 1, copiedAt: 1 }).length,
    0,
  );
  await actionsApi.run("uppercase-paste", {
    item: { id: "1", kind: "text", text: "abc", preview: "abc", hash: "h", createdAt: 1, copiedAt: 1 },
    locale: "zh",
  });
  assert.equal(ranWith, "ABC");
  sub.dispose();
  await host.settle();
  assert.equal(actionsApi.list().length, 0);

  clearClipboardActionsForTest();
  let windowPasted = "";
  const off = registerClipboardAction({
    id: "window-action",
    label: { zh: "窗口动作", en: "Window Action" },
    keywords: ["slug", "kebab"],
    group: "paste",
    match: (item) => item.kind === "text",
    run: (context) => {
      windowPasted = `${context.item.text}-kebab`;
    },
  });
  const textEntry = { id: "1", kind: "text", text: "hi", preview: "hi", hash: "h", createdAt: 1, copiedAt: 1 };
  assert.equal(getClipboardActionsForItem(textEntry).length, 1);
  const merged = withPluginClipboardActions(
    [
      { id: "paste", group: "paste", label: "Paste", icon: "paste" },
      { id: "delete", group: "entry", label: "Delete", icon: "trash" },
    ],
    textEntry,
    "en",
  );
  assert.deepEqual(merged.map((action) => action.id), ["paste", "plugin:window-action", "delete"]);
  assert.deepEqual(filterActions(merged, "kebab").map((action) => action.id), ["plugin:window-action"]);
  merged[1].run();
  await sleep(5);
  assert.equal(windowPasted, "hi-kebab");
  off();
  assert.equal(getClipboardActionsForItem(textEntry).length, 0);
});
