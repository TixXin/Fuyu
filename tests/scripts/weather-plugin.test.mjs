import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { startMockHost } from "../../packages/fuyu-plugin/src/test/index.mjs";

const PLUGIN = path.resolve("plugins/examples/dev.focusd.weather");
const windowsOnly = { skip: process.platform !== "win32" };

const PLACES = [
  { name: "Springfield", latitude: 37.21, longitude: -93.29, country: "United States", country_code: "US", admin1: "Missouri" },
  { name: "Springfield", latitude: 39.8, longitude: -89.64, country: "United States", country_code: "US", admin1: "Illinois" },
];

function series(start, count, stepMinutes, value) {
  const times = [];
  const values = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(2026, 10, 13) + (start + i * stepMinutes) * 60000);
    times.push(date.toISOString().slice(0, 16));
    values.push(value(i));
  }
  return { times, values };
}

function forecast() {
  const hours = series(0, 168, 60, (i) => 10 + (i % 24));
  const quarters = series(14 * 60, 12, 15, (i) => (i === 2 ? 0.4 : 0));
  return {
    current: { time: "2026-11-13T14:15", temperature_2m: 18.4, apparent_temperature: 16.2, relative_humidity_2m: 61, weather_code: 2, is_day: 1, wind_speed_10m: 11.6, precipitation: 0 },
    hourly: {
      time: hours.times,
      temperature_2m: hours.values,
      precipitation_probability: hours.values.map((v) => v * 2),
      weather_code: hours.values.map(() => 61),
      is_day: hours.values.map(() => 1),
    },
    daily: {
      time: ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"],
      weather_code: [2, 3, 61, 0, 1, 71, 95],
      temperature_2m_max: [21, 19, 15, 17, 20, 8, 12],
      temperature_2m_min: [12, 11, 9, 7, 10, 1, 5],
      precipitation_probability_max: [10, 20, 80, 0, 5, 60, 90],
    },
    minutely_15: { time: quarters.times, precipitation: quarters.values },
  };
}

async function fakeOpenMeteo() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    requests.push(url);
    if (server.failing) {
      response.writeHead(503).end();
      return;
    }
    const body = url.pathname === "/v1/search" ? { results: PLACES } : forecast();
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, requests, base: `http://127.0.0.1:${server.address().port}` };
}

test("the PowerShell scripts are plain ASCII, so Windows PowerShell reads them the same under any code page", () => {
  for (const file of ["main.ps1", "lib/fuyu.ps1"]) {
    const bytes = readFileSync(path.join(PLUGIN, file));
    assert.equal(bytes.findIndex((byte) => byte > 0x7f), -1, file);
  }
});

test("without a city the plugin stays offline and the page asks for one", windowsOnly, async () => {
  const fake = await fakeOpenMeteo();
  process.env.FUYU_WEATHER_API = fake.base;
  const host = startMockHost(PLUGIN, { settings: { showOnBar: true, rainAlert: true }, storage: { locale: "en" }, timeoutMs: 30000 });
  try {
    host.viewVisible("weather", true);
    host.webviewMessage("weather", { type: "ready", locale: "en" });
    const page = (await host.waitFor((h) => h.webviewMessages[0])).message;
    assert.equal(page.city, "");
    assert.equal(page.forecast, undefined);
    assert.equal(fake.requests.length, 0);
    assert.equal(host.statuses.has("now"), false);
    assert.equal(host.keepAlive, null);
  } finally {
    await host.stop();
    fake.server.close();
    delete process.env.FUYU_WEATHER_API;
  }
});

test("a city fills the bar, the page and the rain heads-up, and a failed refresh keeps the last result", windowsOnly, async () => {
  const fake = await fakeOpenMeteo();
  process.env.FUYU_WEATHER_API = fake.base;
  const settings = { city: "Springfield, Illinois", showOnBar: true, rainAlert: true };
  const host = startMockHost(PLUGIN, { settings, storage: { locale: "zh-CN" }, timeoutMs: 30000 });
  try {
    const bar = await host.waitFor((h) => h.statuses.get("now"));
    assert.equal(bar.text, "多云 18°");
    assert.deepEqual(bar.cells, [{ label: "多云", value: "18°" }]);
    assert.equal(fake.requests[0].searchParams.get("name"), "Springfield");
    assert.equal(fake.requests[0].searchParams.get("language"), "zh");
    assert.equal(fake.requests[1].searchParams.get("latitude"), "39.8");
    const rain = await host.waitFor((h) => h.notifications[0]);
    await host.waitFor((h) => h.keepAlive === "在收起条上显示天气");
    assert.equal(rain.title, "快要下雨了");
    assert.equal(rain.body, "Springfield 约 14:30 开始下雨，记得带伞");
    assert.match(JSON.stringify(host.info), /Illinois/);

    host.viewVisible("weather", true);
    host.webviewMessage("weather", { type: "ready", locale: "zh-CN" });
    const page = (await host.waitFor((h) => h.webviewMessages.find((m) => m.message.forecast))).message;
    assert.equal(page.place.region, "Illinois");
    assert.equal(page.forecast.hourly.length, 24);
    assert.equal(page.forecast.hourly[0].time, "2026-11-13T14:00");
    assert.equal(page.forecast.daily.length, 7);
    assert.equal(fake.requests.length, 2);

    fake.server.failing = true;
    const before = host.webviewMessages.length;
    host.webviewMessage("weather", { type: "refresh" });
    const failed = (await host.waitFor((h) => h.webviewMessages.slice(before).find((m) => m.message.problem))).message;
    assert.match(failed.problem, /联网失败/);
    assert.equal(failed.forecast.current.temp, 18.4);
    assert.equal(host.notifications.length, 1);

    host.changeSettings({ showOnBar: false });
    await host.waitFor((h) => !h.statuses.has("now") && h.keepAlive === null);
  } finally {
    await host.stop();
    fake.server.close();
    delete process.env.FUYU_WEATHER_API;
  }
});
