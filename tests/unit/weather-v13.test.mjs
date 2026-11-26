import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { EXTREME_QUIET_MS, extremeDecision } from "../../plugins/v3/official/weather/src/alerts.ts";
import { DEFAULT_CONFIG, MAX_CITIES, coordsId } from "../../plugins/v3/official/weather/src/config.ts";
import { aqiInfo, convertForecastUnits, placeLine, tempRangeBar, uvLevel } from "../../plugins/v3/official/weather/src/format.ts";
import { apply } from "../../plugins/v3/official/weather/src/host.ts";
import { searchPlaces } from "../../plugins/v3/official/weather/src/openMeteo.ts";

const scratch = mkdtempSync(join(tmpdir(), "fuyu-weather-v13-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const at = (hh, mm = 0) => new Date(2026, 10, 19, hh, mm).getTime();

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    url: "",
    headers: {},
    text: async () => JSON.stringify(body),
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function fakeContext(label, options = {}) {
  const dataDir = join(scratch, label);
  mkdirSync(dataDir, { recursive: true });
  const handlers = new Map();
  const notices = [];
  const ctx = {
    dataDir,
    clients: { handle: (method, fn) => handlers.set(method, fn), publish: () => {} },
    commands: { register: () => {} },
    services: {
      get: () => ({
        notify: async (notice) => {
          notices.push(notice);
          return { shown: true };
        },
      }),
    },
    setInterval: () => async () => {},
  };
  if (options.settings) ctx.settings = options.settings;
  if (options.http) ctx.http = options.http;
  return { ctx, notices, call: (method, params) => handlers.get(method)(params) };
}

function forecast(over = {}) {
  return {
    now: "2026-11-19T14:00",
    current: { temp: 18, feels: 17, humidity: 62, wind: 11, code: 2, day: 1, mm: 0, uv: 4 },
    hourly: Array.from({ length: 24 }, (_, i) => ({
      time: `2026-11-19T${String((14 + i) % 24).padStart(2, "0")}:00`,
      temp: 18,
      pop: 10,
      code: 2,
      day: 1,
      wind: 12,
      uv: 3,
    })),
    daily: [{ date: "2026-11-19", code: 2, max: 19, min: 12, pop: 10 }],
    soon: [],
    ...over,
  };
}

function openMeteoBody(temp = 20, code = 2, wind = 12) {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = 14 + i;
    const day = h < 24 ? "2026-11-19" : "2026-11-20";
    return `${day}T${String(h % 24).padStart(2, "0")}:00`;
  });
  return {
    current: {
      time: "2026-11-19T14:00",
      temperature_2m: temp,
      apparent_temperature: temp - 1,
      relative_humidity_2m: 60,
      weather_code: code,
      is_day: 1,
      wind_speed_10m: wind,
      precipitation: 0,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => temp),
      precipitation_probability: hours.map(() => 10),
      weather_code: hours.map(() => code),
      is_day: hours.map(() => 1),
      wind_speed_10m: hours.map(() => wind),
      uv_index: hours.map(() => 4),
    },
    daily: {
      time: ["2026-11-19", "2026-11-20"],
      weather_code: [code, 0],
      temperature_2m_max: [temp + 2, temp + 3],
      temperature_2m_min: [temp - 5, temp - 4],
      precipitation_probability_max: [20, 5],
      sunrise: ["2026-11-19T06:28", "2026-11-20T06:29"],
      sunset: ["2026-11-19T17:04", "2026-11-20T17:03"],
      uv_index_max: [5, 5],
    },
    minutely_15: {
      time: ["2026-11-19T14:00", "2026-11-19T14:15"],
      precipitation: [0, 0],
    },
  };
}

test("weather v1.3 formatters: range bar, place verification line, AQI/UV labels and unit conversion", () => {
  assert.deepEqual(tempRangeBar(10, 20, 10, 30), { left: 0, width: 50 });
  assert.deepEqual(tempRangeBar(15, 15, 15, 15), { left: 0, width: 100 });
  assert.equal(placeLine({ name: "杭州", region: "浙江", country: "中国" }), "杭州 · 浙江 · 中国");
  assert.equal(placeLine({ name: "Singapore", region: "Singapore", country: "Singapore" }), "Singapore");
  assert.deepEqual(aqiInfo(38, true), { tone: "good", label: "优" });
  assert.deepEqual(aqiInfo(128, false), { tone: "sensitive", label: "Sensitive" });
  assert.equal(uvLevel(2, true), "弱");
  assert.equal(uvLevel(8, false), "Very high");

  const cForecast = forecast({ current: { ...forecast().current, temp: 0, feels: 10 } });
  const fForecast = convertForecastUnits(cForecast, "celsius", "fahrenheit");
  assert.equal(fForecast.current.temp, 32);
  assert.equal(fForecast.current.feels, 50);
  const back = convertForecastUnits(fForecast, "fahrenheit", "celsius");
  assert.equal(back.current.temp, 0);
  assert.equal(back.current.feels, 10);
});

