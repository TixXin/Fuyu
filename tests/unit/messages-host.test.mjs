import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { messagesV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import {
  clearMessageSources,
  clearParamsOf,
  getMessageSources,
  normalizeArrivalNotice,
  notifyMessageArrival,
  registerMessageSource,
  resetMessageSourcesForTest,
} from "../../src/features/messages/host/sources.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods = {}) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message } });
    }
  });
  return { rpc: connect({ input: toHost, write: (text) => fromHost.write(text) }) };
}

async function open() {
  const dir = mkdtempSync(join(tmpdir(), "messages-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust();
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let messages;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (messages = ctx.services.get(messagesV1)) });
  return { host, messages };
}

test("the messages plugin provides messages/v1 with built-in qq, wechat and qqMail sources", async () => {
  const { host, messages } = await open();
  assert.equal(host.status().find((plugin) => plugin.id === "messages").state, "running");
  const { sources } = await messages.sources();
  assert.deepEqual(
    sources.map((item) => ({ id: item.id, builtin: item.builtin, unreadCount: item.unreadCount })),
    [
      { id: "qq", builtin: true, unreadCount: 0 },
      { id: "wechat", builtin: true, unreadCount: 0 },
      { id: "qqMail", builtin: true, unreadCount: 0 },
    ],
  );
  await assert.rejects(messages.notify({ source: "", title: "t", body: "b" }), { code: "bad-params" });
  await assert.rejects(messages.notify({ source: "qq", title: "", body: "b" }), { code: "bad-params" });
  await assert.rejects(messages.clear({ source: "" }), { code: "bad-params" });
});

test("plugins can register new message sources, replace built-in sources by id, push arrival notices and clean up on stop", async () => {
  const { host, messages } = await open();
  const arrived = [];
  const changed = [];
  cleanup.push(messages.on("arrived", (notice) => arrived.push(notice)));
  cleanup.push(messages.on("changed", () => changed.push("changed")));

  let clearedFeishu = 0;
  const sub = await host.ctx.plugin({
    name: "feishu-and-jmap",
    inject: ["messages.sources"],
    apply(ctx) {
      ctx.messageSources.register({
        id: "feishu",
        label: { zh: "飞书", en: "Feishu" },
        order: 40,
        clear: () => {
          clearedFeishu += 1;
        },
      });
      ctx.messageSources.register({
        id: "qqMail",
        pluginId: "jmap-mail",
        label: { zh: "JMAP 邮箱", en: "JMAP Mail" },
        status: () => ({ unreadCount: 4, pending: true }),
      });
    },
  });
  assert.ok(changed.length >= 1);

  const afterRegister = (await messages.sources()).sources;
  assert.deepEqual(
    afterRegister.map((item) => item.id),
    ["qq", "wechat", "qqMail", "feishu"],
  );
  const replacedMail = afterRegister.find((item) => item.id === "qqMail");
  assert.equal(replacedMail.builtin, true);
  assert.equal(replacedMail.replacedBy, "jmap-mail");
  assert.equal(replacedMail.unreadCount, 4);

  const sent = await messages.notify({
    source: "feishu",
    title: "张工",
    body: "部署已完成",
    receivedAt: 1700000000000,
    actions: ["查看"],
  });
  assert.deepEqual(sent, { shown: true, receivedAt: 1700000000000 });
  assert.equal(arrived.length, 1);
  assert.equal(arrived[0].source, "feishu");
  assert.equal(arrived[0].title, "张工");
  assert.equal((await messages.sources()).sources.find((item) => item.id === "feishu").unreadCount, 1);

  await messages.clear({ source: "feishu" });
  assert.equal(clearedFeishu, 1);
  assert.equal((await messages.sources()).sources.find((item) => item.id === "feishu").unreadCount, 0);

  await sub.dispose();
  const afterDispose = (await messages.sources()).sources;
  assert.deepEqual(
    afterDispose.map((item) => item.id),
    ["qq", "wechat", "qqMail"],
  );
  assert.equal(afterDispose.find((item) => item.id === "qqMail").replacedBy, undefined);
});

test("window message source helpers validate notices and restore built-in sources", async () => {
  resetMessageSourcesForTest();
  assert.equal(normalizeArrivalNotice({ source: "qq", title: "Hi", body: "There" }, 123).receivedAt, 123);
  assert.throws(() => normalizeArrivalNotice({ source: "qq", title: "Hi", body: "There", extra: 1 }), { code: "bad-params" });
  assert.deepEqual(clearParamsOf(undefined), { source: undefined });
  assert.deepEqual(clearParamsOf({ source: "qq" }), { source: "qq" });

  const off = registerMessageSource({
    id: "slack",
    label: "Slack",
    order: 50,
  });
  notifyMessageArrival({ source: "slack", title: "Alice", body: "Ping" });
  assert.equal(getMessageSources().sources.find((item) => item.id === "slack").unreadCount, 1);
  await clearMessageSources({ source: "slack" });
  assert.equal(getMessageSources().sources.find((item) => item.id === "slack").unreadCount, 0);
  off();
  assert.equal(getMessageSources().sources.some((item) => item.id === "slack"), false);
});
