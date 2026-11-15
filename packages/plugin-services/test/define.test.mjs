import assert from "node:assert/strict";
import { test } from "node:test";
import { defineService, isServiceDefinition, timersV1, translatorV1 } from "@fuyu/plugin-services";

test("a service name carries its version, like a slot name", () => {
  const echo = defineService("demo.echo/v2", { methods: { echo: true } });
  assert.equal(echo.base, "demo.echo");
  assert.equal(echo.version, 2);
  for (const bad of ["echo", "echo/v0", "Echo/v1", "echo/1", "echo/v1/x", "echo.v1", "/v1", "echo/v01"]) {
    assert.throws(() => defineService(bad, { methods: {} }), /not a service name/, bad);
  }
});

test("methods and events are listed by name, and reserved or odd names are refused", () => {
  const demo = defineService("demo/v1", { methods: { run: { timeoutMs: 5000, progress: true }, stop: true }, events: { done: true } });
  assert.deepEqual(Object.keys(demo.methods), ["run", "stop"]);
  assert.deepEqual(demo.methods.run, { timeoutMs: 5000, progress: true });
  assert.deepEqual(demo.methods.stop, {});
  assert.deepEqual(Object.keys(demo.events), ["done"]);
  assert.ok(Object.isFrozen(demo) && Object.isFrozen(demo.methods) && Object.isFrozen(demo.methods.run));
  for (const name of ["on", "then", "constructor", "Run", "run-it", "__proto__"]) {
    assert.throws(() => defineService("demo/v1", { methods: { [name]: true } }), /cannot be the name/, name);
  }
  assert.throws(() => defineService("demo/v1", { methods: { run: { timeoutMs: -1 } } }), /bad timeoutMs/);
  assert.throws(() => defineService("demo/v1", { methods: ["run"] }), /keyed by name/);
  assert.throws(() => defineService("demo/v1", { methods: { run: false } }), /true or an options object/);
});

test("the built-in services are declared, and the translator says nothing about secrets", () => {
  assert.ok(isServiceDefinition(timersV1) && isServiceDefinition(translatorV1));
  assert.equal(timersV1.name, "timers/v1");
  assert.deepEqual(Object.keys(timersV1.events), ["changed", "due"]);
  assert.equal(translatorV1.name, "translator/v1");
  assert.equal(translatorV1.methods.rewrite.progress, true);
  assert.ok(!Object.keys(translatorV1.methods).some((name) => /secret|key|token/i.test(name)));
  assert.equal(isServiceDefinition({ name: "timers/v1" }), false);
});
