import assert from "node:assert/strict";
import { test } from "node:test";
import { searchPlacesMulti } from "../../plugins/v3/official/weather/src/geocoding.ts";
import { fetchMetNo, metNoSymbolToWmo } from "../../plugins/v3/official/weather/src/providerMetNo.ts";
import { fetchNmc, nmcTextToWmo } from "../../plugins/v3/official/weather/src/providerNmc.ts";
import { fetchWttr, wwoCodeToWmo } from "../../plugins/v3/official/weather/src/providerWttr.ts";
import { fetchWeatherWithFallback, isChinaPlace, sourceChain } from "../../plugins/v3/official/weather/src/sources.ts";

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

const zhenyuan = {
  id: "27.0493,108.4272",
  name: "镇远",
  region: "贵州省",
  country: "中国",
  countryCode: "CN",
  latitude: 27.0493,
  longitude: 108.4272,
  timezone: "Asia/Shanghai",
};

const london = {
  id: "51.5074,-0.1278",
  name: "London",
  region: "England",
  country: "United Kingdom",
  countryCode: "GB",
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: "Europe/London",
};

test("dual geocoding merges Photon and Open-Meteo so Chinese counties like Zhenyuan rank first", async () => {
  const fetcher = async (url) => {
    const href = String(url);
    if (href.includes("photon.komoot.io")) {
      return jsonResponse({
        features: [
          {
            geometry: { coordinates: [108.4253, 27.0522] },
            properties: { name: "镇远县", state: "贵州省", country: "中国", countrycode: "CN", osm_key: "boundary", osm_value: "administrative" },
          },
          {
            geometry: { coordinates: [108.4073, 27.0401] },
            properties: { name: "镇远", state: "贵州省", country: "中国", countrycode: "CN", osm_key: "place", osm_value: "town" },
          },
        ],
      });
    }
    return jsonResponse({
      results: [
        { name: "镇远", admin1: "海南", country: "中国", country_code: "CN", latitude: 18.5236, longitude: 108.7728, timezone: "Asia/Shanghai" },
      ],
    });
  };
  const results = await searchPlacesMulti("镇远", fetcher);
  assert.equal(results.length, 2);
  assert.equal(results[0].region, "贵州省");
  assert.equal(results[1].region, "海南");
});

test("sourceChain orders NMC first for China and Open-Meteo first globally, respecting autoFallback", () => {
  assert.equal(isChinaPlace(zhenyuan), true);
  assert.equal(isChinaPlace(london), false);
  assert.deepEqual(sourceChain("auto", zhenyuan, true), ["nmc", "open-meteo-cma", "metno", "open-meteo", "wttr"]);
  assert.deepEqual(sourceChain("auto", london, true), ["open-meteo", "metno", "wttr", "open-meteo-cma"]);
  assert.deepEqual(sourceChain("metno", zhenyuan, false), ["metno"]);
  assert.deepEqual(sourceChain("metno", london, true).slice(0, 2), ["metno", "open-meteo"]);
});

test("NMC parser resolves province station, strips 9999 sentinels, and converts wind/temp units", async () => {
  assert.deepEqual([nmcTextToWmo("晴"), nmcTextToWmo("雷阵雨"), nmcTextToWmo("冻雨"), nmcTextToWmo("大雪")], [0, 95, 66, 75]);
  const fetcher = async (url) => {
    const href = String(url);
    if (href.endsWith("/rest/province")) return jsonResponse([{ code: "AGZ", name: "贵州省" }]);
    if (href.endsWith("/rest/province/AGZ")) return jsonResponse([{ code: "FqHqg", province: "贵州省", city: "镇远" }]);
    return jsonResponse({
      data: {
        real: {
          publish_time: "2026-11-25 02:55",
          weather: { temperature: 8.3, feelst: 7.5, humidity: 85, rain: 0, info: "-" },
          wind: { speed: 1.0 },
          sunriseSunset: { sunrise: "2026-11-25 07:13", sunset: "2026-11-25 17:52" },
        },
        predict: {
          detail: [
            { date: "2026-11-24", day: { weather: { info: "9999", temperature: "9999" } }, night: { weather: { info: "阴", temperature: "8" } }, precipitation: 0 },
            { date: "2026-11-25", day: { weather: { info: "多云", temperature: "16" } }, night: { weather: { info: "阴", temperature: "4" } }, precipitation: 0 },
          ],
        },
        air: { aqi: 36, forecasttime: "2026-11-25 02:00" },
      },
    });
  };
  const res = await fetchNmc(zhenyuan, "celsius", fetcher);
  assert.equal(res.stationId, "FqHqg");
  assert.equal(res.forecast.current.temp, 8.3);
  assert.equal(res.forecast.current.code, 2);
  assert.equal(res.forecast.current.wind, 3.6);
  assert.equal(res.forecast.daily.length, 1);
  assert.deepEqual([res.forecast.daily[0].date, res.forecast.daily[0].min, res.forecast.daily[0].max], ["2026-11-25", 4, 16]);
  assert.equal(res.aqi.usAqi, 36);
});

