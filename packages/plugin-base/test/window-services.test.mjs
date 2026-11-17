import assert from "node:assert/strict";
import { test } from "node:test";
import { createServiceProxy, createWindowServices, HostCallError } from "@fuyu/plugin-base/client";
import { defineService } from "@fuyu/plugin-services";

const echoV1 = defineService("demo.echo/v1", { methods: { echo: true, slow: { timeoutMs: 40 }, stream: { progress: true } }, events: { said: true } });
const otherV1 = defineService("demo.other/v1", { methods: { ping: true } });

const echoImpl = (extra = {}) => ({
  echo: (params) => ({ text: params?.text ?? null }),
  slow: () => new Promise(() => {}),
  stream: (_params, caller) => {
    caller.progress(1);
    caller.progress(2);
    return "done";
  },
  ...extra,
});

function fakeHost(answer = () => ({ from: "host" })) {
  const calls = [];
  const proxy = createServiceProxy(async (method, params) => {
    calls.push({ method, params });
    if (method === "service.call") return answer(params);
    return true;
  });
  return { calls, proxy };
}

test("with no host, a service provided in the window answers callers in the same window", async () => {
  const services = createWindowServices();
  const provider = services.provide(echoV1, echoImpl(), { owner: "timer" });
  const echo = services.get(echoV1);
  assert.deepEqual(await echo.echo({ text: "hi" }), { text: "hi" });
  const chunks = [];
  assert.equal(await echo.stream({}, { onProgress: (chunk) => chunks.push(chunk) }), "done");
  assert.deepEqual(chunks, [1, 2]);
  assert.deepEqual(services.list(), [{ name: "demo.echo/v1", plugin: "timer", methods: ["echo", "slow", "stream"], events: ["said"] }]);
  assert.equal(services.has("demo.echo/v1"), true);
  const heard = [];
  const off = echo.on("said", (data) => heard.push(data));
  assert.equal(provider.emit("said", { n: 1 }), true);
  await off();
  provider.emit("said", { n: 2 });
  assert.deepEqual(heard, [{ n: 1 }]);
  assert.equal(services.listeners(), 0);
});

test("errors carry the host's codes", async () => {
  const services = createWindowServices();
  await assert.rejects(services.get(otherV1).ping(), (error) => error instanceof HostCallError && error.code === "not-ready" && error.data.service === "demo.other/v1");
  services.provide(echoV1, echoImpl({ echo: () => { throw Object.assign(new Error("nope"), { code: "empty-text", data: { why: 1 } }); } }));
  const echo = services.get(echoV1);
  await assert.rejects(echo.echo({}), { code: "empty-text", message: "nope", data: { why: 1 } });
  await assert.rejects(echo.slow(), { code: "timeout" });
  await assert.rejects(echo.slow(undefined, { timeoutMs: 5 }), (error) => error.code === "timeout" && error.data.timeoutMs === 5);
  services.provide(echoV1, echoImpl({ echo: () => Promise.reject(new Error("plain")) }));
  await assert.rejects(echo.echo({}), { code: "failed", message: "plain" });
  const narrow = defineService("demo.echo/v1", { methods: { gone: true } });
  await assert.rejects(services.get(narrow).gone(), { code: "no-method" });
  assert.throws(() => echo.on("shouted", () => {}), { code: "no-event" });
  assert.throws(() => services.provide(echoV1, { echo() {} }), /has no method slow/);
  assert.throws(() => services.get({ name: "bad", methods: {}, events: {} }), { code: "bad-params" });
});

test("a provider that goes away fails its pending calls with peer-gone, then callers get not-ready", async () => {
  const services = createWindowServices();
  const provider = services.provide(echoV1, echoImpl({ slow: () => new Promise(() => {}) }));
  const echo = services.get(echoV1);
  const pending = echo.slow(undefined, { timeoutMs: 1000 });
  await provider.dispose();
  await assert.rejects(pending, { code: "peer-gone" });
  await assert.rejects(echo.echo({}), { code: "not-ready" });
  assert.equal(provider.emit("said", {}), false);
  assert.deepEqual(services.list(), []);
});

test("while the owner is switched off, callers get not-ready, and it answers again once it is back on", async () => {
  const services = createWindowServices();
  const seen = [];
  services.watch((list) => seen.push(list.length));
  const provider = services.provide(echoV1, echoImpl({ slow: () => new Promise(() => {}) }), { owner: "translation" });
  const echo = services.get(echoV1);
  const pending = echo.slow(undefined, { timeoutMs: 1000 });
  services.setDisabledOwners(["translation"]);
  await assert.rejects(pending, { code: "peer-gone" });
  await assert.rejects(echo.echo({ text: "x" }), { code: "not-ready" });
  assert.equal(provider.emit("said", {}), false);
  assert.equal(services.has("demo.echo/v1"), false);
  assert.deepEqual(services.owned("translation"), { services: 1 });
  services.setDisabledOwners([]);
  assert.deepEqual(await echo.echo({ text: "x" }), { text: "x" });
  assert.deepEqual(seen, [1, 0, 1]);
});

test("a call this window cannot answer goes to the host, and the window's own provider comes first", async () => {
  const host = fakeHost((params) => ({ from: "host", method: params.method }));
  const services = createWindowServices();
  services.attach(host.proxy);
  const echo = services.get(echoV1);
  assert.deepEqual(await echo.echo({ text: "a" }), { from: "host", method: "echo" });
  const provider = services.provide(echoV1, echoImpl());
  assert.deepEqual(await echo.echo({ text: "b" }), { text: "b" });
  await provider.dispose();
  assert.deepEqual(await echo.echo({ text: "c" }), { from: "host", method: "echo" });
  assert.deepEqual(host.calls.filter((call) => call.method === "service.call").map((call) => call.params.params), [{ text: "a" }, { text: "c" }]);
  services.attach(null);
  await assert.rejects(echo.echo({}), { code: "not-ready" });
});

test("the host's errors come back with their codes", async () => {
  const host = fakeHost(() => {
    throw new HostCallError("not-ready", "the service demo.echo/v1 has no provider right now", { service: "demo.echo/v1" });
  });
  const services = createWindowServices({ remote: host.proxy });
  await assert.rejects(services.get(echoV1).echo({}), { code: "not-ready" });
});

test("listeners hear the window's provider and the host, and the host subscription follows attach", async () => {
  const host = fakeHost();
  const services = createWindowServices();
  const echo = services.get(echoV1);
  const heard = [];
  const off = echo.on("said", (data) => heard.push(data.n));
  services.attach(host.proxy);
  host.proxy.deliver({ service: "demo.echo/v1", event: "said", data: { n: 1 } });
  const provider = services.provide(echoV1, echoImpl());
  provider.emit("said", { n: 2 });
  await off();
  host.proxy.deliver({ service: "demo.echo/v1", event: "said", data: { n: 3 } });
  provider.emit("said", { n: 4 });
  assert.deepEqual(heard, [1, 2]);
  assert.deepEqual(host.calls.map((call) => call.method), ["service.on", "service.off"]);
});

test("watchers hear when the attached host updates its services or disconnects", () => {
  const host = fakeHost();
  const services = createWindowServices();
  let notifications = 0;
  const unwatch = services.watch(() => {
    notifications += 1;
  });
  services.attach(host.proxy);
  assert.equal(notifications, 1);
  host.proxy.update([{ name: "demo.echo/v1", plugin: "echo", methods: ["echo"], events: [] }]);
  assert.equal(notifications, 2);
  services.attach(null);
  assert.equal(notifications, 3);
  host.proxy.update([]);
  assert.equal(notifications, 3);
  unwatch();
});
