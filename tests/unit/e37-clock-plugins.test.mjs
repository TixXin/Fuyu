import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { messagesV1 } from "../../packages/plugin-services/src/index.mjs";
import {
  daysDelta,
  primaryCountdown,
  sanitizeBackground,
  sortCountdownItems,
} from "../../plugins/v3/official/countdown/src/model.ts";
import {
  minuteKey,
  nextScheduledAlarm,
  shouldFireAlarm,
} from "../../plugins/v3/official/alarm/src/model.ts";
import {
  DEFAULT_SETTINGS,
  focusCity,
  isValidTimeZone,
  moveCity,
  normalizeStored,
  primaryCity,
  renameCity,
} from "../../plugins/v3/official/world-clock/src/model.ts";
import {
  dateText,
  diffText,
  formatTime,
  formatUtcOffset,
  joinTime,
  msUntilNextTick,
  uses12Hour,
  zoneInfo,
} from "../../plugins/v3/official/world-clock/src/clock.ts";
import { CITIES, searchCities } from "../../plugins/v3/official/world-clock/src/cities.ts";

const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const PLUGINS = [
  { folder: "countdown", id: "@fuyu/countdown" },
  { folder: "alarm", id: "@fuyu/alarm" },
  { folder: "world-clock", id: "@fuyu/world-clock" },
];

const scratch = mkdtempSync(join(tmpdir(), "fuyu-e37-clocks-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("E37 official plugins: check, pack, review, install, and run in host", async () => {
  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });

  for (const entry of PLUGINS) {
    const dir = join(OFFICIAL_ROOT, entry.folder);
    const checkResult = await check(dir, { official: true, allowExperimental: false });
    assert.equal(checkResult.ok, true, `${entry.id} check failed: ${JSON.stringify(checkResult.errors)}`);
    assert.equal(
      checkResult.warnings.filter((w) => w.code !== "review:first-release").length,
      0,
      `${entry.id} unexpected warnings: ${JSON.stringify(checkResult.warnings)}`,
    );

    const packed = await pack(dir, {
      official: true,
      allowExperimental: false,
      outDir: join(scratch, "dist", entry.folder),
      packDir: join(scratch, "packed"),
    });
    assert.equal(packed.manifest.name, entry.id);

    const report = review({ oldDir: null, newDir: dir, newBuilt: packed.outDir });
    assert.equal(report.findings.some((f) => f.tier === "red"), false, `${entry.id} red findings: ${JSON.stringify(report.findings)}`);

    const installed = installPackage(packed.file, {
      dir: hostDir,
      source: "market",
      official: true,
      expectedSha256: packed.sha256,
    });
    assert.equal(installed.id, entry.id);
  }

  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    const messagesProvider = host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async () => ({ shown: true, receivedAt: Date.now() }),
      clear: async () => ({ ok: true }),
    });
    await host.settle();

    for (const entry of PLUGINS) {
      const state = host.status().find((p) => p.id === entry.id);
      assert.equal(state?.state, "running", `${entry.id} expected running, got ${JSON.stringify(state)}`);
      assert.equal(state?.source, "market");
    }

    await messagesProvider.dispose();
  } finally {
    await host.stop();
  }
});