test("MET Norway and wttr.in parsers convert codes, units, hourly and daily forecasts", async () => {
  assert.deepEqual([metNoSymbolToWmo("clearsky_day"), metNoSymbolToWmo("heavyrainthunder_night"), metNoSymbolToWmo("fog")], [0, 95, 45]);
  assert.deepEqual([wwoCodeToWmo(113), wwoCodeToWmo(308), wwoCodeToWmo(389)], [0, 65, 95]);

  const met = await fetchMetNo(zhenyuan, "celsius", async () =>
    jsonResponse({
      properties: {
        timeseries: [
          {
            time: "2026-11-24T19:00:00Z",
            data: {
              instant: { details: { air_temperature: 8.4, relative_humidity: 70, wind_speed: 2 } },
              next_1_hours: { summary: { symbol_code: "partlycloudy_night" }, details: { precipitation_amount: 0 } },
            },
          },
          {
            time: "2026-11-24T20:00:00Z",
            data: {
              instant: { details: { air_temperature: 12.0, relative_humidity: 65, wind_speed: 3 } },
              next_1_hours: { summary: { symbol_code: "lightrain_day" }, details: { precipitation_amount: 0.6 } },
            },
          },
        ],
      },
    }),
  );
  assert.equal(met.now, "2026-11-25T03:00");
  assert.equal(met.current.temp, 8.4);
  assert.equal(met.current.day, 0);
  assert.equal(met.daily[0].min, 8.4);
  assert.equal(met.daily[0].max, 12);
  assert.equal(met.soon[1].mm, 0.6);

  const wttr = await fetchWttr(zhenyuan, "fahrenheit", async () =>
    jsonResponse({
      current_condition: [{ temp_C: "10", FeelsLikeC: "8", humidity: "70", windspeedKmph: "12", weatherCode: "119", precipMM: "0.0", uvIndex: "3" }],
      weather: [
        {
          date: "2026-11-25",
          mintempC: "5",
          maxtempC: "15",
          uvIndex: "4",
          astronomy: [{ sunrise: "07:13 AM", sunset: "05:52 PM" }],
          hourly: [{ time: "2100", tempC: "10", chanceofrain: "20", weatherCode: "119", windspeedKmph: "12", precipMM: "0", uvIndex: "1" }],
        },
      ],
    }),
  );
  assert.equal(wttr.current.temp, 50);
  assert.equal(wttr.daily[0].sunrise, "2026-11-25T07:13");
  assert.equal(wttr.daily[0].sunset, "2026-11-25T17:52");
});

test("fetchWeatherWithFallback switches automatically on failure and reports fallbackFrom, or throws when disabled", async () => {
  const metOnly = async (url) => {
    const href = String(url);
    if (href.includes("api.met.no")) {
      return jsonResponse({
        properties: {
          timeseries: [
            {
              time: "2026-11-24T19:00:00Z",
              data: {
                instant: { details: { air_temperature: 9, relative_humidity: 60, wind_speed: 2 } },
                next_1_hours: { summary: { symbol_code: "clearsky_day" }, details: { precipitation_amount: 0 } },
              },
            },
          ],
        },
      });
    }
    throw new Error("primary down");
  };

  const switched = await fetchWeatherWithFallback(london, "celsius", "open-meteo", true, metOnly);
  assert.equal(switched.sourceUsed, "metno");
  assert.equal(switched.fallbackFrom, "open-meteo");
  assert.equal(switched.forecast.current.temp, 9);

  await assert.rejects(
    () => fetchWeatherWithFallback(london, "celsius", "open-meteo", false, metOnly),
    /open-meteo: primary down/,
  );
});
