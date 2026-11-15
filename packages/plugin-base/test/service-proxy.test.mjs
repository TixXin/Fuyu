import assert from "node:assert/strict";
import { test } from "node:test";
import { createServiceProxy } from "@fuyu/plugin-base/client";
import { defineService } from "@fuyu/plugin-services";

const echoV1 = defineService("demo.echo/v1", { methods: { echo: true, slow: { timeoutMs: 5000 }, stream: { progress: true } }, events: { said: true } });

function fakeHost() {
  const calls = [];
  const answers = new Map();
  const call = async (method, params, options) => {
    calls.push({ method, params, options });
    const answer = answers.get(method);
    if (answer instanceof Error) throw answer;
    return answer ?? true;
  };
  return { calls, answers, call };
}

test("a window calls a declared method by service name, within the declared time plus a little", async () => {
  const host = fakeHost();
  host.answers.set("service.call", { text: "hi" });
  const echo = createServiceProxy(host.call).get(echoV1);
  assert.deepEqual(await echo.echo({ text: "hi" }), { text: "hi" });
  await echo.slow();
  await echo.slow(undefined, { timeoutMs: 200 });
  await echo.slow(undefined, { timeoutMs: 60_000 });
  assert.deepEqual(
    host.calls.map(({ params, options }) => [params, options.timeoutMs]),
    [
      [{ service: "demo.echo/v1", method: "echo", params: { text: "hi" } }, 31_000],
      [{ service: "demo.echo/v1", method: "slow", params: null }, 6000],
      [{ service: "demo.echo/v1", method: "slow", params: null }, 1200],
      [{ service: "demo.echo/v1", method: "slow", params: null }, 6000],
    ],
  );
  assert.equal(echo.secret, undefined);
  await assert.rejects(echo.stream({}, { onProgress: () => {} }), { code: "unsupported" });
  assert.throws(() => echo.on("shouted", () => {}), { code: "no-event" });
});

test("a window asks for an event once, hears it, and lets go when its last listener does", async () => {
  const host = fakeHost();
  const proxy = createServiceProxy(host.call);
  const echo = proxy.get(echoV1);
  const heard = [];
  const offA = echo.on("said", (data) => heard.push(["a", data.n]));
  const offB = echo.on("said", (data) => heard.push(["b", data.n]));
  proxy.deliver({ service: "demo.echo/v1", event: "said", data: { n: 1 } });
  proxy.deliver({ service: "other/v1", event: "said", data: { n: 2 } });
  await offA();
  await offA();
  proxy.deliver({ service: "demo.echo/v1", event: "said", data: { n: 3 } });
  await offB();
  proxy.deliver({ service: "demo.echo/v1", event: "said", data: { n: 4 } });
  assert.deepEqual(heard, [["a", 1], ["b", 1], ["b", 3]]);
  assert.deepEqual(
    host.calls.map(({ method, params }) => [method, params.event]),
    [
      ["service.on", "said"],
      ["service.off", "said"],
    ],
  );
  assert.equal(proxy.subscriptions(), 0);
});

test("after a reconnect the window asks again for the events it still listens to, and knows what is offered", async () => {
  const host = fakeHost();
  const proxy = createServiceProxy(host.call);
  proxy.get(echoV1).on("said", () => {});
  host.calls.length = 0;
  await proxy.resubscribe();
  assert.deepEqual(host.calls.map(({ method, params }) => [method, params]), [["service.on", { service: "demo.echo/v1", event: "said" }]]);
  const seen = [];
  const stop = proxy.watch((list) => seen.push(list.length));
  proxy.update([{ name: "demo.echo/v1", plugin: "echoer", methods: ["echo"], events: ["said"] }]);
  assert.equal(proxy.has("demo.echo/v1"), true);
  stop();
  proxy.update([]);
  assert.equal(proxy.has("demo.echo/v1"), false);
  assert.deepEqual(seen, [1]);
});

test("subscribing and letting go 1000 times leaves nothing behind", async () => {
  const host = fakeHost();
  const proxy = createServiceProxy(host.call);
  const echo = proxy.get(echoV1);
  for (let round = 0; round < 1000; round += 1) {
    const off = echo.on("said", () => {});
    proxy.deliver({ service: "demo.echo/v1", event: "said", data: { round } });
    await off();
  }
  assert.equal(proxy.subscriptions(), 0);
  assert.equal(host.calls.filter((entry) => entry.method === "service.on").length, 1000);
  assert.equal(host.calls.filter((entry) => entry.method === "service.off").length, 1000);
});
