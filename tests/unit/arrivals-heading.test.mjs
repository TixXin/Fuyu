import assert from "node:assert/strict";
import { test } from "node:test";
import { arrivalsHeading } from "../../src/features/messages/island/arrivalsHeading.ts";

const NAMES = new Map([["@fuyu/alarm", { "zh-CN": "闹钟", en: "Alarm" }]]);
const ART = { sourceLabel: "汽水音乐", sourceIcon: "data:image/png;base64,AAAA" };
const track = { source: "plugin", mediaControls: true, pluginId: "@fuyu/now-playing" };

test("a track notice is headed by the player's name and icon", () => {
  assert.deepEqual(arrivalsHeading([track], ART, NAMES, "zh-CN", "切歌"), { label: "汽水音乐", icon: "music", iconUrl: ART.sourceIcon });
});

test("a track notice falls back to the track change label when the player is unknown", () => {
  assert.deepEqual(arrivalsHeading([track], null, NAMES, "zh-CN", "切歌"), { label: "切歌", icon: "music" });
  assert.deepEqual(arrivalsHeading([track], { sourceLabel: null, sourceIcon: null }, NAMES, "en", "Track change"), { label: "Track change", icon: "music" });
});

test("another plugin's notice is headed by the plugin's own name in the current language", () => {
  const alarm = { source: "plugin", pluginId: "@fuyu/alarm" };
  assert.deepEqual(arrivalsHeading([alarm], ART, NAMES, "zh-CN", "切歌"), { label: "闹钟", icon: "bell" });
  assert.deepEqual(arrivalsHeading([alarm], ART, NAMES, "en", "Track change"), { label: "Alarm", icon: "bell" });
});

test("the Messages heading stays for chat messages, mixed lists and unnamed plugins", () => {
  assert.equal(arrivalsHeading(null, ART, NAMES, "zh-CN", "切歌"), null);
  assert.equal(arrivalsHeading([{ source: "qq" }], ART, NAMES, "zh-CN", "切歌"), null);
  assert.equal(arrivalsHeading([track, { source: "qq" }], ART, NAMES, "zh-CN", "切歌"), null);
  assert.equal(arrivalsHeading([{ source: "plugin", pluginId: "dev.unknown" }], ART, NAMES, "zh-CN", "切歌"), null);
});

test("another plugin's notice carries that plugin's own icon when the island knows it", () => {
  const alarm = { source: "plugin", pluginId: "@fuyu/alarm" };
  const icons = new Map([["@fuyu/alarm", "fuyu-plugin://localhost/packages/@fuyu/alarm/assets/icon.svg"]]);
  assert.deepEqual(arrivalsHeading([alarm], ART, NAMES, "zh-CN", "切歌", icons), { label: "闹钟", icon: "bell", iconUrl: icons.get("@fuyu/alarm") });
  assert.deepEqual(arrivalsHeading([alarm], ART, NAMES, "zh-CN", "切歌", new Map()), { label: "闹钟", icon: "bell" });
  assert.deepEqual(arrivalsHeading([track], ART, NAMES, "zh-CN", "切歌", icons), { label: "汽水音乐", icon: "music", iconUrl: ART.sourceIcon });
});
