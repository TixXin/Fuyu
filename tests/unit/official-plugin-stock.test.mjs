import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { check } from "../../packages/plugin-cli/src/index.mjs";
import { apply } from "../../plugins/v3/official/stock/src/host.ts";
import { isSessionTime, looksLikeHoliday, nextOpenAt } from "../../plugins/v3/official/stock/src/market.ts";
import { METHODS, displayCode, formatPercent, normalizeSettings } from "../../plugins/v3/official/stock/src/model.ts";
import { parseEastmoney, parseSearch, parseTencent, tencentSymbol } from "../../plugins/v3/official/stock/src/sources.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/stock", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-stock-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const realFetch = globalThis.fetch;
const realNow = Date.now;
afterEach(() => {
  globalThis.fetch = realFetch;
  Date.now = realNow;
});

const EASTMONEY_BODY = JSON.stringify({
  rc: 0,
  data: {
    total: 4,
    diff: [
      { f2: 1464.73, f3: -0.69, f4: -10.11, f12: "600519", f13: 1, f14: "贵州茅台", f124: 1795657545 },
      { f2: 338.4, f3: 0.3, f4: 1.0, f12: "00700", f13: 116, f14: "腾讯控股", f124: 1795657546 },
      { f2: 355.58, f3: 0.43, f4: 1.51, f12: "AAPL", f13: 105, f14: "苹果", f124: 1795640400 },
      { f2: "-", f3: "-", f4: "-", f12: "000002", f13: 0, f14: "万科A", f124: 1795600000 },
    ],
  },
});

const TENCENT_BODY = [
  'v_sh600519="1~贵州茅台~600519~1464.02~1474.84~1470.00~6038~2900~3135~1464.00~2~1463.97~5~1463.94~6~1463.70~2~1463.56~1~1464.73~4~1465.06~2~1465.09~1~1465.10~10~1465.11~1~~20261126094539~-10.82~-0.73~1470.00";',
  'v_hk00700="100~腾讯控股~00700~341.000~337.400~344.800~1527668.0~0~0~341.000~0~0~0~0~0~0~0~0~0~341.000~0~0~0~0~0~0~0~0~0~1527668.0~2026/11/26 09:30:40~3.600~1.07~345.800";',
  'v_usAAPL="200~苹果~AAPL.OQ~355.58~354.07~353.48~54285255~0~0~354.90~80~0~0~0~0~0~0~0~0~355.20~40~0~0~0~0~0~0~0~0~~2026-11-25 16:00:02~1.51~0.43~356.75";',
].join("\n");

const at = (iso) => Date.parse(iso);

test("Eastmoney batch quotes: ids join market and code, a suspended stock has no price instead of a zero", () => {
  const quotes = Object.fromEntries(parseEastmoney(EASTMONEY_BODY).map((quote) => [quote.id, quote]));
  assert.deepEqual(quotes["1.600519"], { id: "1.600519", price: 1464.73, change: -10.11, percent: -0.69, time: 1795657545000 });
  assert.equal(quotes["116.00700"].price, 338.4);
  assert.equal(quotes["105.AAPL"].percent, 0.43);
  assert.deepEqual(quotes["0.000002"], { id: "0.000002", price: null, change: null, percent: null, time: 1795600000000 });
  assert.deepEqual(parseEastmoney(JSON.stringify({ rc: 0, data: null })), []);
});

test("Tencent fallback reads the numbers after the code, and its local times land on the right instant", () => {
  const ids = ["1.600519", "116.00700", "105.AAPL"];
  const quotes = Object.fromEntries(parseTencent(TENCENT_BODY, ids).map((quote) => [quote.id, quote]));
  assert.deepEqual(quotes["1.600519"], { id: "1.600519", price: 1464.02, change: -10.82, percent: -0.73, time: at("2026-11-26T09:45:39+08:00") });
  assert.equal(quotes["116.00700"].time, at("2026-11-26T09:30:40+08:00"));
  assert.equal(quotes["116.00700"].percent, 1.07);
  assert.equal(quotes["105.AAPL"].time, at("2026-11-25T16:00:02-05:00"));
  assert.equal(quotes["105.AAPL"].change, 1.51);
  const shifted = TENCENT_BODY.replace("1~贵州茅台~600519", "1~贵州~茅台~600519");
  assert.equal(parseTencent(shifted, ids).find((quote) => quote.id === "1.600519").price, 1464.02);
});

test("quote ids map to Tencent symbols and readable codes", () => {
  assert.equal(tencentSymbol("1.600519"), "sh600519");
  assert.equal(tencentSymbol("0.000001"), "sz000001");
  assert.equal(tencentSymbol("0.830799"), "bj830799");
  assert.equal(tencentSymbol("116.00700"), "hk00700");
  assert.equal(tencentSymbol("106.BRK_B"), "usBRK.B");
  assert.equal(tencentSymbol("124.HSTECH"), null);
  assert.equal(displayCode({ id: "1.600519", code: "600519", name: "", kind: "" }), "SH600519");
  assert.equal(displayCode({ id: "116.00700", code: "00700", name: "", kind: "" }), "HK00700");
  assert.equal(formatPercent(-0.7), "−0.70%");
  assert.equal(formatPercent(1.5), "+1.50%");
});

