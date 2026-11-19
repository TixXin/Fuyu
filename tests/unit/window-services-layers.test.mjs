import assert from "node:assert/strict";
import { test } from "node:test";
import { createServiceProxy } from "@fuyu/plugin-base/client";
import { defineService } from "@fuyu/plugin-services";
import { windowServices } from "../../src/features/plugin-kernel/services.ts";

const echoV1 = defineService("demo.layers/v1", { methods: { echo: true } });
const ENTRY = { name: "demo.layers/v1", plugin: "demo", methods: ["echo"], events: [] };

function fakeHost(label) {
  const proxy = createServiceProxy(async (method) => (method === "service.call" ? { from: label } : true));
  proxy.update([ENTRY]);
  return proxy;
}

test("the runtime's proxy keeps answering after the plugin page attaches its own and unmounts", async () => {
  const echo = windowServices.get(echoV1);
  const releaseRuntime = windowServices.attach(fakeHost("runtime"));
  assert.deepEqual(await echo.echo({}), { from: "runtime" });

  const releasePage = windowServices.attach(fakeHost("page"));
  assert.deepEqual(await echo.echo({}), { from: "page" });
  releasePage();
  assert.deepEqual(await echo.echo({}), { from: "runtime" });

  releasePage();
  assert.deepEqual(await echo.echo({}), { from: "runtime" });

  const again = windowServices.attach(fakeHost("page"));
  releaseRuntime();
  assert.deepEqual(await echo.echo({}), { from: "page" });
  again();
  await assert.rejects(echo.echo({}), { code: "not-ready" });
});

test("attach(null) still clears every proxy", async () => {
  const echo = windowServices.get(echoV1);
  const release = windowServices.attach(fakeHost("runtime"));
  windowServices.attach(fakeHost("page"));
  windowServices.attach(null);
  await assert.rejects(echo.echo({}), { code: "not-ready" });
  release();
  await assert.rejects(echo.echo({}), { code: "not-ready" });
});
