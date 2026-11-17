import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import {
  agentsV1,
  calendarV1,
  clipboardV1,
  lyricsV1,
  mediaV1,
  messagesV1,
  translatorV1,
} from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods) {
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

test("all 7 Phase 4 seams support extending built-in implementations and clean up on plugin stop", async () => {
  const dir = mkdtempSync(join(tmpdir(), "phase4-seams-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");

  const rust = fakeRust({
    "translator.engines": () => ({ engines: [{ engine: "deepseek", hasSecret: true }] }),
    "translator.translate": ({ text }) => ({ translatedText: `builtin:${text}`, detectedSourceLanguage: "en", engine: "deepseek", model: "deepseek-chat" }),
    "lyrics.lookup": () => null,
    "calendar.events": () => ({ events: [], problems: [], fetchedAt: 1, fromMs: 0, toMs: 1000, sourceCount: 0 }),
    "calendar.sources": () => ({ sources: [] }),
    "agents.sessions": () => ({ sessions: [], others: [] }),
    "agents.usage": () => ({ claude: null, codex: null }),
    "agents.focus": () => ({ found: false }),
    "clipboard.history": () => ({ items: [] }),
    "clipboard.copyText": () => ({}),
    "clipboard.pasteText": () => ({}),
  });

  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();

  let translator;
  let lyrics;
  let calendar;
  let agents;
  let clipboard;
  let messages;
  await host.ctx.plugin({
    name: "consumer",
    apply(ctx) {
      translator = ctx.services.get(translatorV1);
      lyrics = ctx.services.get(lyricsV1);
      calendar = ctx.services.get(calendarV1);
      agents = ctx.services.get(agentsV1);
      clipboard = ctx.services.get(clipboardV1);
      messages = ctx.services.get(messagesV1);
    },
  });

  let clipboardRan = null;
  let screenshotRan = null;
  let clipboardActions;
  let screenshotActions;

  const ext = await host.ctx.plugin({
    name: "all-seven-seams-plugin",
    inject: [
      "translator.engines",
      "lyrics.sources",
      "calendar.sources",
      "agents.sources",
      "clipboard.actions",
      "screenshot.actions",
      "messages.sources",
    ],
    apply(ctx) {
      ctx.translatorEngines.register({
        engine: "local-llm",
        label: { "zh-CN": "本地模型", en: "Local LLM" },
        defaultModel: "qwen2.5",
        hasSecret: () => true,
        translate: async ({ text }) => ({
          text: `local-llm:${text}`,
          model: "qwen2.5",
        }),
      });

      ctx.lyricsSources.register({
        id: "netease-vip",
        label: "NetEase VIP",
        order: 5,
        lookup: async ({ title }) => ({
          source: "netease-vip",
          lrc: `[00:00.00]${title}`,
        }),
      });

      ctx.calendarSources.register({
        id: "dingtalk",
        name: "钉钉日历",
        host: "dingtalk.com",
        events: async () => [
          { uid: "dt-1", title: "周会", startMs: 100, endMs: 200, allDay: false, location: "A1", meetingLink: null },
        ],
      });

      ctx.agentSources.register({
        provider: "aider",
        sessions: async () => [
          {
            sessionId: "s-1",
            title: "Refactor",
            cwd: "/repo",
            phase: "working",
            light: "working",
            updatedAt: 50,
          },
        ],
        focus: async () => ({ found: true }),
        usage: async () => ({ updatedAt: 10, fiveHour: null, sevenDay: null, models: [], plan: "pro", source: "aider", error: null }),
      });

      clipboardActions = ctx.clipboardActions;
      ctx.clipboardActions.register({
        id: "reverse-text",
        label: { zh: "反转文本", en: "Reverse Text" },
        match: (item) => item.kind === "text",
        run: ({ item }) => {
          clipboardRan = item.text.split("").reverse().join("");
        },
      });

      screenshotActions = ctx.screenshotActions;
      ctx.screenshotActions.register({
        id: "ocr-archive",
        label: { "zh-CN": "归档截图", en: "Archive Screenshot" },
        order: 20,
        run: ({ path }) => {
          screenshotRan = path;
        },
      });

      ctx.messageSources.register({
        id: "matrix",
        label: { zh: "Matrix", en: "Matrix" },
        order: 60,
      });
    },
  });

  const engines = (await translator.engines()).engines;
  assert.ok(engines.some((item) => item.engine === "local-llm"));
  const translated = await translator.translate({ text: "hello", targetLang: "zh-CN", engine: { engine: "local-llm", model: "qwen2.5" } });
  assert.equal(translated.text, "local-llm:hello");

  const lrc = await lyrics.lookup({ title: "My Track" });
  assert.deepEqual(lrc, { source: "netease-vip", lrc: "[00:00.00]My Track" });

  const calEvents = await calendar.events({});
  assert.equal(calEvents.events.length, 1);
  assert.equal(calEvents.events[0].title, "周会");

  const agentSessions = await agents.sessions();
  assert.equal(agentSessions.sessions.length, 1);
  assert.equal(agentSessions.sessions[0].provider, "aider");
  assert.deepEqual(await agents.focus({ provider: "aider" }), { found: true });
  assert.equal((await agents.usage()).extra?.aider?.plan, "pro");

  assert.deepEqual(await clipboard.copyText({ text: "abc" }), { ok: true });
  await clipboardActions.run("reverse-text", {
    item: { id: "1", kind: "text", text: "abc", preview: "abc", hash: "h", createdAt: 1, copiedAt: 1 },
    locale: "zh",
  });
  assert.equal(clipboardRan, "cba");

  assert.equal(screenshotActions.list().length, 1);
  await screenshotActions.run("ocr-archive", { path: "/tmp/shot.png", width: 100, height: 100, locale: "zh" });
  assert.equal(screenshotRan, "/tmp/shot.png");

  await messages.notify({ source: "matrix", title: "Bot", body: "Ready" });
  const msgSources = (await messages.sources()).sources;
  assert.equal(msgSources.find((item) => item.id === "matrix")?.unreadCount, 1);

  await ext.dispose();

  assert.ok(!(await translator.engines()).engines.some((item) => item.engine === "local-llm"));
  assert.equal(await lyrics.lookup({ title: "My Track" }), null);
  assert.equal((await calendar.events({})).events.length, 0);
  assert.equal((await agents.sessions()).sessions.length, 0);
  assert.equal(clipboardActions.list().length, 0);
  assert.equal(screenshotActions.list().length, 0);
  assert.ok(!(await messages.sources()).sources.some((item) => item.id === "matrix"));
});

test("any of the 6 service-backed seams can be replaced as a whole service and restored when the replacement stops", async () => {
  const dir = mkdtempSync(join(tmpdir(), "phase4-replace-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, "plugins.yml"),
    [
      "- id: translation",
      "  disabledServices: [translator/v1]",
      "- id: music",
      "  disabledServices: [lyrics/v1]",
      "- id: calendar",
      "  disabledServices: [calendar/v1]",
      "- id: agents",
      "  disabledServices: [agents/v1]",
      "- id: clipboard",
      "  disabledServices: [clipboard/v1]",
      "- id: messages",
      "  disabledServices: [messages/v1]",
      "",
    ].join("\n"),
  );

  const rust = fakeRust({
    "media.nowPlaying": () => ({
      available: true,
      playing: true,
      audible: true,
      title: "Still Playing",
      artist: null,
      album: null,
      sourceApp: null,
      positionMs: 0,
      durationMs: 100,
      canSeek: false,
      canNext: false,
      canPrevious: false,
      updatedAt: 1,
    }),
  });
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();

  const rep = await host.ctx.plugin({
    name: "custom-suite",
    apply(ctx) {
      ctx.services.provide(translatorV1, {
        translate: () => ({ translatedText: "rep", detectedSourceLanguage: "en", engine: "custom", model: "m" }),
        rewrite: () => ({ text: "rep", engine: "custom", model: "m" }),
        engines: () => ({ engines: [] }),
      });
      ctx.services.provide(lyricsV1, {
        lookup: () => ({ source: "rep", lrc: "[00:00.00]rep" }),
        sources: () => ({ sources: [] }),
      });
      ctx.services.provide(calendarV1, {
        events: () => ({ events: [], problems: [], fetchedAt: 777, fromMs: 0, toMs: 1, sourceCount: 0 }),
        sources: () => ({ sources: [] }),
      });
      ctx.services.provide(agentsV1, {
        sessions: () => ({ sessions: [], others: [{ id: "rep", name: "Rep", phase: "working", updatedAt: 1 }] }),
        usage: () => ({ claude: null, codex: null }),
        focus: () => ({ found: true }),
        remoteHosts: () => ({ hosts: [] }),
      });
      ctx.services.provide(clipboardV1, {
        history: () => ({ items: [{ id: "r", text: "rep", truncated: false, copiedAt: 1, favorite: false }] }),
        copyText: () => ({ ok: true }),
        pasteText: () => ({ ok: true }),
      });
      ctx.services.provide(messagesV1, {
        sources: () => ({ sources: [{ id: "rep", label: "Rep", builtin: false, enabled: true, unreadCount: 9, pending: true, order: 1 }] }),
        notify: () => ({ shown: true, receivedAt: 1 }),
        clear: () => ({ ok: true }),
      });
    },
  });

  let media;
  let translator;
  let lyrics;
  let calendar;
  let agents;
  let clipboard;
  let messages;
  await host.ctx.plugin({
    name: "verifier",
    apply(ctx) {
      media = ctx.services.get(mediaV1);
      translator = ctx.services.get(translatorV1);
      lyrics = ctx.services.get(lyricsV1);
      calendar = ctx.services.get(calendarV1);
      agents = ctx.services.get(agentsV1);
      clipboard = ctx.services.get(clipboardV1);
      messages = ctx.services.get(messagesV1);
    },
  });

  assert.equal((await media.nowPlaying()).title, "Still Playing");
  assert.equal((await translator.translate({ text: "x", targetLang: "zh-CN" })).translatedText, "rep");
  assert.equal((await lyrics.lookup({ title: "x" }))?.source, "rep");
  assert.equal((await calendar.events({})).fetchedAt, 777);
  assert.equal((await agents.sessions()).others[0].id, "rep");
  assert.equal((await clipboard.history({})).items[0].text, "rep");
  assert.equal((await messages.sources()).sources[0].unreadCount, 9);

  await rep.dispose();
});
