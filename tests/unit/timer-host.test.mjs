import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { elapsedOf, remainingOf } from "../../src/features/timer/timers.ts";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));
const SERVICES = import.meta.resolve("@fuyu/plugin-services");
const MINUTE = 60_000;

const LISTENER = `import { timersV1 } from ${JSON.stringify(SERVICES)};
globalThis.timerProbe ??= { due: [], applied: 0 };
export const name = "timer-listener";
export const inject = ["timers/v1"];
export function apply(ctx) {
  globalThis.timerProbe.applied += 1;
  ctx.services.get(timersV1).on("due", ({ timer }) => globalThis.timerProbe.due.push(timer.id));
}
`;

const starterSource = (name, key) => `import { timersV1 } from ${JSON.stringify(SERVICES)};
export const name = "${name}";
export const inject = ["timers/v1"];
export function apply(ctx) {
  globalThis.${key} = ctx.services.get(timersV1);
}
`;

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function space() {
  const dir = mkdtempSync(join(tmpdir(), "timer-host-"));
  writeFileSync(join(dir, "listener.mjs"), LISTENER);
  writeFileSync(join(dir, "starter.mjs"), starterSource("timer-starter", "timerStarter"));
  writeFileSync(join(dir, "other.mjs"), starterSource("timer-other", "timerOther"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const dataFile = (dir) => join(dir, "data", "timer", "timers.json");
const readData = (dir) => JSON.parse(readFileSync(dataFile(dir), "utf8"));

async function open(dir, { listener = false, disabled = false, starter = false, other = false } = {}) {
  const entries = disabled ? ["- id: timer\n  disabled: true\n"] : [];
  if (listener) entries.push("- id: timer-listener\n  name: ./listener.mjs\n");
  if (starter) entries.push("- id: timer-starter\n  name: ./starter.mjs\n");
  if (other) entries.push("- id: timer-other\n  name: ./other.mjs\n");
  writeFileSync(join(dir, "plugins.yml"), entries.length ? entries.join("") : "[]\n");
  const host = await startHost({ dir, builtins: BUILTINS });
  cleanup.push(() => host.stop());
  await host.settle();
  return host;
}

function window(host) {
  const heard = [];
  host.serviceHub.attachWindows({ connected: () => ["main"], publish: (name, data) => heard.push(data) });
  for (const event of ["due", "changed"]) host.serviceHub.windowCall("service.on", { service: "timers/v1", event }, "main");
  const call = (method, params) => host.serviceHub.windowCall("service.call", { service: "timers/v1", method, params }, "main");
  return { heard, call, events: (name) => heard.filter((entry) => entry.event === name).map((entry) => entry.data) };
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

const timerEntry = (host) => [...host.ctx.loader.entries()].find((entry) => entry.options.id === "timer");
const timerStatus = (host) => host.status().find((plugin) => plugin.id === "timer");
const serviceHooks = (host) =>
  Object.entries(host.ctx.events._hooks)
    .filter(([name]) => name.startsWith("service:"))
    .reduce((total, [, hooks]) => total + hooks.length, 0);
const liveTimers = (host) => Object.values(host.timers()).reduce((total, count) => total + count, 0);

test("the timer plugin provides timers/v1 and rings a countdown when it is due", async () => {
  const dir = space();
  const host = await open(dir);
  assert.equal(timerStatus(host).state, "running");
  assert.equal(timerStatus(host).kind, "builtin");
  assert.deepEqual(host.services().filter((service) => service.plugin === "timer").map((service) => [service.name, service.plugin]), [["timers/v1", "timer"]]);
  const win = window(host);
  const { timer } = await win.call("start", { kind: "countdown", durationMs: 1000 });
  assert.equal(timer.kind, "countdown");
  assert.equal(timer.durationMs, 1000);
  assert.equal(win.events("changed").length, 1);
  assert.deepEqual(readData(dir).timers, [timer]);
  assert.equal(timerStatus(host).usage.timers, 1);
  assert.ok(await until(() => win.events("due").length === 1, 3000), "no due event within 3 seconds");
  const [due] = win.events("due");
  assert.equal(due.timer.id, timer.id);
  assert.equal(due.timer.alerted, true);
  assert.equal(due.timer.runningSince, null);
  assert.equal(due.timer.elapsedMs, 1000);
  assert.ok(due.at >= timer.runningSince + 1000);
  assert.deepEqual(win.events("changed").at(-1).timers, [due.timer]);
  assert.deepEqual(readData(dir), { version: 1, timers: [due.timer] });
  assert.equal(timerStatus(host).usage.timers, 0);
  assert.deepEqual(await win.call("dismissRinging"), { removed: 1 });
  assert.deepEqual((await win.call("list")).timers, []);
  assert.deepEqual(readData(dir).timers, []);
});

test("after the host restarts, the time left carries on by the wall clock", async () => {
  const dir = space();
  const first = await open(dir);
  const win = window(first);
  const long = (await win.call("start", { kind: "countdown", durationMs: 10 * MINUTE })).timer;
  const short = (await win.call("start", { kind: "countdown", durationMs: 2 * MINUTE })).timer;
  const watch = (await win.call("start", { kind: "stopwatch" })).timer;
  const held = (await win.call("start", { kind: "countdown", durationMs: 5 * MINUTE })).timer;
  const pausedHeld = (await win.call("pause", { id: held.id })).timer;
  await first.stop();
  const saved = readData(dir);
  saved.timers = saved.timers.map((timer) => (timer.runningSince === null ? timer : { ...timer, runningSince: timer.runningSince - 4 * MINUTE }));
  writeFileSync(dataFile(dir), JSON.stringify(saved));
  const second = await open(dir, { disabled: true });
  const win2 = window(second);
  await timerEntry(second).update({ disabled: false });
  await second.settle();
  assert.ok(await until(() => win2.events("due").length === 1), "the countdown that ran out while the host was down did not ring");
  assert.deepEqual(win2.events("due").map((due) => due.timer.id), [short.id]);
  const { timers, at } = await win2.call("list");
  const byId = Object.fromEntries(timers.map((timer) => [timer.id, timer]));
  const leftOnLong = remainingOf(byId[long.id], at);
  assert.ok(Math.abs(leftOnLong - 6 * MINUTE) < 2000, `the long countdown has ${leftOnLong} ms left, not about 6 minutes`);
  assert.ok(Math.abs(elapsedOf(byId[watch.id], at) - 4 * MINUTE) < 2000);
  assert.deepEqual(byId[held.id], pausedHeld);
  assert.equal(byId[short.id].alerted, true);
  assert.equal(byId[short.id].elapsedMs, 2 * MINUTE);
  assert.equal(readData(dir).timers.find((timer) => timer.id === short.id).alerted, true);
  assert.equal(timerStatus(second).usage.timers, 1);
});

test("when the plugin stops it leaves no timers, listeners or open files", async () => {
  const dir = space();
  globalThis.timerProbe = { due: [], applied: 0 };
  const host = await open(dir, { listener: true });
  const win = window(host);
  await win.call("start", { kind: "countdown", durationMs: 30 * MINUTE });
  await win.call("start", { kind: "stopwatch" });
  assert.equal(timerStatus(host).usage.timers, 1);
  assert.equal(timerStatus(host).usage.services, 1);
  assert.equal(serviceHooks(host), 1);
  const entry = timerEntry(host);
  await entry.update({ disabled: true });
  await host.settle();
  assert.equal(timerStatus(host).state, "disabled");
  assert.equal(timerStatus(host).usage.timers, 0);
  assert.equal(host.timers().timer, undefined);
  assert.deepEqual(host.services().filter((service) => service.plugin === "timer"), []);
  assert.equal(host.status().find((plugin) => plugin.id === "timer-listener").state, "waiting");
  assert.equal(serviceHooks(host), 0);
  assert.equal(liveTimers(host), 0);
  assert.equal(process.getActiveResourcesInfo().filter((kind) => kind === "FileHandle").length, 0);
  await assert.rejects(win.call("list"), { code: "not-ready" });
  assert.equal(readData(dir).timers.length, 2);
});

test("starting and stopping the plugin 200 times does not grow its timers or listeners", async () => {
  const dir = space();
  globalThis.timerProbe = { due: [], applied: 0 };
  const host = await open(dir, { listener: true });
  const win = window(host);
  await win.call("start", { kind: "countdown", durationMs: 30 * MINUTE });
  const entry = timerEntry(host);
  const before = { timers: liveTimers(host), hooks: serviceHooks(host), resources: process.getActiveResourcesInfo().length };
  assert.equal(before.timers, 1);
  assert.equal(before.hooks, 1);
  for (let round = 0; round < 200; round += 1) {
    await entry.update({ disabled: true });
    await entry.update({ disabled: false });
  }
  await host.settle();
  assert.ok(await until(() => timerStatus(host).state === "running" && globalThis.timerProbe.applied === 201));
  assert.equal(liveTimers(host), before.timers);
  assert.equal(serviceHooks(host), before.hooks);
  assert.equal(timerStatus(host).usage.timers, 1);
  assert.equal(timerStatus(host).usage.listeners, 0);
  assert.equal(host.status().find((plugin) => plugin.id === "timer-listener").usage.listeners, 1);
  assert.ok(process.getActiveResourcesInfo().length <= before.resources, `active resources grew from ${before.resources} to ${process.getActiveResourcesInfo().length}`);
  assert.equal((await win.call("list")).timers.length, 1);
});

test("bad parameters get the service's error codes and change nothing", async () => {
  const dir = space();
  const host = await open(dir);
  const win = window(host);
  const watch = (await win.call("start", { kind: "stopwatch" })).timer;
  const saved = readFileSync(dataFile(dir), "utf8");
  const failures = [
    ["start", undefined, "bad-params"],
    ["start", { kind: "alarm" }, "bad-params"],
    ["start", { kind: "countdown" }, "bad-duration"],
    ["start", { kind: "countdown", durationMs: 999 }, "bad-duration"],
    ["start", { kind: "countdown", durationMs: "5m" }, "bad-duration"],
    ["start", { kind: "countdown", durationMs: 25 * 60 * MINUTE }, "bad-duration"],
    ["pause", { id: "nobody" }, "not-found"],
    ["pause", {}, "bad-params"],
    ["resume", "abc", "bad-params"],
    ["extend", { id: watch.id }, "bad-params"],
    ["extend", { id: watch.id, byMs: -1 }, "bad-duration"],
    ["remove", { id: 3 }, "bad-params"],
    ["adopt", {}, "bad-params"],
    ["adopt", { timers: "nope" }, "bad-params"],
    ["snooze", {}, "no-method"],
  ];
  for (const [method, params, code] of failures) {
    await assert.rejects(win.call(method, params), (error) => error.code === code && /timer|timers\/v1/.test(error.message), `${method} ${JSON.stringify(params)} should fail with ${code}`);
  }
  assert.deepEqual(await win.call("remove", { id: "nobody" }), { removed: false });
  assert.equal(readFileSync(dataFile(dir), "utf8"), saved);
  assert.equal(win.events("changed").length, 1);
  for (let count = 1; count < 12; count += 1) await win.call("start", { kind: "countdown", durationMs: 60_000 });
  await assert.rejects(win.call("start", { kind: "stopwatch" }), { code: "limit" });
  assert.equal((await win.call("list")).timers.length, 12);
  assert.equal(timerStatus(host).usage.errors, 0);
  assert.equal(timerStatus(host).state, "running");
});

test("a data file that cannot be read starts empty and says why", async () => {
  const dir = space();
  const first = await open(dir);
  await window(first).call("start", { kind: "stopwatch" });
  await first.stop();
  writeFileSync(dataFile(dir), "{ not json");
  const host = await open(dir);
  assert.equal(timerStatus(host).state, "running");
  assert.deepEqual((await window(host).call("list")).timers, []);
  assert.ok(host.logs.some((entry) => entry.type === "warn" && entry.text.includes("could not read")));
});

test("adopt brings legacy timers into timers.json once and rings any countdown that ran out", async () => {
  const dir = space();
  const host = await open(dir);
  const win = window(host);
  const existing = (await win.call("start", { kind: "stopwatch" })).timer;
  const now = Date.now();
  const legacy = [
    existing,
    { id: "old-running", kind: "countdown", durationMs: 5 * MINUTE, elapsedMs: MINUTE, runningSince: now - MINUTE, alerted: false },
    { id: "old-due", kind: "countdown", durationMs: MINUTE, elapsedMs: 0, runningSince: now - 2 * MINUTE, alerted: false },
    { id: "old-alerted", kind: "countdown", durationMs: 2 * MINUTE, elapsedMs: 2 * MINUTE, runningSince: null, alerted: true },
    { id: "old-paused", kind: "stopwatch", durationMs: 0, elapsedMs: 30_000, runningSince: null, alerted: false },
    { id: "", kind: "countdown", durationMs: 1000, elapsedMs: 0, runningSince: now, alerted: false },
  ];
  const first = await win.call("adopt", { timers: legacy });
  assert.equal(first.added, 4);
  assert.equal(first.timers.length, 5);
  assert.deepEqual(win.events("due").map((due) => due.timer.id), ["old-due"]);
  const byId = Object.fromEntries(first.timers.map((timer) => [timer.id, timer]));
  assert.equal(byId["old-due"].alerted, true);
  assert.equal(byId["old-due"].runningSince, null);
  assert.equal(byId["old-alerted"].alerted, true);
  assert.equal(byId["old-paused"].elapsedMs, 30_000);
  assert.ok(Math.abs(remainingOf(byId["old-running"], first.at) - 3 * MINUTE) < 2000);
  assert.deepEqual(readData(dir).timers, first.timers);
  const changesBefore = win.events("changed").length;
  const second = await win.call("adopt", { timers: legacy });
  assert.equal(second.added, 0);
  assert.equal(win.events("changed").length, changesBefore);
});

test("the host fills in which plugin started a timer, and a hidden one only sends due", async () => {
  const dir = space();
  globalThis.timerStarter = null;
  const host = await open(dir, { starter: true });
  const win = window(host);
  assert.ok(await until(() => globalThis.timerStarter !== null));
  const plugin = globalThis.timerStarter;
  const shown = (await plugin.start({ kind: "countdown", durationMs: 30 * MINUTE, owner: "someone-else" })).timer;
  assert.equal(shown.owner, "timer-starter");
  assert.equal("hidden" in shown, false);
  const hidden = (await plugin.start({ kind: "countdown", durationMs: 1000, hidden: true })).timer;
  assert.equal(hidden.owner, "timer-starter");
  assert.equal(hidden.hidden, true);
  const mine = (await win.call("start", { kind: "stopwatch", owner: "timer-starter" })).timer;
  assert.equal("owner" in mine, false);
  assert.equal("hidden" in mine, false);
  await assert.rejects(plugin.start({ kind: "stopwatch", hidden: "yes" }), { code: "bad-params" });

  assert.ok(await until(() => win.events("due").length === 1, 3000), "the hidden countdown sent no due event");
  const [due] = win.events("due");
  assert.equal(due.timer.id, hidden.id);
  assert.equal(due.timer.hidden, true);
  assert.equal(due.timer.alerted, true);
  assert.deepEqual(await win.call("dismissRinging"), { removed: 0 });
  assert.equal((await win.call("list")).timers.length, 3);
  assert.deepEqual(await plugin.remove({ id: hidden.id }), { removed: true });

  await host.stop();
  const again = await open(dir);
  const listed = (await window(again).call("list")).timers;
  assert.deepEqual(listed.map((timer) => [timer.id, timer.owner ?? null]), [[shown.id, "timer-starter"], [mine.id, null]]);
});

test("adopt ignores owner and hidden in what it is given and gives the caller's plugin instead", async () => {
  const dir = space();
  globalThis.timerStarter = null;
  const host = await open(dir, { starter: true });
  const win = window(host);
  assert.ok(await until(() => globalThis.timerStarter !== null));
  const now = Date.now();
  const forged = (id) => ({ id, kind: "stopwatch", durationMs: 0, elapsedMs: 0, runningSince: now, alerted: false, owner: "someone-else", hidden: true });
  const fromWindow = await win.call("adopt", { timers: [forged("legacy")] });
  assert.deepEqual(fromWindow.timers.map((timer) => [timer.id, timer.owner ?? null, timer.hidden ?? false]), [["legacy", null, false]]);
  const fromPlugin = await globalThis.timerStarter.adopt({ timers: [forged("plugin-kept")] });
  assert.deepEqual(fromPlugin.timers.at(-1), { id: "plugin-kept", kind: "stopwatch", durationMs: 0, elapsedMs: 0, runningSince: now, alerted: false, owner: "timer-starter" });
});

async function twoPlugins(dir) {
  globalThis.timerStarter = null;
  globalThis.timerOther = null;
  const host = await open(dir, { starter: true, other: true });
  assert.ok(await until(() => globalThis.timerStarter !== null && globalThis.timerOther !== null));
  return { host, win: window(host), mine: globalThis.timerStarter, theirs: globalThis.timerOther };
}

test("a plugin cannot pause, resume, extend or remove timers it did not start", async () => {
  const dir = space();
  const { win, mine, theirs } = await twoPlugins(dir);
  const user = (await win.call("start", { kind: "countdown", durationMs: 30 * MINUTE })).timer;
  const own = (await mine.start({ kind: "countdown", durationMs: 30 * MINUTE })).timer;
  const hidden = (await mine.start({ kind: "stopwatch", hidden: true })).timer;
  const before = (await win.call("list")).timers;
  const saved = readFileSync(dataFile(dir), "utf8");
  for (const target of [user, own, hidden]) {
    for (const method of ["pause", "resume", "extend"]) {
      await assert.rejects(theirs[method]({ id: target.id }), (error) => error.code === "not-found" && error.message === `there is no timer ${target.id}`);
    }
    assert.deepEqual(await theirs.remove({ id: target.id }), { removed: false });
  }
  assert.deepEqual((await win.call("list")).timers, before);
  assert.equal(readFileSync(dataFile(dir), "utf8"), saved);

  assert.equal((await mine.pause({ id: own.id })).timer.runningSince, null);
  assert.ok((await mine.resume({ id: own.id })).timer.runningSince !== null);
  const stretched = (await mine.extend({ id: own.id, byMs: MINUTE })).timer;
  assert.equal(stretched.durationMs - stretched.elapsedMs, MINUTE);
  await assert.rejects(mine.pause({ id: user.id }), { code: "not-found" });
  assert.deepEqual(await mine.remove({ id: hidden.id }), { removed: true });

  assert.equal((await win.call("pause", { id: own.id })).timer.runningSince, null);
  const byUser = (await win.call("extend", { id: own.id })).timer;
  assert.equal(byUser.durationMs - byUser.elapsedMs, 5 * MINUTE);
  assert.deepEqual(await win.call("remove", { id: own.id }), { removed: true });
  assert.deepEqual((await win.call("list")).timers.map((timer) => timer.id), [user.id]);
});

test("dismissRinging from a plugin removes only its own ringing timers", async () => {
  const dir = space();
  const { win, mine, theirs } = await twoPlugins(dir);
  const user = (await win.call("start", { kind: "countdown", durationMs: 1000 })).timer;
  const ownShown = (await mine.start({ kind: "countdown", durationMs: 1000 })).timer;
  const ownHidden = (await mine.start({ kind: "countdown", durationMs: 1000, hidden: true })).timer;
  const other = (await theirs.start({ kind: "countdown", durationMs: 1000 })).timer;
  const quiet = (await theirs.start({ kind: "countdown", durationMs: 30 * MINUTE })).timer;
  assert.ok(await until(() => win.events("due").length === 4, 3000), "the four countdowns did not all ring");
  const ids = async () => (await win.call("list")).timers.map((timer) => timer.id);
  assert.deepEqual(await theirs.dismissRinging(), { removed: 1 });
  assert.deepEqual(await ids(), [user.id, ownShown.id, ownHidden.id, quiet.id]);
  assert.deepEqual(await mine.dismissRinging(), { removed: 2 });
  assert.deepEqual(await ids(), [user.id, quiet.id]);
  assert.deepEqual(await mine.dismissRinging(), { removed: 0 });
  assert.deepEqual(await win.call("dismissRinging"), { removed: 1 });
  assert.deepEqual(await ids(), [quiet.id]);
  assert.equal(other.owner, "timer-other");
});

test("adopt from a plugin cannot take over a timer that is already there", async () => {
  const dir = space();
  const { win, mine, theirs } = await twoPlugins(dir);
  const own = (await mine.start({ kind: "stopwatch" })).timer;
  const user = (await win.call("start", { kind: "stopwatch" })).timer;
  const result = await theirs.adopt({ timers: [{ ...own, owner: "timer-other" }, { ...user, elapsedMs: 5 * MINUTE }] });
  assert.equal(result.added, 0);
  assert.deepEqual((await win.call("list")).timers, [own, user]);
  await assert.rejects(theirs.pause({ id: own.id }), { code: "not-found" });
});
