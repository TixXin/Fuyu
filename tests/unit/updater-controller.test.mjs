import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_UPDATE_PREFERENCES, normalizeUpdateChannel, normalizeUpdatePreferences } from "../../src/features/updater/storage.ts";
import { nextUpdateCheckAt } from "../../src/features/updater/checkSchedule.ts";
import { runtime } from "./updaterTestRuntime.mjs";

const hour = 3_600_000;
const schedule = (extra = {}) => ({ ...DEFAULT_UPDATE_PREFERENCES, stage: "latest", startedAt: 1000,
  lastCheckedAt: hour, lastAttemptAt: hour, checkFailures: 0, ...extra });

test("legacy preferences retain the switch, skipped version and successful timestamp", () => {
  assert.deepEqual(normalizeUpdatePreferences(undefined), DEFAULT_UPDATE_PREFERENCES);
  const old = normalizeUpdatePreferences({ autoCheck: false, skippedVersion: "0.3.1", lastCheckedAt: 5 });
  assert.deepEqual(old, { ...DEFAULT_UPDATE_PREFERENCES, autoCheck: false, skippedVersion: "0.3.1", lastCheckedAt: 5 });
  for (const value of [0, -1, 2, "6", NaN, Infinity]) {
    assert.equal(normalizeUpdatePreferences({ checkIntervalHours: value }).checkIntervalHours, 6);
  }
  for (const value of [1, 6, 12, 24]) assert.equal(normalizeUpdatePreferences({ checkIntervalHours: value }).checkIntervalHours, value);
  for (const value of [-1, Infinity, Date.now() + hour]) assert.equal(normalizeUpdatePreferences({ lastCheckedAt: value }).lastCheckedAt, null);
});

test("deadlines use the last successful check and one shared startup buffer", () => {
  for (const hours of [1, 6, 12, 24]) {
    assert.equal(nextUpdateCheckAt(schedule({ checkIntervalHours: hours }), hour), hour + hours * hour);
  }
  assert.equal(nextUpdateCheckAt(schedule({ lastCheckedAt: null }), hour), 21_000);
  assert.equal(nextUpdateCheckAt(schedule({ startedAt: hour - 1000 }), hour), hour * 7);
  assert.equal(nextUpdateCheckAt(schedule({ lastCheckedAt: null, startedAt: hour - 1000 }), hour), hour + 19_000);
  // A clock rollback must not defer checks until the old clock catches up.
  assert.equal(nextUpdateCheckAt(schedule({ startedAt: hour, lastCheckedAt: hour * 2 }), 500), 500);
});

test("disabled and busy schedules pause, while available and skipped versions keep checking", () => {
  for (const stage of ["disabled", "checking", "downloading", "installing", "done"]) assert.equal(nextUpdateCheckAt(schedule({ stage }), hour), null);
  assert.equal(nextUpdateCheckAt(schedule({ autoCheck: false }), hour), null);
  assert.equal(nextUpdateCheckAt(schedule({ stage: "available", skippedVersion: "0.3.6" }), hour), hour * 7);
});

test("check failure retries back off without moving last-success time", () => {
  for (const [failures, delay] of [[1, 60_000], [2, 300_000], [3, 900_000], [4, 6 * hour]]) {
    assert.equal(nextUpdateCheckAt(schedule({ stage: "error", checkFailures: failures }), hour), hour + delay);
  }
  assert.equal(nextUpdateCheckAt(schedule({ checkFailures: 2 }), 500), 500);
});

test("background respects interval and switch, manual checking remains available", async () => {
  const native = runtime({ preferences: { autoCheck: false } });
  const app = await native.controller();
  await app.checkInBackground();
  await app.checkOnFirstVisit();
  assert.equal(native.calls.filter((c) => c.command === "updater_check").length, 0);
  await app.checkForUpdate();
  assert.equal(app.getUpdateState().stage, "latest");
  assert.equal(typeof native.prefs().lastCheckedAt, "number");
  app.setAutoCheck(true);
  await app.checkInBackground();
  assert.equal(native.calls.filter((c) => c.command === "updater_check").length, 1);
});

test("changes propagate between windows and stale snapshots cannot roll progress back", async () => {
  const native = runtime();
  const main = await native.controller();
  const settings = await native.controller();
  settings.setCheckInterval(12);
  assert.equal(main.getUpdateState().checkIntervalHours, 12);
  const stale = native.snapshot();
  native.emit({ stage: "downloading", downloaded: 60, total: 100 });
  main.applyUpdateSnapshot(stale);
  assert.equal(main.getUpdateState().downloaded, 60);
  assert.equal(settings.getUpdateState().downloaded, 60);
  settings.close();
  assert.equal(native.listenerCount(), 1);
  const reopened = await native.controller();
  assert.equal(reopened.getUpdateState().stage, "downloading");
  assert.equal(reopened.getUpdateState().downloaded, 60);
});

