import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { commandsV1 } from "../../packages/plugin-base/src/services.mjs";
import { installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { messagesV1 } from "../../packages/plugin-services/src/index.mjs";
import { ringLevel } from "../../plugins/v3/official/alarm/src/chime.ts";
import { firstDayOf, formatAlarmTime, formatDays, uses12Hour, weekOrder } from "../../plugins/v3/official/alarm/src/format.ts";
import {
  MAX_ALARMS,
  minuteKey,
  missedAlarms,
  normalizeAlarms,
  normalizeDraft,
  normalizeSnoozed,
} from "../../plugins/v3/official/alarm/src/model.ts";
import { DEFAULT_SETTINGS, normalizeSettings, settingsFromStored } from "../../plugins/v3/official/alarm/src/settingsModel.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/alarm", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-alarm-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const hhmm = (at) => minuteKey(at).hhmm;
const alarm = (over = {}) => ({ id: "a", time: "07:30", label: "", days: [], tone: "chime", enabled: true, lastFiredMinute: null, ...over });

test("E66.4 alarm settings: defaults for new installs, 1.0.0 data kept", () => {
  assert.deepEqual(settingsFromStored(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.snoozeMinutes, 5);
  assert.equal(DEFAULT_SETTINGS.ringSeconds, 30);
  assert.equal(DEFAULT_SETTINGS.volume, 70);
  assert.equal(DEFAULT_SETTINGS.fadeIn, false);
  assert.equal(DEFAULT_SETTINGS.timeFormat, "system");
  assert.equal(DEFAULT_SETTINGS.weekStart, "system");
  assert.equal(DEFAULT_SETTINGS.catchUp, true);
  assert.equal(DEFAULT_SETTINGS.onceAfter, "keep");
  assert.equal(DEFAULT_SETTINGS.barMode, "ringing");

  const legacyOn = settingsFromStored({ alarms: [], defaultTone: "bell", showInBar: true });
  assert.equal(legacyOn.barMode, "always");
  assert.equal(legacyOn.defaultTone, "bell");
  assert.equal(legacyOn.snoozeMinutes, 5);
  assert.equal(settingsFromStored({ alarms: [] }).barMode, "always");
  assert.equal(settingsFromStored({ showInBar: false }).barMode, "ringing");
  assert.equal(settingsFromStored({ showInBar: true, settings: { barMode: "ringing" } }).barMode, "ringing");

  const odd = normalizeSettings({ snoozeMinutes: 7, ringSeconds: 45, volume: 140, fadeIn: "yes", timeFormat: "13", weekStart: "sat", onceAfter: "delete" });
  assert.equal(odd.snoozeMinutes, 5);
  assert.equal(odd.ringSeconds, 30);
  assert.equal(odd.volume, 100);
  assert.equal(odd.fadeIn, false);
  assert.equal(odd.timeFormat, "system");
  assert.equal(odd.weekStart, "sat");
  assert.equal(odd.onceAfter, "delete");
  assert.equal(normalizeSettings({ volume: -3 }).volume, 0);
});

test("E66.4 alarm data: drafts, stored alarms, and snooze survive bad input", () => {
  assert.equal(normalizeDraft({ time: "25:00" }, "chime"), null);
  assert.deepEqual(normalizeDraft({ time: "06:05", label: "  run ", days: [5, 1, 1, 9], tone: "nope" }, "bell"), {
    time: "06:05",
    label: "run",
    days: [1, 5],
    tone: "bell",
  });
  const many = Array.from({ length: MAX_ALARMS + 5 }, (_, i) => ({ id: `x${i}`, time: "08:00" }));
  assert.equal(normalizeAlarms(many, "chime").length, MAX_ALARMS);
  const kept = normalizeAlarms([{ id: "k", time: "09:15", enabled: false, lastFiredMinute: "2026-11-18 09:15" }, { time: "10:00" }, null], "digital");
  assert.deepEqual(kept, [{ id: "k", time: "09:15", label: "", days: [], tone: "digital", enabled: false, lastFiredMinute: "2026-11-18 09:15" }]);

  assert.equal(normalizeSnoozed(null), null);
  assert.equal(normalizeSnoozed({ dueAt: "soon", alarm: { id: "a", time: "07:30" } }), null);
  const snoozed = normalizeSnoozed({ dueAt: 1000, alarm: { id: "a", time: "07:30", label: "Up", tone: "bell" } });
  assert.deepEqual(snoozed, { dueAt: 1000, alarm: { id: "a", time: "07:30", label: "Up", tone: "bell", firedAt: 1000 } });
});

test("E66.4 missed alarms between the last check and now", () => {
  const to = new Date(2026, 10, 19, 9, 0).getTime();
  const from = new Date(2026, 10, 18, 23, 0).getTime();
  const daily = alarm({ days: [0, 1, 2, 3, 4, 5, 6] });
  const missed = missedAlarms([daily], from, to);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].key, "2026-11-19 07:30");
  assert.deepEqual(missedAlarms([{ ...daily, lastFiredMinute: "2026-11-19 07:30" }], from, to), []);
  assert.deepEqual(missedAlarms([{ ...daily, enabled: false }], from, to), []);
  assert.deepEqual(missedAlarms([alarm({ days: [new Date(to).getDay() === 0 ? 1 : 0] })], from, to), []);
  assert.deepEqual(missedAlarms([daily], to, from), []);
  assert.deepEqual(missedAlarms([alarm({ time: "10:00" })], from, to), []);

  const weekAgo = to - 7 * 86_400_000;
  const weekly = missedAlarms([alarm({ days: [new Date(to - 2 * 86_400_000).getDay()] })], weekAgo, to);
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].key, minuteKey(new Date(2026, 10, 17, 7, 30).getTime()).key);

  const order = missedAlarms([alarm({ id: "late", time: "08:10" }), alarm({ id: "early", time: "06:00" })], from, to);
  assert.deepEqual(order.map((item) => item.alarm.id), ["early", "late"]);
});

