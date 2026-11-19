import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { ISLAND_REQUEST_EVENT, startHost } from "@fuyu/plugin-base/host";
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

async function open(pluginsYml = "[]\n") {
  const dir = mkdtempSync(join(tmpdir(), "messages-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), pluginsYml);
  const rust = fakeRust();
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let messages;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (messages = ctx.services.get(messagesV1)) });
  return { host, messages };
}

async function waitFor(check) {
  for (let tries = 0; tries < 100 && !check(); tries += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(check());
}

const ALL_BUILTIN_IDS = [
  "qq",
  "wechat",
  "qqMail",
  "telegram",
  "discord",
  "whatsapp",
  "tim",
  "feishu",
  "dingtalk",
  "wecom",
];

test("the messages plugin provides messages/v1 with 10 built-in sources and keeps the 7 new IM sources off by default", async () => {
  const { host, messages } = await open();
  assert.equal(host.status().find((plugin) => plugin.id === "messages").state, "running");
  const { sources } = await messages.sources();
  assert.deepEqual(
    sources.map((item) => ({ id: item.id, builtin: item.builtin, enabled: item.enabled, unreadCount: item.unreadCount })),
    [
      { id: "qq", builtin: true, enabled: true, unreadCount: 0 },
      { id: "wechat", builtin: true, enabled: true, unreadCount: 0 },
      { id: "qqMail", builtin: true, enabled: true, unreadCount: 0 },
      { id: "telegram", builtin: true, enabled: false, unreadCount: 0 },
      { id: "discord", builtin: true, enabled: false, unreadCount: 0 },
      { id: "whatsapp", builtin: true, enabled: false, unreadCount: 0 },
      { id: "tim", builtin: true, enabled: false, unreadCount: 0 },
      { id: "feishu", builtin: true, enabled: false, unreadCount: 0 },
      { id: "dingtalk", builtin: true, enabled: false, unreadCount: 0 },
      { id: "wecom", builtin: true, enabled: false, unreadCount: 0 },
    ],
  );
  await assert.rejects(messages.notify({ source: "", title: "t", body: "b" }), { code: "bad-params" });
  await assert.rejects(messages.notify({ source: "qq", title: "", body: "b" }), { code: "bad-params" });
  await assert.rejects(messages.clear({ source: "" }), { code: "bad-params" });
});

test("messages.config in plugins.yml flips configured built-in IM sources on", async () => {
  const { messages } = await open("- id: messages\n  config:\n    telegram: true\n    feishu: true\n    qq: false\n");
  const byId = Object.fromEntries((await messages.sources()).sources.map((item) => [item.id, item.enabled]));
  assert.equal(byId.telegram, true);
  assert.equal(byId.feishu, true);
  assert.equal(byId.qq, false);
  assert.equal(byId.discord, false);
});

test("plugins can register new message sources, replace built-in sources by id, push arrival notices and clean up on stop", async () => {
  const { host, messages } = await open();
  const arrived = [];
  const changed = [];
  cleanup.push(messages.on("arrived", (notice) => arrived.push(notice)));
  cleanup.push(messages.on("changed", () => changed.push("changed")));

  let clearedMatrix = 0;
  const sub = await host.ctx.plugin({
    name: "matrix-and-jmap",
    inject: ["messages.sources"],
    apply(ctx) {
      ctx.messageSources.register({
        id: "matrix",
        label: { zh: "Matrix", en: "Matrix" },
        order: 110,
        clear: () => {
          clearedMatrix += 1;
        },
      });
      ctx.messageSources.register({
        id: "feishu",
        pluginId: "feishu-bot",
        label: { zh: "飞书机器人", en: "Feishu Bot" },
        status: () => ({ enabled: true, unreadCount: 2, pending: true }),
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
    [...ALL_BUILTIN_IDS, "matrix"],
  );
  const replacedMail = afterRegister.find((item) => item.id === "qqMail");
  assert.equal(replacedMail.builtin, true);
  assert.equal(replacedMail.replacedBy, "jmap-mail");
  assert.equal(replacedMail.unreadCount, 4);

  const replacedFeishu = afterRegister.find((item) => item.id === "feishu");
  assert.equal(replacedFeishu.builtin, true);
  assert.equal(replacedFeishu.replacedBy, "feishu-bot");
  assert.equal(replacedFeishu.enabled, true);

  const sent = await messages.notify({
    source: "matrix",
    title: "张工",
    body: "部署已完成",
    receivedAt: 1700000000000,
    actions: ["查看"],
  });
  assert.deepEqual(sent, { shown: false, receivedAt: 1700000000000 });
  assert.equal(arrived.length, 1);
  assert.equal(arrived[0].source, "matrix");
  assert.equal(arrived[0].title, "张工");
  assert.equal((await messages.sources()).sources.find((item) => item.id === "matrix").unreadCount, 1);

  await messages.clear({ source: "matrix" });
  assert.equal(clearedMatrix, 1);
  assert.equal((await messages.sources()).sources.find((item) => item.id === "matrix").unreadCount, 0);

  await sub.dispose();
  const afterDispose = (await messages.sources()).sources;
  assert.deepEqual(
    afterDispose.map((item) => item.id),
    ALL_BUILTIN_IDS,
  );
  assert.equal(afterDispose.find((item) => item.id === "qqMail").replacedBy, undefined);
  assert.equal(afterDispose.find((item) => item.id === "feishu").enabled, false);
});

test("a host plugin's notice is shown by the island window once and returns the island's own shown", async () => {
  const { host, messages } = await open();
  const arrived = [];
  const actions = [];
  cleanup.push(messages.on("arrived", (notice) => arrived.push(notice)));
  cleanup.push(messages.on("action", (data) => actions.push(data)));
  host.islandControl.noticeTimeoutMs = 20;
  const published = [];
  const detach = host.islandControl.attachWindows({ connected: () => ["island"], publish: (name, data) => published.push({ name, data }) });
  const notice = { source: "alarm", pluginId: "@fuyu/alarm", title: "起床", body: "7:00", receivedAt: 1700000000000, actions: ["snooze"] };

  const shown = messages.notify(notice);
  await waitFor(() => published.length === 1);
  assert.equal(published[0].name, ISLAND_REQUEST_EVENT);
  assert.equal(published[0].data.action, "notify");
  assert.equal(published[0].data.plugin, "@fuyu/alarm");
  assert.deepEqual({ title: published[0].data.notice.title, body: published[0].data.notice.body, actions: published[0].data.notice.actions }, { title: "起床", body: "7:00", actions: ["snooze"] });
  host.islandControl.settle({ id: published[0].data.id, value: true }, "island");
  assert.deepEqual(await shown, { shown: true, receivedAt: 1700000000000 });
  assert.equal(published.length, 1);
  assert.equal(arrived.length, 1);

  const expanded = messages.notify(notice);
  await waitFor(() => published.length === 2);
  host.islandControl.settle({ id: published[1].data.id, value: false }, "island");
  assert.equal((await expanded).shown, false);

  assert.equal((await messages.notify(notice)).shown, false);

  host.islandControl.noticeAction({ pluginId: "@fuyu/alarm", action: "snooze" }, "island");
  assert.deepEqual(actions, [{ pluginId: "@fuyu/alarm", source: "@fuyu/alarm", action: "snooze" }]);

  const leaving = messages.notify(notice);
  await waitFor(() => published.length === 4);
  detach();
  assert.equal((await leaving).shown, false);
  assert.equal((await messages.notify(notice)).shown, false);
  assert.equal(published.length, 4);
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
    order: 120,
  });
  notifyMessageArrival({ source: "slack", title: "Alice", body: "Ping" });
  assert.equal(getMessageSources().sources.find((item) => item.id === "slack").unreadCount, 1);
  await clearMessageSources({ source: "slack" });
  assert.equal(getMessageSources().sources.find((item) => item.id === "slack").unreadCount, 0);
  off();
  assert.equal(getMessageSources().sources.some((item) => item.id === "slack"), false);
});