test("weather v1.3 extreme weather alerts: priority, quiet hours, and per-hazard cool-down", () => {
  const config = { ...DEFAULT_CONFIG, extremeAlert: true };
  assert.deepEqual(extremeDecision(forecast(), config, at(14)), { kind: "none" });

  const windyAndStorm = forecast({
    current: { ...forecast().current, wind: 70 },
    hourly: [
      { time: "2026-11-19T15:00", temp: 16, pop: 80, code: 95, day: 1, wind: 75 },
      ...forecast().hourly.slice(1),
    ],
  });
  assert.deepEqual(extremeDecision(windyAndStorm, { ...config, extremeAlert: false }, at(14)), { kind: "none" });
  assert.deepEqual(extremeDecision(windyAndStorm, config, at(14)), {
    kind: "alert",
    hazard: "storm",
    now: false,
    time: "2026-11-19T15:00",
    windKmh: undefined,
  });
  assert.deepEqual(extremeDecision(windyAndStorm, config, at(14), { storm: at(14) + EXTREME_QUIET_MS }), {
    kind: "alert",
    hazard: "highWind",
    now: true,
    time: "2026-11-19T14:00",
    windKmh: 70,
  });
  assert.deepEqual(
    extremeDecision(windyAndStorm, { ...config, quietHours: true, quietStart: "13:00", quietEnd: "16:00" }, at(14)),
    { kind: "none" },
  );
});

test("weather v1.3 candidate search prioritizes region hint matches and deduplicates coordinates", async () => {
  const seenUrls = [];
  const fakeFetch = async (url) => {
    seenUrls.push(String(url));
    return jsonResponse({
      results: [
        { name: "Springfield", admin1: "Missouri", country: "United States", latitude: 37.2153, longitude: -93.2982 },
        { name: "Springfield", admin1: "Illinois", country: "United States", latitude: 39.7817, longitude: -89.6501 },
        { name: "Springfield", admin1: "Illinois", country: "United States", latitude: 39.7817, longitude: -89.6501 },
      ],
    });
  };
  const results = await searchPlaces("Springfield, Illinois", fakeFetch);
  assert.equal(results.length, 2);
  assert.equal(results[0].region, "Illinois");
  assert.equal(results[1].region, "Missouri");
  assert.match(seenUrls[0], /language=en/);
});

test("weather v1.3 host: multi-city, controlled http, opt-in AQI, offline unit switch, and extreme alert", async () => {
  const fetched = [];
  let offline = false;
  let stormMode = false;

  const http = {
    fetch: async (url) => {
      const href = String(url);
      fetched.push(href);
      if (offline) throw new Error("network down");
      if (href.includes("www.nmc.cn")) {
        throw new Error("nmc unavailable in unit mock");
      }
      if (href.includes("air-quality-api.open-meteo.com")) {
        return jsonResponse({ current: { time: "2026-11-19T14:00", us_aqi: 48, pm2_5: 11.2, pm10: 20.1 } });
      }
      if (href.includes("latitude=35.6762")) {
        return jsonResponse(openMeteoBody(15, 0, 10));
      }
      return jsonResponse(openMeteoBody(20, stormMode ? 95 : 2, 12));
    },
  };

  const reports = [];
  const { ctx, notices, call } = fakeContext("multi", {
    http,
    settings: { setup: async (state) => void reports.push(state) },
  });
  apply(ctx);
  assert.equal(reports.at(-1).needed, false);

  const hangzhou = {
    id: coordsId(30.2937, 120.1614),
    name: "杭州",
    region: "浙江",
    country: "中国",
    latitude: 30.2937,
    longitude: 120.1614,
  };
  const tokyo = {
    id: coordsId(35.6762, 139.6503),
    name: "Tokyo",
    region: "Tokyo",
    country: "Japan",
    latitude: 35.6762,
    longitude: 139.6503,
  };

  const s1 = await call("addCity", { place: hangzhou });
  assert.equal(s1.place.name, "杭州");
  assert.equal(s1.forecast.current.temp, 20);
  assert.equal(s1.aqi, null);
  assert.equal(
    fetched.some((u) => u.includes("air-quality-api.open-meteo.com")),
    false,
    "AQI endpoint stays untouched while showAqi is off",
  );
  assert.equal(reports.at(-1).needed, false);

  const s2 = await call("addCity", { place: tokyo });
  assert.equal(s2.config.cities.length, 2);
  assert.equal(s2.place.name, "Tokyo");
  assert.equal(s2.forecast.current.temp, 15);
  assert.equal(s2.primaryPlace.name, "杭州");
  assert.equal(s2.primaryForecast.current.temp, 20);

  offline = true;
  const converted = await call("setConfig", { units: "fahrenheit" });
  assert.equal(converted.config.units, "fahrenheit");
  assert.equal(converted.forecast.current.temp, 59);
  assert.equal(converted.primaryForecast.current.temp, 68);
  assert.equal(converted.problem, null);

  offline = false;
  await call("setConfig", { units: "celsius" });
  const withAqi = await call("setConfig", { showAqi: true });
  assert.equal(withAqi.aqi.usAqi, 48);
  assert.equal(fetched.some((u) => u.includes("air-quality-api.open-meteo.com")), true);

  await call("selectCity", { id: hangzhou.id });
  stormMode = true;
  await call("setConfig", { extremeAlert: true });
  await call("refresh");
  assert.equal(notices.length, 1);
  assert.match(notices[0].body, /杭州/);

  const promoted = await call("setPrimaryCity", { id: tokyo.id });
  assert.equal(promoted.config.cities[0].id, tokyo.id);
  assert.equal(promoted.primaryPlace.name, "Tokyo");

  for (let i = 0; i < MAX_CITIES + 2; i += 1) {
    await call("addCity", {
      place: { name: `City${i}`, region: "", country: "", latitude: 10 + i, longitude: 20 + i },
    });
  }
  const capped = await call("getState");
  assert.equal(capped.config.cities.length, MAX_CITIES);

  for (const city of capped.config.cities) {
    await call("removeCity", { id: city.id });
  }
  assert.equal(reports.at(-1).needed, true);
});