test("E66.4 alarm display: time format, first weekday, and day summaries", () => {
  assert.equal(formatAlarmTime("07:05", false, "AM", "PM", false), "07:05");
  assert.equal(formatAlarmTime("00:30", true, "AM", "PM", false), "12:30 AM");
  assert.equal(formatAlarmTime("13:45", true, "上午", "下午", true), "下午1:45");
  assert.equal(uses12Hour("system", true), true);
  assert.equal(uses12Hour("24", true), false);
  assert.equal(firstDayOf("system", 0), 0);
  assert.equal(firstDayOf("mon", 0), 1);
  assert.deepEqual(weekOrder(1), [1, 2, 3, 4, 5, 6, 0]);
  assert.deepEqual(weekOrder(6), [6, 0, 1, 2, 3, 4, 5]);

  const names = { weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], once: "Once", everyday: "Every day", workdays: "Weekdays", weekend: "Weekends", joiner: ", " };
  assert.equal(formatDays([], 1, names), "Once");
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6], 1, names), "Every day");
  assert.equal(formatDays([5, 4, 3, 2, 1], 1, names), "Weekdays");
  assert.equal(formatDays([6, 0], 1, names), "Weekends");
  assert.equal(formatDays([0, 3], 1, names), "Wed, Sun");
  assert.equal(formatDays([0, 3], 0, names), "Sun, Wed");
});

test("E66.4 ring level follows volume and fades in", () => {
  assert.equal(ringLevel(70, false, 0, 30_000), 0.7);
  assert.equal(ringLevel(0, true, 99_000, 30_000), 0);
  const start = ringLevel(100, true, 0, 30_000);
  const mid = ringLevel(100, true, 9_000, 30_000);
  const end = ringLevel(100, true, 18_000, 30_000);
  assert.ok(start > 0 && start < mid && mid < end);
  assert.equal(end, 1);
});

async function until(check, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

test("E66.4 alarm host: old data, missed report, kept snooze, and commands", async () => {
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.version, "1.1.1");
  assert.deepEqual(packed.manifest.fuyu.commands.map((item) => item.id), ["dismiss", "snooze"]);
  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

  const now = Date.now();
  const dataDir = join(hostDir, "data", "@fuyu", "alarm");
  mkdirSync(dataDir, { recursive: true });
  const dueAt = now + 10 * 60_000;
  writeFileSync(
    join(dataDir, "alarms.json"),
    JSON.stringify({
      alarms: [
        { id: "missed", time: hhmm(now - 60 * 60_000), label: "Stand up", days: [], tone: "chime", enabled: true, lastFiredMinute: null },
        { id: "later", time: hhmm(now + 5 * 60 * 60_000), label: "", days: [1, 2], tone: "bell", enabled: true, lastFiredMinute: null },
      ],
      defaultTone: "digital",
      showInBar: true,
      snoozed: { dueAt, alarm: { id: "later", time: "06:00", label: "Wake", tone: "bell", firedAt: now - 60_000 } },
      lastSeenAt: now - 3 * 60 * 60_000,
    }),
  );

  const notices = [];
  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async (notice) => {
        notices.push(notice);
        return { shown: true, receivedAt: Date.now() };
      },
      clear: async () => ({ ok: true }),
    });
    await host.settle();
    assert.equal(host.status().find((item) => item.id === "@fuyu/alarm")?.state, "running");
    assert.ok(await until(() => notices.length === 1));
    assert.match(notices[0].body, /Stand up/);

    let commands;
    await host.ctx.plugin({
      name: "e66-alarm-inspector",
      apply(ctx) {
        commands = ctx.services.get(commandsV1);
      },
    });
    const own = (await commands.list()).items.filter((item) => item.pluginId === "@fuyu/alarm");
    assert.deepEqual(own.map((item) => [item.id, item.active]), [["dismiss", true], ["snooze", true]]);
    assert.equal(own.find((item) => item.id === "snooze").title["zh-CN"], "闹钟贪睡");

    const run = (command) => commands.run({ plugin: "@fuyu/alarm", command });
    const snap = await run("snooze");
    assert.equal(snap.snoozed.dueAt, dueAt);
    assert.equal(snap.settings.barMode, "always");
    assert.equal(snap.settings.defaultTone, "digital");
    assert.equal(snap.alarms.find((item) => item.id === "missed").enabled, false);

    const dismissed = await run("dismiss");
    assert.equal(dismissed.snoozed, null);
    const saved = JSON.parse(readFileSync(join(dataDir, "alarms.json"), "utf8"));
    assert.equal(saved.snoozed, null);
    assert.equal(saved.settings.barMode, "always");
    assert.equal(saved.alarms.length, 2);
  } finally {
    await host.stop();
  }
});
