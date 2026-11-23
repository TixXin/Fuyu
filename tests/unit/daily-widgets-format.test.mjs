import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_DAILY, parseDaily, serializeDaily, withoutHabit } from "../../src/features/daily-widgets/dailyFormat.ts";
import { countdownTarget, daysBetween, normalizeDateText } from "../../src/features/daily-widgets/countdowns.ts";
import { cityForZone } from "../../src/features/daily-widgets/cities.ts";
import { sunPlace, zonedClock } from "../../src/features/daily-widgets/sun.ts";

const OLD_SAVE = {
  version: 1,
  water: { "2026-11-20": 3 },
  habits: { "2026-11-20": [0, 2] },
  checkins: ["2026-11-20"],
  focus: { "2026-11-20": 50 },
  note: "hello",
  pomodoro: { endsAt: null, leftMs: 600_000 },
};

test("data saved before the editable widgets reads the same, with defaults for the new fields", () => {
  const data = parseDaily(OLD_SAVE);
  assert.deepEqual(data.habits, OLD_SAVE.habits);
  assert.equal(data.note, "hello");
  assert.deepEqual(data.pomodoro, { endsAt: null, leftMs: 600_000, minutes: 25 });
  assert.equal(data.habitNames, null);
  assert.deepEqual(data.countdowns, []);
  assert.equal(data.cities, null);
  assert.equal(data.sunCity, null);
  assert.equal(data.waterGoal, 8);
});

test("untouched settings are not written, so the saved shape stays what older versions expect", () => {
  assert.deepEqual(serializeDaily(parseDaily(OLD_SAVE), "2026-01-01"), { ...OLD_SAVE, pomodoro: { ...OLD_SAVE.pomodoro, minutes: 25 } });
});

test("a fourth habit survives a reload, a fifth does not", () => {
  const data = parseDaily({ ...OLD_SAVE, habits: { "2026-11-20": [3, 4] }, habitNames: ["a", "b", "c", "d", "e"] });
  assert.deepEqual(data.habits, { "2026-11-20": [3] });
  assert.deepEqual(data.habitNames, ["a", "b", "c", "d"]);
});

test("removing a habit drops its days and moves the later habits up", () => {
  assert.deepEqual(withoutHabit({ a: [0, 1, 3], b: [1] }, 1), { a: [0, 2] });
});

test("countdowns keep valid dates, drop broken ones and clamp the shown index", () => {
  const data = parseDaily({ ...OLD_SAVE, countdowns: [{ name: "Trip", date: "2027-1-5" }, { name: "x", date: "2027-02-30" }, "bad", { date: "12-25" }], countdownAt: 5 });
  assert.deepEqual(data.countdowns, [{ name: "Trip", date: "2027-01-05" }, { name: "", date: "12-25" }]);
  assert.equal(data.countdownAt, 0);
});

test("world clock cities need three known ids, the sun city one known id", () => {
  assert.deepEqual(parseDaily({ ...OLD_SAVE, cities: ["paris", "tokyo", "sydney"] }).cities, ["paris", "tokyo", "sydney"]);
  assert.equal(parseDaily({ ...OLD_SAVE, cities: ["paris", "atlantis", "sydney"] }).cities, null);
  assert.equal(parseDaily({ ...OLD_SAVE, sunCity: "atlantis" }).sunCity, null);
});

test("a longer pomodoro keeps its paused time; a time longer than the round resets", () => {
  assert.deepEqual(parseDaily({ ...OLD_SAVE, pomodoro: { endsAt: null, leftMs: 40 * 60_000, minutes: 45 } }).pomodoro, { endsAt: null, leftMs: 40 * 60_000, minutes: 45 });
  assert.equal(parseDaily({ ...OLD_SAVE, pomodoro: { endsAt: null, leftMs: 40 * 60_000 } }).pomodoro.leftMs, 25 * 60_000);
  assert.equal(parseDaily({ ...OLD_SAVE, pomodoro: { minutes: 33 } }).pomodoro.minutes, 25);
});

test("other versions and junk read as empty", () => {
  assert.deepEqual(parseDaily({ ...OLD_SAVE, version: 2 }), EMPTY_DAILY);
  assert.deepEqual(parseDaily("nope"), EMPTY_DAILY);
});

test("typed dates become a fixed day or a yearly month-day", () => {
  assert.equal(normalizeDateText("2027/1/5"), "2027-01-05");
  assert.equal(normalizeDateText("2027年1月5日"), "2027-01-05");
  assert.equal(normalizeDateText("12-25"), "12-25");
  assert.equal(normalizeDateText("2-29"), "02-29");
  assert.equal(normalizeDateText("2027-02-29"), null);
  assert.equal(normalizeDateText("13-01"), null);
  assert.equal(normalizeDateText("tomorrow"), null);
});

test("a yearly date rolls to next year once it has passed, Feb 29 falls back in common years", () => {
  const now = new Date(2026, 11, 26, 15);
  assert.equal(daysBetween(now, countdownTarget("12-26", now)), 0);
  assert.equal(countdownTarget("12-25", now).getFullYear(), 2027);
  assert.equal(countdownTarget("02-29", now).getDate(), 28);
  assert.equal(daysBetween(now, countdownTarget("2026-12-20", now)), -6);
});

test("the sun uses the city of the system time zone, or the old 31° guess", () => {
  assert.equal(cityForZone("Asia/Shanghai"), "shanghai");
  assert.equal(cityForZone("America/Los_Angeles"), "losAngeles");
  assert.deepEqual(sunPlace(null, "Etc/Unknown"), { city: null, zone: undefined, latitude: 31, longitude: null });
  assert.equal(sunPlace("tokyo", "Asia/Shanghai").zone, "Asia/Tokyo");
  assert.equal(zonedClock(new Date(Date.UTC(2026, 5, 1, 0, 0)), "Asia/Tokyo").offset, 540);
});