test("an event arriving before the initial query response wins", async () => {
  const native = runtime();
  const app = await native.controller({ query: async (old) => {
    native.emit({ stage: "available", nextVersion: "0.3.6", channel: "stable" });
    return old;
  } });
  assert.equal(app.getUpdateState().nextVersion, "0.3.6");
});

test("two window checks share busy state and a skipped version does not stop later checks", async () => {
  let finish;
  let version = "0.3.6";
  const native = runtime({ check: () => new Promise((resolve) => { finish = () => resolve({ version, body: "notes" }); }) });
  const main = await native.controller();
  const settings = await native.controller();
  const check = main.checkForUpdate();
  await new Promise(setImmediate);
  await settings.checkForUpdate();
  assert.equal(native.calls.filter((c) => c.command === "updater_check").length, 1);
  finish(); await check;
  settings.skipVersion(version);
  assert.equal(main.reminderVersion(main.getUpdateState()), null);
  version = "0.3.7";
  native.emit({ lastCheckedAt: Date.now() - 7 * hour });
  const next = main.checkInBackground();
  await new Promise(setImmediate);
  finish(); await next;
  assert.equal(main.reminderVersion(main.getUpdateState()), version);
});

test("notifications are opt-in, deduplicated after reopening, and failures retain badges", async () => {
  let notifications = 0;
  let allowed = true;
  const native = runtime({ check: async () => ({ version: "0.3.6" }), notify: async () => { notifications++; return allowed; } });
  const app = await native.controller();
  await app.checkForUpdate();
  await app.notifyAvailableUpdate("title", (v) => v);
  assert.equal(notifications, 0);
  app.setReminderMode("notification");
  await app.notifyAvailableUpdate("title", (v) => v);
  assert.equal(notifications, 1);
  const reopened = await native.controller();
  await reopened.notifyAvailableUpdate("title", (v) => v);
  assert.equal(notifications, 1);
  native.emit({ nextVersion: "0.3.7" }); allowed = false;
  await app.notifyAvailableUpdate("title", (v) => v);
  assert.equal(reopened.getUpdateState().notificationUnavailable, true);
  assert.equal(app.reminderVersion(app.getUpdateState()), "0.3.7");
  app.skipVersion("0.3.7");
  await app.notifyAvailableUpdate("title", (v) => v);
  assert.equal(notifications, 2);
});

test("explicit rendered install target is retained when the background candidate changes", async () => {
  const native = runtime({ check: async () => ({ version: "0.3.7" }) });
  const app = await native.controller();
  await app.checkForUpdate();
  await app.installUpdate("0.3.6", "stable");
  assert.equal(app.getUpdateState().commandError.code, "updater.targetChanged");
  assert.equal(app.getUpdateState().stage, "available");
});

test("failed checks retain successful time and candidate, then clear errors on retry", async () => {
  let fail = false;
  const native = runtime({ check: async () => { if (fail) throw "offline"; return { version: "0.3.6", body: "notes" }; } });
  const app = await native.controller();
  await app.checkForUpdate();
  const at = app.getUpdateState().lastCheckedAt;
  fail = true; await app.checkForUpdate();
  assert.equal(app.getUpdateState().lastCheckedAt, at);
  assert.equal(app.getUpdateState().nextVersion, "0.3.6");
  assert.equal(app.getUpdateState().checkFailures, 1);
  assert.ok(app.getUpdateState().nextCheckAt > Date.now());
  fail = false; await app.checkForUpdate();
  assert.equal(app.getUpdateState().commandError, null);
  assert.equal(app.getUpdateState().checkFailures, 0);
});

test("unconfigured builds cannot check and channel defaults retain beta opt-in", async () => {
  const native = runtime();
  const app = await native.controller({ configured: false });
  await app.checkForUpdate();
  assert.equal(app.getUpdateState().stage, "disabled");
  assert.equal(native.calls.length, 0);
  assert.equal(normalizeUpdateChannel(null, "0.3.5"), "stable");
  assert.equal(normalizeUpdateChannel(null, "0.3.5-beta.1"), "beta");
  assert.equal(normalizeUpdateChannel("stable", "0.3.5-beta.1"), "stable");
});

test("failed channel switch preserves stored channel", async () => {
  const channels = [];
  const native = runtime({ check: async ({ channel, proxy }) => {
    assert.equal(proxy, "http://localhost:7890"); channels.push(channel);
    if (channel === "beta") throw "offline";
    return null;
  } });
  const app = await native.controller({ proxy: "http://localhost:7890" });
  await app.checkForUpdate();
  await app.setUpdateChannel("beta");
  assert.equal(app.getUpdateState().channel, "stable");
  assert.deepEqual(channels, ["stable", "beta"]);
});
