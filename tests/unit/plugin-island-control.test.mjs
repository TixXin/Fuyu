import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerIslandRequest,
  attachIslandHost,
  islandControlFor,
  islandRefusal,
  sendIslandNoticeAction,
  setLocalIslandControl,
  setLocalIslandNotices,
} from "../../src/features/plugin-kernel/islandControl.ts";
import { ownIslandPage, showsOwnIslandPage } from "../../src/features/plugin-kernel/islandPageRequest.ts";

const pages = [
  { id: "todo", owner: "builtin", external: false },
  { id: "launchpad", owner: "@fuyu/launchpad", external: true },
  { id: "launchpad-recent", owner: "@fuyu/launchpad", external: true },
  { id: "weather", owner: "@fuyu/weather", external: true },
];

test("a plugin opens its own island pages, and the first one when it names none", () => {
  assert.deepEqual(ownIslandPage("@fuyu/launchpad", undefined, pages), { page: "launchpad" });
  assert.deepEqual(ownIslandPage("@fuyu/launchpad", "launchpad-recent", pages), { page: "launchpad-recent" });
});

test("a plugin cannot open another plugin's page or a built-in page", () => {
  assert.deepEqual(ownIslandPage("@fuyu/launchpad", "weather", pages), { refusal: "not-owner" });
  assert.deepEqual(ownIslandPage("@fuyu/launchpad", "todo", pages), { refusal: "not-owner" });
  assert.deepEqual(ownIslandPage("@fuyu/clock", "weather", pages), { refusal: "not-owner" });
});

test("a plugin without island pages, or naming a page that does not exist, gets its own refusal", () => {
  assert.deepEqual(ownIslandPage("@fuyu/clock", undefined, pages), { refusal: "no-page" });
  assert.deepEqual(ownIslandPage("@fuyu/clock", "clock", pages), { refusal: "no-page" });
  assert.deepEqual(ownIslandPage("@fuyu/launchpad", "launchpad-old", pages), { refusal: "not-found" });
});

test("collapse only counts when the island is expanded on one of the caller's pages", () => {
  assert.equal(showsOwnIslandPage("@fuyu/launchpad", { mode: "expanded", page: "launchpad-recent" }, pages), true);
  assert.equal(showsOwnIslandPage("@fuyu/launchpad", { mode: "expanded", page: "weather" }, pages), false);
  assert.equal(showsOwnIslandPage("@fuyu/launchpad", { mode: "expanded", page: "todo" }, pages), false);
  assert.equal(showsOwnIslandPage("@fuyu/launchpad", { mode: "collapsed", page: "launchpad" }, pages), false);
});

test("the island answers host requests with the result or the refusal code", async () => {
  const calls = [];
  const call = async (method, params) => void calls.push([method, params]);
  const stop = setLocalIslandControl({
    open: async (plugin, page) => {
      const found = ownIslandPage(plugin, page, pages);
      if ("refusal" in found) throw islandRefusal(found.refusal, plugin, page);
    },
    collapse: async (plugin) => showsOwnIslandPage(plugin, { mode: "expanded", page: "weather" }, pages),
  });
  await answerIslandRequest({ id: 1, action: "open", plugin: "@fuyu/launchpad", page: "weather" }, call);
  await answerIslandRequest({ id: 2, action: "open", plugin: "@fuyu/launchpad" }, call);
  await answerIslandRequest({ id: 3, action: "collapse", plugin: "@fuyu/launchpad" }, call);
  await answerIslandRequest({ id: 4, action: "explode", plugin: "@fuyu/launchpad" }, call);
  stop();
  await answerIslandRequest({ id: 5, action: "open", plugin: "@fuyu/launchpad" }, call);
  assert.deepEqual(calls.map(([method, params]) => [method, params.id, params.value ?? null, params.error?.code ?? null]), [
    ["island.result", 1, null, "not-owner"],
    ["island.result", 2, null, null],
    ["island.result", 3, false, null],
    ["island.result", 5, null, "not-ready"],
  ]);
});

test("other windows send island calls to the plugin host with the caller's id", async () => {
  const calls = [];
  const control = islandControlFor("settings", async (method, params) => {
    calls.push([method, params]);
    return method === "island.collapse" ? true : null;
  });
  await control.open("@fuyu/launchpad");
  await control.open("@fuyu/launchpad", "launchpad-recent");
  assert.equal(await control.collapse("@fuyu/launchpad"), true);
  assert.deepEqual(calls, [
    ["island.open", { plugin: "@fuyu/launchpad" }],
    ["island.open", { plugin: "@fuyu/launchpad", page: "launchpad-recent" }],
    ["island.collapse", { plugin: "@fuyu/launchpad" }],
  ]);
});

test("the island shows a host notice through its notice handler and answers with what it showed", async () => {
  const calls = [];
  const call = async (method, params) => void calls.push([method, params]);
  const notice = { source: "alarm", pluginId: "@fuyu/alarm", title: "Wake up", body: "7:00", actions: [] };
  await answerIslandRequest({ id: 1, action: "notify", plugin: "@fuyu/alarm", notice }, call);
  const seen = [];
  let showing = true;
  const stop = setLocalIslandNotices((next) => {
    seen.push(next);
    return showing;
  });
  await answerIslandRequest({ id: 2, action: "notify", plugin: "@fuyu/alarm", notice }, call);
  showing = false;
  await answerIslandRequest({ id: 3, action: "notify", plugin: "@fuyu/alarm", notice }, call);
  await answerIslandRequest({ id: 4, action: "notify", plugin: "@fuyu/alarm", notice: "Wake up" }, call);
  stop();
  assert.deepEqual(seen, [notice, notice]);
  assert.deepEqual(calls.map(([method, params]) => [method, params.id, params.value ?? null, params.error?.code ?? null]), [
    ["island.result", 1, null, "not-ready"],
    ["island.result", 2, true, null],
    ["island.result", 3, false, null],
  ]);
});

test("a click on a host notice goes back to the plugin host, and fails plainly when the host is gone", async () => {
  await assert.rejects(sendIslandNoticeAction("@fuyu/pomodoro", "skip"), { code: "not-ready" });
  const calls = [];
  const detach = attachIslandHost(async (method, params) => void calls.push([method, params]));
  await sendIslandNoticeAction("@fuyu/pomodoro", "skip");
  detach();
  await assert.rejects(sendIslandNoticeAction("@fuyu/pomodoro", "again"), { code: "not-ready" });
  assert.deepEqual(calls, [["island.noticeAction", { pluginId: "@fuyu/pomodoro", action: "skip" }]]);
});
