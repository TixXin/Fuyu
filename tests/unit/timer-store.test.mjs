import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { createServiceProxy, createWindowServices } from "@fuyu/plugin-base/client";
import { startHost } from "@fuyu/plugin-base/host";
import { createTimerController } from "../../src/features/timer/timerController.ts";
import { normalizeTimers, remainingOf } from "../../src/features/timer/timers.ts";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const MINUTE = 60_000;

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}

function makeSpace() {
  const dir = mkdtempSync(join(tmpdir(), "timer-store-"));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function openHost(dir) {
  const host = await startHost({ dir, builtins: BUILTINS });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

function bridgeWindowToHost(services) {
  let currentHost = null;
  const proxy = createServiceProxy((method, params) => {
    if (!currentHost) return Promise.reject(Object.assign(new Error("disconnected"), { code: "peer-gone" }));
    return Promise.resolve().then(() => currentHost.serviceHub.windowCall(method, params, "main"));
  });
  services.attach(proxy);
  return {
    async connect(host) {
      currentHost = host;
      host.serviceHub.attachWindows({
        connected: () => (currentHost === host ? ["main"] : []),
        publish: (name, data) => {
          if (currentHost === host && name === "service") proxy.deliver(data);
        },
      });
      await proxy.resubscribe();
      proxy.update(host.services());
    },
    disconnect() {
      currentHost = null;
      proxy.update([]);
    },
  };
}

function fakeMigration(initialLegacy = null) {
  let raw = initialLegacy === null ? null : JSON.stringify(initialLegacy);
  let migrated = false;
  return {
    readRaw: () => raw,
    isMarked: () => migrated,
    migration: {
      hasLegacy: () => raw !== null,
      loadLegacy: () => (raw === null ? [] : normalizeTimers(JSON.parse(raw))),
      isMigrated: () => migrated,
      markMigrated: () => {
        migrated = true;
      },
    },
  };
}

test("legacy fuyu-timers migrate once into the host and are not re-imported after removal", async () => {
  const dir = makeSpace();
  const host = await openHost(dir);
  const services = createWindowServices();
  const bridge = bridgeWindowToHost(services);
  const now = Date.now();
  const store = fakeMigration([
    { id: "legacy-live", kind: "countdown", durationMs: 10 * MINUTE, elapsedMs: 2 * MINUTE, runningSince: now - MINUTE, alerted: false },
    { id: "legacy-expired", kind: "countdown", durationMs: MINUTE, elapsedMs: 0, runningSince: now - 2 * MINUTE, alerted: false },
    { id: "legacy-watch", kind: "stopwatch", durationMs: 0, elapsedMs: 15_000, runningSince: null, alerted: false },
  ]);
  let rings = 0;
  const controller = createTimerController({ services, migration: store.migration, onRing: () => { rings += 1; } });
  assert.equal(controller.getSnapshot().timers.length, 3);

  controller.configure(true, true);
  await bridge.connect(host);
  assert.ok(await until(() => store.isMarked() && controller.getSnapshot().timers.some((t) => t.id === "legacy-expired" && t.alerted)));
  assert.equal(rings, 1);
  assert.ok(store.readRaw() !== null);

  const saved = JSON.parse(readFileSync(join(dir, "data", "timer", "timers.json"), "utf8"));
  assert.equal(saved.timers.length, 3);
  const live = controller.getSnapshot().timers.find((t) => t.id === "legacy-live");
  assert.ok(Math.abs(remainingOf(live, Date.now()) - 7 * MINUTE) < 2000);

  controller.dismissRinging();
  controller.cancelTimer("legacy-live");
  controller.cancelTimer("legacy-watch");
  assert.ok(await until(() => controller.getSnapshot().timers.length === 0));

  controller.configure(false, true);
  controller.configure(true, true);
  await controller.sync();
  assert.deepEqual(controller.getSnapshot().timers, []);
});

test("timers keep advancing while the window is closed and across a host restart, and sound follows config", async () => {
  const dir = makeSpace();
  const firstHost = await openHost(dir);
  const services = createWindowServices();
  const bridge = bridgeWindowToHost(services);
  const store = fakeMigration();
  let rings = 0;
  const controller = createTimerController({ services, migration: store.migration, onRing: () => { rings += 1; } });

  controller.configure(true, false);
  await bridge.connect(firstHost);
  assert.equal(await controller.startCountdown(1000), "ok");
  assert.ok(await until(() => controller.getSnapshot().timers[0]?.alerted === true, 3000));
  assert.equal(rings, 0);
  controller.dismissRinging();
  assert.ok(await until(() => controller.getSnapshot().timers.length === 0));

  controller.configure(true, true);
  assert.equal(await controller.startCountdown(1000), "ok");
  assert.equal(await controller.startCountdown(10 * MINUTE), "ok");
  controller.configure(false, true);
  bridge.disconnect();
  await sleep(1250);

  const secondHost = await openHost(dir);
  await firstHost.stop();
  controller.configure(true, true);
  await bridge.connect(secondHost);
  assert.ok(await until(() => controller.getSnapshot().timers.length === 2 && controller.getSnapshot().timers.some((t) => t.alerted)));
  const tenMin = controller.getSnapshot().timers.find((t) => !t.alerted);
  assert.ok(tenMin && remainingOf(tenMin, Date.now()) < 10 * MINUTE - 1000);
});

test("a plugin's hidden timer stays out of the island's list and does not ring when due", async () => {
  const dir = makeSpace();
  const services = import.meta.resolve("@fuyu/plugin-services");
  writeFileSync(join(dir, "starter.mjs"), `import { timersV1 } from ${JSON.stringify(services)};
export const name = "timer-starter";
export const inject = ["timers/v1"];
export function apply(ctx) {
  globalThis.storeStarter = ctx.services.get(timersV1);
}
`);
  writeFileSync(join(dir, "plugins.yml"), "- id: timer-starter\n  name: ./starter.mjs\n");
  globalThis.storeStarter = null;
  const host = await openHost(dir);
  const windowServices = createWindowServices();
  const bridge = bridgeWindowToHost(windowServices);
  let rings = 0;
  const controller = createTimerController({ services: windowServices, migration: fakeMigration().migration, onRing: () => { rings += 1; } });
  controller.configure(true, true);
  await bridge.connect(host);
  assert.ok(await until(() => globalThis.storeStarter !== null));

  const heard = [];
  globalThis.storeStarter.on("due", ({ timer }) => heard.push(timer.id));
  const hidden = (await globalThis.storeStarter.start({ kind: "countdown", durationMs: 1000, hidden: true })).timer;
  const shown = (await globalThis.storeStarter.start({ kind: "countdown", durationMs: 30 * MINUTE })).timer;
  assert.ok(await until(() => controller.getSnapshot().timers.some((timer) => timer.id === shown.id)));
  assert.deepEqual(controller.getSnapshot().timers.map((timer) => [timer.id, timer.owner]), [[shown.id, "timer-starter"]]);
  assert.ok(await until(() => heard.includes(hidden.id), 3000), "the plugin did not hear due for its hidden timer");
  await controller.sync();
  await sleep(50);
  assert.equal(rings, 0);
  assert.equal(controller.getSnapshot().timers.some((timer) => timer.id === hidden.id), false);

  assert.equal(await controller.startCountdown(1000), "ok");
  assert.ok(await until(() => rings === 1, 3000), "the user's own countdown did not ring");
  assert.equal(controller.getSnapshot().timers.filter((timer) => timer.alerted).length, 1);
});
