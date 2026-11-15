import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { startHost } from "@fuyu/plugin-base/host";
import { build } from "@fuyu/plugin-cli";
import { generate, tempDir } from "./helpers.mjs";

const TIMERS_STUB = `export const name = "timers-stub";
const timersV1 = {
  name: "timers/v1",
  methods: { list: {}, start: {}, pause: {}, resume: {}, extend: {}, remove: {}, dismissRinging: {} },
  events: { changed: {}, due: {} },
};
export function apply(ctx) {
  const stub = (globalThis.timersStub = { calls: [], timers: [] });
  const answer = () => ({ timers: stub.timers, at: Date.now() });
  stub.provider = ctx.services.provide(timersV1, {
    list: () => (stub.calls.push(["list"]), answer()),
    start: (params) => (stub.calls.push(["start", params]), { timer: null }),
    pause: () => ({}),
    resume: () => ({}),
    extend: () => ({}),
    remove: () => ({ removed: false }),
    dismissRinging: () => (stub.calls.push(["dismissRinging"]), { removed: 0 }),
  });
}
`;

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

async function until(condition, what, ms = 5000) {
  const end = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await delay(10);
  }
}

test("the built template runs in the plugin host: registers both windows, answers them, and ticks only while a timer runs", async () => {
  const { options } = generate({ name: "runtime" });
  const built = await build(options.dir, { outDir: join(options.dir, "build", "package") });
  const data = tempDir("data");
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, "timers-stub.mjs"), TIMERS_STUB);
  writeFileSync(join(data, "plugins.yml"), `- id: timers-stub\n  name: ./timers-stub.mjs\n- id: pomodoro\n  source: dev\n  path: ${JSON.stringify(built.outDir)}\n`);
  globalThis.timersStub = undefined;
  const host = await startHost({ dir: data });
  cleanup.push(() => host.stop());
  await host.settle();

  const status = host.status().find((entry) => entry.id === "pomodoro");
  assert.equal(status?.state, "running", JSON.stringify(host.status(), null, 2));
  assert.deepEqual(host.clients().map((entry) => [entry.window, entry.path.split("/").at(-1)]).sort(), [["island", "island.js"], ["settings", "settings.js"]]);
  await until(() => globalThis.timersStub.calls.some(([name]) => name === "list"), "the first list");

  const messages = [];
  cleanup.push(host.ctx.clients.onMessage((message) => messages.push(message)));
  const listed = await host.ctx.clients.call("pomodoro", "list", null, "island");
  assert.deepEqual(listed.timers, []);
  await host.ctx.clients.call("pomodoro", "start", null, "island");
  assert.deepEqual(globalThis.timersStub.calls.find(([name]) => name === "start"), ["start", { kind: "countdown", durationMs: 25 * 60_000 }]);
  await host.ctx.clients.call("pomodoro", "dismiss", null, "settings");
  assert.ok(globalThis.timersStub.calls.some(([name]) => name === "dismissRinging"));
  assert.equal(host.timers().pomodoro, undefined);

  const now = Date.now();
  const running = { id: "a", kind: "countdown", durationMs: 60_000, elapsedMs: 0, runningSince: now, alerted: false };
  globalThis.timersStub.provider.emit("changed", { timers: [running], at: now });
  await until(() => host.timers().pomodoro === 1, "the plugin's interval");
  await until(() => messages.filter((message) => message.plugin === "pomodoro" && message.topic === "timers").length >= 2, "a tick", 3000);
  globalThis.timersStub.provider.emit("changed", { timers: [], at: Date.now() });
  await until(() => host.timers().pomodoro === undefined, "the interval to stop");
});
