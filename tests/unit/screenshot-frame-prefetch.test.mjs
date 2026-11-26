import assert from "node:assert/strict";
import { test } from "node:test";
import { createFramePrefetcher } from "../../src/features/screenshot/framePrefetch.ts";

function setupMockEnv() {
  const listeners = new Map();
  const released = [];
  globalThis.window = {
    setTimeout,
    clearTimeout,
    chrome: {
      webview: {
        addEventListener(type, fn) {
          const list = listeners.get(type) ?? [];
          list.push(fn);
          listeners.set(type, list);
        },
        releaseBuffer(buffer) {
          released.push(buffer);
        },
      },
    },
  };
  return {
    released,
    emitShared(id, width, height, bytes) {
      const buffer = new Uint8Array(bytes).buffer;
      for (const fn of listeners.get("sharedbufferreceived") ?? []) {
        fn({ additionalData: JSON.stringify({ id, width, height }), getBuffer: () => buffer });
      }
      return buffer;
    },
  };
}

test("sharedbufferreceived delivers frame and immediately releases the native WebView2 shared buffer", async () => {
  const env = setupMockEnv();
  const calls = [];
  const prefetcher = createFramePrefetcher({
    getSession: async () => {
      calls.push("session");
      return { id: 10, width: 2, height: 2 };
    },
    getFrame: async () => {
      calls.push("frame");
      return new ArrayBuffer(0);
    },
  });

  prefetcher.prefetch();
  const sharedBytes = [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255];
  const postedBuf = env.emitShared(10, 2, 2, sharedBytes);
  assert.deepEqual(env.released, [postedBuf], "shared buffer must be released right after copying out");

  const session = await prefetcher.fetchSession();
  assert.equal(session?.id, 10);
  assert.equal(prefetcher.peekSession()?.id, 10);
  assert.deepEqual(Array.from(prefetcher.peekFrame(10, 2, 2) ?? []), sharedBytes);

  const data = await prefetcher.fetchFrame(10, 2, 2);
  assert.deepEqual(Array.from(data), sharedBytes);
  assert.deepEqual(calls, ["session", "frame"]);
});

test("fetchFrame waits for sharedbufferreceived when zero-byte IPC resolves before event", async () => {
  const env = setupMockEnv();
  const prefetcher = createFramePrefetcher({
    getSession: async () => ({ id: 11, width: 2, height: 2 }),
    getFrame: async () => new ArrayBuffer(0),
  });

  const bytes = Array.from({ length: 16 }, (_, index) => index + 1);
  const pending = prefetcher.fetchFrame(11, 2, 2);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const postedBuf = env.emitShared(11, 2, 2, bytes);
  const data = await pending;
  assert.deepEqual(Array.from(data), bytes);
  assert.deepEqual(env.released, [postedBuf]);
});

test("raw ArrayBuffer responses work and reset drops stale session cache", async () => {
  setupMockEnv();
  const rawBytes = Array.from({ length: 16 }, (_, index) => 200 + (index % 50));
  let current = { id: 12, width: 2, height: 2 };
  const prefetcher = createFramePrefetcher({
    getSession: async () => current,
    getFrame: async () => new Uint8Array(rawBytes).buffer,
  });

  prefetcher.prefetch();
  const firstSession = await prefetcher.fetchSession();
  assert.equal(firstSession?.id, 12);
  const frame = await prefetcher.fetchFrame(12, 2, 2);
  assert.deepEqual(Array.from(frame), rawBytes);

  prefetcher.reset();
  assert.equal(prefetcher.peekSession(), null);
  current = { id: 13, width: 2, height: 2 };
  const secondSession = await prefetcher.fetchSession();
  assert.equal(secondSession?.id, 13);
});
