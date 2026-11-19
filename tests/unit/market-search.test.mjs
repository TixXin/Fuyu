import assert from "node:assert/strict";
import test from "node:test";
import { loadPinyin } from "../../src/lib/pinyin/pinyin.ts";
import { FEW_SETTINGS_RESULTS, marketSearchRank, marketSuggestions, matchesQuery, queryWantsPinyin, searchMarket } from "../../src/windows/settings/marketSearch.ts";

const plugin = (name, zh, en, more = {}) => ({
  name, official: name.startsWith("@fuyu/"), publisher: { github: name.split("/")[0].replace("@", ""), official: false },
  displayName: { "zh-CN": zh, en }, description: { "zh-CN": "", en: "" }, categories: ["utilities"],
  installedVersion: null, enabled: false, source: null, revoked: false, install: null, manual: null, autoUpdate: null, ...more,
});
const weather = plugin("@fuyu/weather", "天气", "Weather", { description: { "zh-CN": "在岛上看现在的天气和未来几天的预报", en: "Current weather on the island" } });
const countdown = plugin("@fuyu/countdown", "倒数日", "Day counter", { keywords: ["倒计时", "纪念日", "anniversary"], description: { "zh-CN": "记着生日和截止日", en: "Keeps track of birthdays" } });
const pomodoro = plugin("@fuyu/pomodoro", "番茄钟", "Pomodoro", { description: { "zh-CN": "专注 25 分钟，晴天雨天都一样", en: "Focus for 25 minutes" } });
const all = [pomodoro, countdown, weather];
const names = (query, pinyin = null) => searchMarket(all, query, {}, pinyin).map((item) => item.name);

test("search matches names, publishers and the shown category name, ignoring case, spaces and dashes", () => {
  const rss = plugin("@fuyu/rss", "RSS 订阅", "RSS reader", { categories: ["information"], publisher: { github: "TixXin", official: true } });
  assert.equal(matchesQuery(rss, "rssreader"), true);
  assert.equal(matchesQuery(rss, "RSS-Reader"), true);
  assert.equal(matchesQuery(rss, "资讯", { information: "资讯" }), true);
  assert.equal(matchesQuery(rss, "tixxin"), true);
  assert.equal(matchesQuery(rss, "天气"), false);
  assert.equal(matchesQuery(rss, "   "), true);
});

test("a manifest keyword finds the plugin even when the name and description never say it", () => {
  assert.deepEqual(names("倒计时"), ["@fuyu/countdown"]);
  assert.deepEqual(names("Anniversary"), ["@fuyu/countdown"]);
  assert.equal(matchesQuery({ ...countdown, keywords: undefined }, "倒计时"), false);
  assert.equal(matchesQuery({ ...countdown, keywords: ["", 3, null] }, "倒计时"), false);
});

test("a longer query that contains the plugin's name still finds it", () => {
  assert.deepEqual(names("天气预报"), ["@fuyu/weather"]);
  assert.deepEqual(names("pomodoro timer"), ["@fuyu/pomodoro"]);
  assert.equal(matchesQuery(plugin("@a/go", "走", "Go"), "google"), false);
});

test("full pinyin and initials find Chinese names and keywords once the pinyin library is loaded", async () => {
  const pinyin = await loadPinyin();
  assert.ok(pinyin);
  assert.deepEqual(names("tianqi", pinyin), ["@fuyu/weather"]);
  assert.deepEqual(names("tian qi", pinyin), ["@fuyu/weather"]);
  assert.deepEqual(names("tq", pinyin), ["@fuyu/weather"]);
  assert.deepEqual(names("fqz", pinyin), ["@fuyu/pomodoro"]);
  assert.deepEqual(names("daojishi", pinyin), ["@fuyu/countdown"]);
  assert.deepEqual(names("djs", pinyin), ["@fuyu/countdown"]);
  assert.deepEqual(names("daoshu", pinyin), ["@fuyu/countdown"]);
});

test("pinyin does not turn two stray letters into a match, and descriptions are not searched by pinyin", async () => {
  const pinyin = await loadPinyin();
  assert.deepEqual(names("ia", pinyin), []);
  assert.deepEqual(names("qingtian", pinyin), []);
});

test("before the pinyin library has loaded a latin query still searches names and keywords and never throws", () => {
  assert.equal(queryWantsPinyin("tian qi"), true);
  assert.equal(queryWantsPinyin("天气"), false);
  assert.equal(queryWantsPinyin("rss2"), false);
  assert.deepEqual(names("tianqi"), []);
  assert.deepEqual(names("weather"), ["@fuyu/weather"]);
});

test("results put name matches first, then keywords and pinyin, then publishers and descriptions, keeping the given order inside each", async () => {
  const pinyin = await loadPinyin();
  const sunny = plugin("@a/sunny", "晴天", "Sunny");
  const byKeyword = plugin("@a/outfit", "穿衣", "Outfit", { keywords: ["晴天穿什么"] });
  const list = [pomodoro, byKeyword, sunny];
  assert.deepEqual(searchMarket(list, "晴天", {}, pinyin).map((item) => item.name), ["@a/sunny", "@a/outfit", "@fuyu/pomodoro"]);
  assert.equal(marketSearchRank(sunny, "晴天"), 0);
  assert.equal(marketSearchRank(byKeyword, "晴天"), 1);
  assert.equal(marketSearchRank(pomodoro, "晴天"), 2);
  assert.equal(marketSearchRank(weather, "晴天"), null);
});

test("settings search suggests market plugins only when the settings themselves found little", async () => {
  const pinyin = await loadPinyin();
  const suggest = (query, settingsResults) => marketSuggestions(all, query, settingsResults, {}, pinyin).map((item) => item.name);
  assert.deepEqual(suggest("天气", 0), ["@fuyu/weather"]);
  assert.deepEqual(suggest("tianqi", FEW_SETTINGS_RESULTS), ["@fuyu/weather"]);
  assert.deepEqual(suggest("天气", FEW_SETTINGS_RESULTS + 1), []);
  assert.deepEqual(suggest("晴天", 0), ["@fuyu/pomodoro"]);
  assert.deepEqual(suggest("晴天", 1), []);
  assert.deepEqual(suggest("t", 0), []);
  assert.deepEqual(suggest("  ", 0), []);
});

test("suggestions list what is not installed first, leave out plugins pulled from the market and stop at five", () => {
  const many = Array.from({ length: 8 }, (_, index) => plugin(`@a/clock-${index}`, `时钟 ${index}`, `Clock ${index}`, index === 0 ? { installedVersion: "1.0.0" } : index === 1 ? { revoked: true } : {}));
  const found = marketSuggestions(many, "时钟", 0).map((item) => item.name);
  assert.deepEqual(found, ["@a/clock-2", "@a/clock-3", "@a/clock-4", "@a/clock-5", "@a/clock-6"]);
  assert.deepEqual(marketSuggestions(many.slice(0, 3), "clock", 2).map((item) => item.name), ["@a/clock-2", "@a/clock-0"]);
});