test("E37 countdown, alarm, and world-clock domain models", () => {
  const refAt = new Date(2026, 10, 17, 9, 30, 0).getTime();
  assert.equal(daysDelta("2026-11-20", refAt), 3);
  assert.equal(daysDelta("2026-11-17", refAt), 0);
  assert.equal(daysDelta("2026-11-15", refAt), -2);

  const items = [
    { id: "past", title: "Launch", date: "2026-11-10", pinned: false, backgroundDataUrl: null },
    { id: "far", title: "New Year", date: "2027-01-01", pinned: false, backgroundDataUrl: null },
    { id: "near", title: "Release", date: "2026-11-19", pinned: false, backgroundDataUrl: null },
  ];
  assert.deepEqual(
    sortCountdownItems(items, refAt).map((i) => i.id),
    ["near", "far", "past"],
  );
  assert.equal(primaryCountdown(items, refAt)?.id, "near");
  assert.equal(sanitizeBackground("https://evil.example/bg.png"), null);
  assert.equal(sanitizeBackground("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");

  const currentMin = minuteKey(refAt);
  const alarm = {
    id: "a1",
    time: "09:30",
    label: "Standup",
    days: [currentMin.day],
    tone: "chime",
    enabled: true,
    lastFiredMinute: null,
  };
  assert.equal(shouldFireAlarm(alarm, refAt), true);
  assert.equal(shouldFireAlarm({ ...alarm, lastFiredMinute: currentMin.key }, refAt), false);
  assert.equal(shouldFireAlarm({ ...alarm, days: [(currentMin.day + 1) % 7] }, refAt), false);

  const next = nextScheduledAlarm(
    [
      { ...alarm, id: "later", time: "10:15", days: [] },
      { ...alarm, id: "tomorrow", time: "08:00", days: [] },
    ],
    refAt,
  );
  assert.equal(next?.alarm.id, "later");
  assert.equal(next?.minutesAway, 45);

  assert.equal(isValidTimeZone("Asia/Tokyo"), true);
  assert.equal(isValidTimeZone("Not/AZone"), false);
  const utcClock = zoneInfo(Date.UTC(2026, 10, 17, 14, 5, 0), "UTC", "UTC");
  assert.equal(formatTime(utcClock.parts, false, false, "en").time, "14:05");
  assert.equal(utcClock.isDaytime, true);
  assert.equal(
    primaryCity([
      { id: "1", timeZone: "UTC", labelZh: "UTC", labelEn: "UTC", shortCode: "UTC", pinned: false },
      { id: "2", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: true },
    ])?.id,
    "2",
  );
});

const CITY = (id, timeZone, extra = {}) => ({ id, timeZone, labelZh: id, labelEn: id, shortCode: "X", pinned: false, ...extra });

test("E65 world clock: 1.0.0 data still reads, new settings take defaults", () => {
  const old = {
    cities: [
      { id: "a", timeZone: "Asia/Tokyo", labelZh: "东京", labelEn: "Tokyo", shortCode: "TYO", pinned: true },
      { id: "b", timeZone: "Not/AZone", labelZh: "坏", labelEn: "Bad", shortCode: "BAD", pinned: false },
      { id: "c", timeZone: "Europe/Berlin", pinned: true },
    ],
    showInBar: false,
  };
  const stored = normalizeStored(old);
  assert.deepEqual(stored.cities.map((c) => c.id), ["a", "c"]);
  assert.equal(stored.cities[1].labelEn, "Berlin");
  assert.equal(stored.cities[1].pinned, false);
  assert.equal(stored.showInBar, false);
  assert.deepEqual({ ...stored, cities: undefined, showInBar: true }, { ...DEFAULT_SETTINGS, cities: undefined });

  const fresh = normalizeStored(null);
  assert.deepEqual(fresh.cities.map((c) => c.timeZone), ["Asia/Tokyo", "Europe/London", "America/New_York"]);
  assert.equal(fresh.timeFormat, "system");
  assert.equal(fresh.showTimeZone, false);
  assert.equal(fresh.barStyle, "name");
  assert.equal(fresh.showPage, true);
  assert.equal(normalizeStored({ cities: [], showPage: false }).showPage, false);

  const tweaked = normalizeStored({ cities: [], timeFormat: "12", barStyle: "weird", showSeconds: "yes", showLocal: true });
  assert.equal(tweaked.timeFormat, "12");
  assert.equal(tweaked.barStyle, "name");
  assert.equal(tweaked.showSeconds, false);
  assert.equal(tweaked.showLocal, true);
});

test("E65 world clock: reorder, rename and star cities", () => {
  const list = [CITY("a", "UTC"), CITY("b", "UTC"), CITY("c", "UTC"), CITY("d", "UTC")];
  assert.deepEqual(moveCity(list, "a", 2).map((c) => c.id), ["b", "c", "a", "d"]);
  assert.deepEqual(moveCity(list, "d", 0).map((c) => c.id), ["d", "a", "b", "c"]);
  assert.deepEqual(moveCity(list, "b", 99).map((c) => c.id), ["a", "c", "d", "b"]);
  assert.deepEqual(moveCity(list, "zz", 0).map((c) => c.id), ["a", "b", "c", "d"]);

  const renamed = renameCity(list, "b", "  Home  ");
  assert.equal(renamed[1].name, "Home");
  assert.equal("name" in renameCity(renamed, "b", "   ")[1], false);

  const starred = focusCity(list, "c");
  assert.deepEqual(starred.map((c) => c.pinned), [false, false, true, false]);
  assert.equal(primaryCity(focusCity(starred, "missing"))?.id, "c");
});

test("E65 world clock: 12 / 24 hour time, dates and offsets", () => {
  const at = Date.UTC(2026, 10, 19, 23, 5, 9);
  const tokyo = zoneInfo(at, "Asia/Tokyo", "UTC");
  assert.deepEqual([tokyo.parts.hour, tokyo.parts.minute, tokyo.parts.second], [8, 5, 9]);
  assert.equal(tokyo.dayDiff, 1);
  assert.equal(tokyo.offsetHours, 9);
  assert.equal(formatUtcOffset(tokyo.utcOffsetMinutes), "UTC+9");
  assert.equal(formatUtcOffset(zoneInfo(at, "Asia/Kolkata", "UTC").utcOffsetMinutes), "UTC+5:30");
  assert.equal(formatUtcOffset(zoneInfo(at, "America/New_York", "UTC").utcOffsetMinutes), "UTC-5");

  assert.deepEqual(formatTime(tokyo.parts, false, false, "zh"), { time: "08:05", period: "" });
  assert.deepEqual(formatTime(tokyo.parts, false, true, "zh"), { time: "08:05:09", period: "" });
  assert.equal(joinTime(formatTime(tokyo.parts, true, false, "zh"), "zh"), "上午 8:05");
  const utc = zoneInfo(at, "UTC", "UTC");
  assert.equal(joinTime(formatTime(utc.parts, true, false, "en"), "en"), "11:05 PM");
  assert.equal(formatTime({ ...utc.parts, hour: 0 }, true, false, "en").time, "12:05");
  assert.equal(formatTime({ ...utc.parts, hour: 12 }, true, false, "zh").period, "下午");
  assert.equal(uses12Hour("system", true), true);
  assert.equal(uses12Hour("system", false), false);
  assert.equal(uses12Hour("24", true), false);
  assert.equal(uses12Hour("12", false), true);

  const words = { tomorrow: "明天", yesterday: "昨天" };
  assert.equal(dateText(at, "Asia/Tokyo", tokyo, "relative", "zh", words), "明天");
  assert.equal(dateText(at, "UTC", utc, "relative", "zh", words), "");
  assert.equal(dateText(at, "Asia/Tokyo", tokyo, "none", "zh", words), "");
  assert.equal(dateText(at, "Asia/Tokyo", tokyo, "always", "zh", words), "11月20日 周五");
  assert.equal(dateText(at, "Asia/Tokyo", tokyo, "always", "en", words), "Fri, Nov 20");
  const la = zoneInfo(at, "America/Los_Angeles", "Asia/Tokyo");
  assert.equal(la.dayDiff, -1);
  assert.equal(dateText(at, "America/Los_Angeles", la, "relative", "zh", words), "昨天");

  const diffWords = { same: "same", ahead: (h) => `+${h}h`, behind: (h) => `-${h}h` };
  assert.equal(diffText(9, "long", diffWords), "+9h");
  assert.equal(diffText(-5.5, "long", diffWords), "-5.5h");
  assert.equal(diffText(-3, "short", diffWords), "-3");
  assert.equal(diffText(0, "short", diffWords), "same");
  assert.equal(diffText(3, "none", diffWords), "");

  assert.equal(msUntilNextTick(Date.UTC(2026, 0, 1, 0, 0, 59, 500), false), 505);
  assert.equal(msUntilNextTick(Date.UTC(2026, 0, 1, 0, 0, 0, 200), true), 805);
});

test("E65 world clock: built-in cities are valid and searchable", () => {
  assert.ok(CITIES.length >= 80);
  for (const city of CITIES) assert.equal(isValidTimeZone(city.timeZone), true, city.timeZone);
  assert.equal(new Set(CITIES.map((c) => `${c.timeZone}|${c.en}`)).size, CITIES.length);
  assert.equal(searchCities("东京")[0].en, "Tokyo");
  assert.equal(searchCities("sfo")[0].en, "San Francisco");
  assert.equal(searchCities("sao paulo")[0].timeZone, "America/Sao_Paulo");
  const zones = searchCities("berlin", 30, ["Europe/Berlin", "Europe/Busingen"]);
  assert.equal(zones[0].kind, "city");
  assert.equal(zones.some((z) => z.kind === "zone" && z.timeZone === "Europe/Berlin"), false);
  const extra = searchCities("busingen", 30, ["Europe/Berlin", "Europe/Busingen"]);
  assert.deepEqual(extra.map((z) => [z.kind, z.timeZone]), [["zone", "Europe/Busingen"]]);
  assert.equal(searchCities("").length, 30);
});
