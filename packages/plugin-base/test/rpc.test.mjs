import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { connect, PEER_GONE } from "../src/host/rpc.mjs";

function pair() {
  const a = new PassThrough();
  const b = new PassThrough();
  const left = connect({ input: a, write: (text) => b.write(text) });
  const right = connect({ input: b, write: (text) => a.write(text) });
  return { left, right, cut: () => a.end() };
}

test("a call gets the handler's result, and a thrown error comes back with its code", async () => {
  const { left, right } = pair();
  right.handle("add", ({ a, b }) => a + b);
  right.handle("fail", () => {
    throw Object.assign(new Error("nope"), { code: 7, data: { why: "test" } });
  });
  assert.equal(await left.call("add", { a: 2, b: 3 }), 5);
  await assert.rejects(left.call("fail"), (error) => error.code === 7 && error.message === "nope" && error.data.why === "test");
  await assert.rejects(left.call("missing"), (error) => error.code === -32601);
});

test("when the other side goes away, every call waiting on it fails at once with the reason", async () => {
  const { left, right, cut } = pair();
  right.handle("slow", () => new Promise(() => {}));
  const waiting = left.call("slow", null, { timeoutMs: 60000 });
  const started = Date.now();
  cut();
  await assert.rejects(waiting, (error) => error.code === PEER_GONE);
  assert.ok(Date.now() - started < 1000);
  await assert.rejects(left.call("slow"), (error) => error.code === PEER_GONE);
});

test("a call that gets no answer times out instead of hanging", async () => {
  const { left, right } = pair();
  right.handle("slow", () => new Promise(() => {}));
  await assert.rejects(left.call("slow", null, { timeoutMs: 50 }), (error) => error.code === "timeout");
});