test("search results keep the quote id, skip duplicates and rows without one", () => {
  const body = JSON.stringify({
    QuotationCodeTable: {
      Data: [
        { Code: "00700", Name: "腾讯控股", QuoteID: "116.00700", SecurityTypeName: "港股" },
        { Code: "00700", Name: "腾讯控股", QuoteID: "116.00700", SecurityTypeName: "港股" },
        { Code: "X", Name: "broken", QuoteID: "" },
      ],
    },
  });
  assert.deepEqual(parseSearch(body), [{ id: "116.00700", code: "00700", name: "腾讯控股", kind: "港股" }]);
  assert.deepEqual(parseSearch(JSON.stringify({ QuotationCodeTable: { Data: null } })), []);
});

test("trading hours follow each exchange's own clock, lunch breaks, weekends and US daylight saving", () => {
  assert.equal(isSessionTime("cn", at("2026-11-26T10:00:00+08:00")), true);
  assert.equal(isSessionTime("cn", at("2026-11-26T12:00:00+08:00")), false);
  assert.equal(isSessionTime("cn", at("2026-11-28T10:00:00+08:00")), false);
  assert.equal(isSessionTime("hk", at("2026-11-26T16:05:00+08:00")), true);
  assert.equal(isSessionTime("us", at("2026-07-15T09:45:00-04:00")), true);
  assert.equal(isSessionTime("us", at("2026-11-25T09:45:00-05:00")), true);
  assert.equal(isSessionTime("us", at("2026-11-25T16:30:00-05:00")), false);
  assert.equal(nextOpenAt(new Set(["cn"]), at("2026-11-27T15:30:00+08:00")), at("2026-11-30T09:15:00+08:00"));
  assert.equal(nextOpenAt(new Set(["us"]), at("2026-11-26T10:00:00+08:00")), at("2026-11-26T09:30:00-05:00"));
});

test("a weekday whose quotes are still from yesterday half an hour after the open counts as a holiday", () => {
  const yesterday = [{ id: "1.600519", price: 1, change: 0, percent: 0, time: at("2026-11-25T15:00:00+08:00") }];
  assert.equal(looksLikeHoliday("cn", at("2026-11-26T09:30:00+08:00"), yesterday), false);
  assert.equal(looksLikeHoliday("cn", at("2026-11-26T10:00:00+08:00"), yesterday), true);
  const today = [{ ...yesterday[0], time: at("2026-11-26T09:59:00+08:00") }];
  assert.equal(looksLikeHoliday("cn", at("2026-11-26T10:00:00+08:00"), today), false);
});

test("settings keep valid stocks only, without duplicates, and fall back to defaults", () => {
  const settings = normalizeSettings({
    stocks: [{ id: "1.600519", name: "贵州茅台" }, { id: "1.600519" }, { id: "nope" }, null],
    refreshSeconds: 7,
    colorScheme: "greenUp",
  });
  assert.deepEqual(settings.stocks, [{ id: "1.600519", code: "600519", name: "贵州茅台", kind: "" }]);
  assert.equal(settings.refreshSeconds, 30);
  assert.equal(settings.colorScheme, "greenUp");
  assert.equal(settings.showInBar, true);
});

function fakeContext(dataDir) {
  const handlers = new Map();
  const timers = [];
  const ctx = {
    dataDir,
    clients: { handle: (method, fn) => handlers.set(method, fn), publish: () => {} },
    commands: { register: () => {} },
    setTimeout: (fn, ms) => {
      timers.push(ms);
      return async () => {};
    },
  };
  return { ctx, call: (method, params) => handlers.get(method)(params), timers };
}

test("offline keeps the last quotes and backs off; with every market closed nothing is scheduled until the open", async () => {
  Date.now = () => at("2026-11-26T10:00:00+08:00");
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(EASTMONEY_BODY, { status: 200 });
  };
  const { ctx, call, timers } = fakeContext(join(scratch, "offline"));
  apply(ctx);
  await call(METHODS.addStock, { stock: { id: "1.600519", code: "600519", name: "贵州茅台", kind: "沪A" } });
  let state = await call(METHODS.refresh);
  assert.equal(state.status, "live");
  assert.equal(state.quotes["1.600519"].price, 1464.73);
  assert.equal(timers.at(-1), 30_000);

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  state = await call(METHODS.refresh);
  assert.equal(state.status, "offline");
  assert.equal(state.quotes["1.600519"].price, 1464.73);
  assert.equal(timers.at(-1), 60_000);
  state = await call(METHODS.refresh);
  assert.equal(timers.at(-1), 120_000);

  Date.now = () => at("2026-11-27T15:30:00+08:00");
  state = await call(METHODS.refresh);
  assert.equal(state.status, "closed");
  assert.equal(state.quotes["1.600519"].price, 1464.73);
  assert.equal(timers.at(-1), 6 * 60 * 60_000);
  assert.equal(requests, 1);
});

test("the stock plugin passes the official market check with no warnings", async () => {
  const result = await check(PLUGIN_DIR, { official: true, market: true, allowExperimental: false });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});
