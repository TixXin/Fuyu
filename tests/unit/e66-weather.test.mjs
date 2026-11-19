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
import { DEFAULT_CONFIG, configFromStored, normalizeConfig } from "../../plugins/v3/official/weather/src/config.ts";
import { beaufort, formatClock, formatWind, inQuietHours, minutesBetween, weekdayOf } from "../../plugins/v3/official/weather/src/format.ts";
import { geocodeLanguage } from "../../plugins/v3/official/weather/src/openMeteo.ts";
import { rainDecision } from "../../plugins/v3/official/weather/src/rain.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/weather", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-weather-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const at = (hh, mm = 0) => new Date(2026, 10, 19, hh, mm).getTime();

function forecast(over = {}) {
  return {
    now: "2026-11-19T14:00",
    current: { temp: 18, feels: 17, humidity: 62, wind: 11, code: 2, day: 1, mm: 0 },
    hourly: Array.from({ length: 24 }, (_, i) => ({ time: `2026-11-19T${String((14 + i) % 24).padStart(2, "0")}:00`, temp: 18, pop: 10, code: 2, day: 1 })),
    daily: [{ date: "2026-11-19", code: 2, max: 19, min: 12, pop: 10 }],
    soon: [],
    ...over,
  };
}

test("E66.9 weather config: new installs start quiet, 1.0.0 data kept", () => {
  assert.deepEqual(configFromStored(null), DEFAULT_CONFIG);
  assert.equal(DEFAULT_CONFIG.showOnBar, false);
  assert.equal(DEFAULT_CONFIG.rainAlert, false);
  assert.equal(DEFAULT_CONFIG.barStyle, "icon");
  assert.deepEqual(
    [DEFAULT_CONFIG.showFeels, DEFAULT_CONFIG.showPop, DEFAULT_CONFIG.showHumidity, DEFAULT_CONFIG.showWind],
    [true, true, false, false],
  );
  assert.deepEqual([DEFAULT_CONFIG.hours, DEFAULT_CONFIG.windUnit, DEFAULT_CONFIG.timeFormat, DEFAULT_CONFIG.rainLeadMinutes], [6, "kmh", "system", 60]);

  const saved = configFromStored({ city: "Hangzhou", units: "fahrenheit", showOnBar: true, rainAlert: false, refreshMinutes: 60, locale: "en" });
  assert.deepEqual([saved.city, saved.units, saved.showOnBar, saved.rainAlert, saved.refreshMinutes], ["Hangzhou", "fahrenheit", true, false, 60]);
  assert.equal(saved.hours, 6);
  assert.equal(saved.version, 2);

  const legacyNoCity = configFromStored({ city: "", units: "celsius", showOnBar: true, rainAlert: true, refreshMinutes: 30, locale: "en" });
  assert.deepEqual([legacyNoCity.showOnBar, legacyNoCity.rainAlert], [false, false]);

  const current = configFromStored({ version: 2, city: "", showOnBar: true, rainAlert: true });
  assert.deepEqual([current.showOnBar, current.rainAlert], [true, true]);

  const clamped = normalizeConfig({ hours: 9, windUnit: "knots", refreshMinutes: 5, quietStart: "25:00", quietEnd: "6:30", barStyle: "text" });
  assert.deepEqual([clamped.hours, clamped.windUnit, clamped.refreshMinutes, clamped.quietStart, clamped.quietEnd, clamped.barStyle], [6, "kmh", 30, "22:00", "06:30", "text"]);
});

test("E66.9 weather display: wind units, clock, weekdays, quiet hours", () => {
  assert.equal(formatWind(18, "kmh", true), "18 km/h");
  assert.equal(formatWind(18, "ms", true), "5.0 m/s");
  assert.equal(formatWind(16.1, "mph", false), "10 mph");
  assert.equal(formatWind(25, "bft", true), "4 级");
  assert.equal(formatWind(25, "bft", false), "Force 4");
  assert.deepEqual([beaufort(0), beaufort(1), beaufort(118), beaufort(200)], [0, 1, 12, 12]);
  assert.equal(formatWind(Number.NaN, "kmh", true), "—");

  assert.equal(formatClock("14:30", false, true), "14:30");
  assert.equal(formatClock("14:30", true, false), "2:30 PM");
  assert.equal(formatClock("00:05", true, true), "上午12:05");

  assert.equal(weekdayOf("2026-11-20"), 5);
  assert.equal(weekdayOf("bad"), -1);
  assert.equal(minutesBetween("2026-11-19T23:30", "2026-11-20T00:15"), 45);

  assert.equal(inQuietHours(at(23), "22:00", "07:00"), true);
  assert.equal(inQuietHours(at(6, 59), "22:00", "07:00"), true);
  assert.equal(inQuietHours(at(7), "22:00", "07:00"), false);
  assert.equal(inQuietHours(at(13), "12:00", "14:00"), true);
  assert.equal(inQuietHours(at(13), "12:00", "12:00"), false);

  assert.equal(geocodeLanguage("杭州"), "zh");
  assert.equal(geocodeLanguage("London"), "en");
});

