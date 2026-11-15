import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { translatorV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { fromRust, serviceCode } from "../../src/features/translation/host/index.mjs";

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
      const result = await method(message.params, { progress: (data) => write({ method: "progress", params: { id: message.id, data } }) });
      if (result !== undefined) write({ id: message.id, result });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, seen, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

const rustError = (code, data) => Object.assign(new Error(`Rust failed with ${code}`), { code, data });

async function open(methods) {
  const dir = mkdtempSync(join(tmpdir(), "translation-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let translator;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (translator = ctx.services.get(translatorV1)) });
  return { host, rust, translator };
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

const hooks = (host, prefix) =>
  Object.entries(host.ctx.events._hooks)
    .filter(([name]) => name.startsWith(prefix))
    .reduce((total, [, list]) => total + list.length, 0);
const liveTimers = (host) => Object.values(host.timers()).reduce((total, count) => total + count, 0);

test("the translation plugin provides translator/v1 and hands the engine choice to Rust", async () => {
  const { host, rust, translator } = await open({
    "translator.translate": (params) => ({ text: "Hello", engine: params.provider ?? "deepseek", extra: "dropped" }),
  });
  const status = host.status().find((plugin) => plugin.id === "translation");
  assert.equal(status.state, "running");
  assert.equal(status.kind, "builtin");
  assert.ok(host.services().some((service) => service.name === "translator/v1"));
  assert.deepEqual(await translator.translate({ text: "你好", direction: "auto" }), { text: "Hello", engine: "deepseek" });
  assert.deepEqual(await translator.translate({ text: "你好", direction: "zh-en", engine: { engine: "openai", model: "gpt" } }), { text: "Hello", engine: "openai" });
  for (const engine of [{ engine: "custom", baseUrl: "http://127.0.0.1:8080" }, { engine: "deepseek", baseUrl: "http://127.0.0.1:8080" }, { engine: "openai", baseUrl: null }, { engine: "openai", model: "gpt", secret: "x" }]) {
    await assert.rejects(translator.translate({ text: "你好", direction: "zh-en", engine }), { code: "bad-params" });
  }
  assert.deepEqual(await host.serviceHub.windowCall("service.call", { service: "translator/v1", method: "translate", params: { text: "hi", direction: "en-zh" } }, "main"), {
    text: "Hello",
    engine: "deepseek",
  });
  assert.deepEqual(rust.asked("translator.translate"), [
    { text: "你好", direction: "auto" },
    { text: "你好", direction: "zh-en", provider: "openai", model: "gpt" },
    { text: "hi", direction: "en-zh" },
  ]);
});

test("rewrite passes on the pieces Rust streams and nothing else", async () => {
  const { rust, translator } = await open({
    "translator.rewrite": (params, call) => {
      call.progress({ piece: "Dear " });
      call.progress({ other: true });
      call.progress({ piece: "team" });
      return { text: "Dear team", engine: "deepseek" };
    },
  });
  const pieces = [];
  const result = await translator.rewrite({ text: "hey all", task: "polish" }, { onProgress: (chunk) => pieces.push(chunk) });
  assert.deepEqual(result, { text: "Dear team", engine: "deepseek" });
  assert.deepEqual(pieces, [{ piece: "Dear " }, { piece: "team" }]);
  await translator.rewrite({ text: "hey all", task: "custom", prompt: "formal", engine: { engine: "openai", model: "gpt" } });
  assert.deepEqual(rust.asked("translator.rewrite"), [
    { text: "hey all", task: "polish", prompt: null },
    { text: "hey all", task: "custom", prompt: "formal", provider: "openai", model: "gpt" },
  ]);
});

test("Rust's error codes become translator/v1 codes and keep the original in data", async () => {
  const failures = {
    "no key": ["translation.noKey", { args: { service: "DeepSeek" } }],
    empty: ["translation.empty"],
    refused: ["translation.status", { args: { service: "DeepSeek", status: 401 } }],
    offline: ["net.unreachable", { args: { service: "DeepSeek" }, detail: "connection refused" }],
    long: ["translation.tooLong", { args: { max: 5000 } }],
    custom: ["translation.customUnavailable"],
    shape: ["bad-params"],
    crash: ["panic"],
  };
  const { rust, translator } = await open({
    "translator.translate": ({ text }) => {
      const [code, data] = failures[text];
      throw rustError(code, data);
    },
  });
  const failed = (text) => translator.translate({ text, direction: "auto" }).then(() => assert.fail(`${text} should fail`), (error) => ({ code: error.code, data: error.data }));
  assert.deepEqual(await failed("no key"), { code: "no-secret", data: { reason: "translation.noKey", args: { service: "DeepSeek" } } });
  assert.deepEqual(await failed("empty"), { code: "empty-text", data: { reason: "translation.empty" } });
  assert.deepEqual(await failed("refused"), { code: "engine-failed", data: { reason: "translation.status", args: { service: "DeepSeek", status: 401 } } });
  assert.deepEqual(await failed("offline"), { code: "engine-failed", data: { reason: "net.unreachable", args: { service: "DeepSeek" }, detail: "connection refused" } });
  assert.deepEqual(await failed("long"), { code: "bad-params", data: { reason: "translation.tooLong", args: { max: 5000 } } });
  assert.deepEqual(await failed("custom"), { code: "bad-params", data: { reason: "translation.customUnavailable" } });
  assert.deepEqual(await failed("shape"), { code: "bad-params", data: { reason: "bad-params" } });
  assert.deepEqual(await failed("crash"), { code: "failed", data: { reason: "panic" } });
  await assert.rejects(translator.translate({ text: "x", direction: "auto", engine: "deepseek" }), { code: "bad-params" });
  await assert.rejects(translator.translate(null), { code: "bad-params" });
  assert.equal(rust.asked("translator.translate").length, 8);
});

test("the error mapping covers each kind of Rust code", () => {
  assert.equal(serviceCode("timeout"), "timeout");
  assert.equal(serviceCode("peer-gone"), "peer-gone");
  assert.equal(serviceCode("inactive"), "peer-gone");
  assert.equal(serviceCode("translation.provider"), "bad-params");
  assert.equal(serviceCode("translation.urlScheme"), "bad-params");
  assert.equal(serviceCode("translation.customUnavailable"), "bad-params");
  assert.equal(serviceCode("translation.cutOff"), "engine-failed");
  assert.equal(serviceCode("credential.read"), "engine-failed");
  assert.equal(serviceCode("no-method"), "failed");
  assert.equal(serviceCode(undefined), "failed");
  const error = fromRust({ code: "translation.status", message: "DeepSeek answered HTTP 500", data: { args: { status: 500 }, detail: 3, other: "x" } });
  assert.equal(error.message, "DeepSeek answered HTTP 500");
  assert.deepEqual({ code: error.code, data: error.data }, { code: "engine-failed", data: { reason: "translation.status", args: { status: 500 } } });
  assert.deepEqual(fromRust("boom").data, { reason: "failed" });
});

test("engines lists each engine with only whether it has a secret", async () => {
  const { rust, translator } = await open({
    "translator.engines": () => ({
      engines: [
        { engine: "deepseek", hasSecret: true, secret: "sk-should-not-pass" },
        { engine: "openai", hasSecret: "yes" },
      ],
      extra: 1,
    }),
  });
  const listed = await translator.engines();
  assert.deepEqual(listed, { engines: [{ engine: "deepseek", hasSecret: true }, { engine: "openai", hasSecret: false }] });
  assert.ok(!JSON.stringify(listed).includes("sk-should-not-pass"));
  assert.deepEqual(rust.asked("translator.engines"), [null]);
});

test("turning the translation plugin off fails its waiting calls, cancels them in Rust and leaves nothing behind", async () => {
  const { host, rust, translator } = await open({ "translator.translate": () => undefined });
  const waiting = translator.translate({ text: "slow", direction: "auto" });
  assert.ok(await until(() => rust.asked("translator.translate").length === 1));
  const entry = [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "translation");
  entry.update({ disabled: true });
  await assert.rejects(waiting, { code: "peer-gone" });
  const asked = rust.seen.find((message) => message.method === "translator.translate");
  assert.ok(await until(() => rust.seen.some((message) => message.method === "cancel" && message.params.id === asked.id)));
  assert.ok(await until(() => host.status().find((plugin) => plugin.id === "translation")?.state !== "running"));
  assert.ok(!host.services().some((service) => service.name === "translator/v1"));
  await assert.rejects(translator.translate({ text: "again", direction: "auto" }), { code: "not-ready" });
  assert.equal(hooks(host, "service:"), 0);
  assert.equal(hooks(host, "rust:"), 0);
  assert.equal(liveTimers(host), 0);
});