test("E66.9 rain alert: lead time, quiet hours, cool-down", () => {
  const config = { ...DEFAULT_CONFIG, rainAlert: true };
  const wet = forecast({ soon: [{ time: "2026-11-19T14:15", mm: 0 }, { time: "2026-11-19T15:30", mm: 0.4 }] });
  assert.deepEqual(rainDecision(wet, { ...config, rainAlert: false }, at(14)), { kind: "none" });
  assert.deepEqual(rainDecision(wet, config, at(14)), { kind: "none" });
  assert.deepEqual(rainDecision(wet, { ...config, rainLeadMinutes: 120 }, at(14)), { kind: "alert", time: "2026-11-19T15:30" });
  assert.deepEqual(rainDecision(wet, { ...config, rainLeadMinutes: 120 }, at(14), at(15)), { kind: "none" });
  assert.deepEqual(rainDecision(wet, { ...config, rainLeadMinutes: 120, quietHours: true, quietStart: "13:00", quietEnd: "16:00" }, at(14)), { kind: "none" });
  const raining = forecast({ current: { ...wet.current, mm: 1 }, soon: wet.soon });
  assert.deepEqual(rainDecision(raining, config, at(14)), { kind: "raining" });
});

test("E66.9 weather host: 1.0.0 config kept, settings apply, refresh command registered", async () => {
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
  assert.equal(packed.manifest.version, "1.1.0");
  assert.deepEqual(packed.manifest.fuyu.commands.map((item) => item.id), ["refresh"]);
  assert.equal(packed.manifest.description, packed.manifest.fuyu.description.en);
  const hostDir = join(scratch, "host");
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

  const dataDir = join(hostDir, "data", "@fuyu", "weather");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, "config.json"), JSON.stringify({ city: "Hangzhou", units: "celsius", showOnBar: true, rainAlert: false, refreshMinutes: 60, locale: "zh-CN" }));
  const place = { name: "Hangzhou", region: "Zhejiang", country: "China", latitude: 30.29, longitude: 120.16 };
  writeFileSync(join(dataDir, "cache.json"), JSON.stringify({ city: "Hangzhou", units: "celsius", locale: "zh-CN", place, forecast: forecast(), fetchedAt: Date.now() }));

  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  try {
    host.ctx.services.provide(messagesV1, {
      sources: async () => ({ sources: [] }),
      notify: async () => ({ shown: true, receivedAt: Date.now() }),
      clear: async () => ({ ok: true }),
    });
    await host.settle();
    assert.equal(host.status().find((item) => item.id === "@fuyu/weather")?.state, "running");
    const call = (method, params) => host.ctx.clients.call("@fuyu/weather", method, params);

    const first = await call("getState");
    assert.deepEqual([first.config.showOnBar, first.config.rainAlert, first.config.refreshMinutes], [true, false, 60]);
    assert.equal(first.place.name, "Hangzhou");
    assert.equal(first.forecast.hourly.length, 24);

    const next = await call("setConfig", { windUnit: "bft", hours: 12, showHumidity: true });
    assert.deepEqual([next.config.windUnit, next.config.hours, next.config.showHumidity, next.config.showOnBar], ["bft", 12, true, true]);
    assert.ok(next.forecast);
    const saved = JSON.parse(readFileSync(join(dataDir, "config.json"), "utf8"));
    assert.deepEqual([saved.version, saved.windUnit, saved.showOnBar, saved.city], [2, "bft", true, "Hangzhou"]);
    assert.equal("locale" in saved, false);

    let commands;
    await host.ctx.plugin({
      name: "e66-weather-inspector",
      apply(ctx) {
        commands = ctx.services.get(commandsV1);
      },
    });
    const own = (await commands.list()).items.filter((item) => item.pluginId === "@fuyu/weather");
    assert.deepEqual(own.map((item) => [item.id, item.active]), [["refresh", true]]);
    assert.equal(own[0].title["zh-CN"], "立即刷新天气");

    const cleared = await call("setConfig", { city: "" });
    assert.equal(cleared.forecast, null);
    assert.equal(cleared.problem, null);
  } finally {
    await host.stop();
  }
});
