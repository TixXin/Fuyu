import assert from "node:assert/strict";
import test from "node:test";
import { NOTICE_SENDERS_LIMIT, normalizeNoticeIds, noticeSwitchShown, withNoticeMuted, withNoticeSender } from "../../src/lib/plugin-notice-mutes/mutes.ts";
import {
  PLUGIN_NOTICE_MUTES_KEY,
  PLUGIN_NOTICE_SENDERS_KEY,
  isPluginNoticeMuted,
  loadNoticeMutes,
  loadNoticeSenders,
  rememberNoticeSender,
  saveNoticeMuted,
} from "../../src/lib/plugin-notice-mutes/storage.ts";
import { BACKUP_KEYS } from "../../src/lib/settings-backup/backup.ts";

function withStorage(entries, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(entries);
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  try {
    run(values);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

test("a broken or hand-edited mute list reads as the ids that are usable, never throws", () => {
  assert.deepEqual(normalizeNoticeIds(undefined), []);
  assert.deepEqual(normalizeNoticeIds({ "@fuyu/alarm": true }), []);
  assert.deepEqual(normalizeNoticeIds(["@fuyu/alarm", 3, null, "", "  ", " @fuyu/alarm ", "@me/feeds"]), ["@fuyu/alarm", "@me/feeds"]);
  withStorage([[PLUGIN_NOTICE_MUTES_KEY, "{not json"]], () => {
    assert.deepEqual(loadNoticeMutes(), []);
    assert.equal(isPluginNoticeMuted("@fuyu/alarm"), false);
  });
});

test("muting one plugin leaves the others alone and unmuting takes only that one out", () => {
  const one = withNoticeMuted([], "@fuyu/now-playing", true);
  const two = withNoticeMuted(one, "@fuyu/alarm", true);
  assert.deepEqual(two, ["@fuyu/alarm", "@fuyu/now-playing"]);
  assert.deepEqual(withNoticeMuted(two, "@fuyu/alarm", true), two);
  assert.deepEqual(withNoticeMuted(two, "@fuyu/now-playing", false), ["@fuyu/alarm"]);
  assert.deepEqual(withNoticeMuted(two, "@me/never-muted", false), two);
  assert.deepEqual(withNoticeMuted(two, "  ", true), two);
});

test("the mute is stored under fuyu-plugin-notice-mutes as a plain id list, so it is still there after a restart", () => {
  withStorage([], (values) => {
    assert.equal(isPluginNoticeMuted("@fuyu/now-playing"), false);
    saveNoticeMuted("@fuyu/now-playing", true);
    assert.equal(values.get("fuyu-plugin-notice-mutes"), '["@fuyu/now-playing"]');
    assert.equal(isPluginNoticeMuted("@fuyu/now-playing"), true);
    assert.equal(isPluginNoticeMuted("@fuyu/alarm"), false);
    saveNoticeMuted("@fuyu/now-playing", false);
    assert.equal(values.get("fuyu-plugin-notice-mutes"), "[]");
    assert.equal(isPluginNoticeMuted("@fuyu/now-playing"), false);
  });
  withStorage([["fuyu-plugin-notice-mutes", '["@fuyu/alarm"]']], () => {
    assert.equal(isPluginNoticeMuted("@fuyu/alarm"), true);
  });
});

test("the mute list goes into the settings backup and the list of senders does not", () => {
  assert.ok(BACKUP_KEYS.includes(PLUGIN_NOTICE_MUTES_KEY));
  assert.ok(!BACKUP_KEYS.includes(PLUGIN_NOTICE_SENDERS_KEY));
});

test("senders are remembered once each, newest kept when the list is full", () => {
  assert.equal(withNoticeSender(["a"], "a"), null);
  assert.equal(withNoticeSender(["a"], " "), null);
  assert.deepEqual(withNoticeSender(["a"], "b"), ["a", "b"]);
  const full = Array.from({ length: NOTICE_SENDERS_LIMIT }, (_, index) => `p${index}`);
  const next = withNoticeSender(full, "fresh");
  assert.equal(next.length, NOTICE_SENDERS_LIMIT);
  assert.equal(next[0], "p1");
  assert.equal(next.at(-1), "fresh");
  withStorage([], (values) => {
    rememberNoticeSender("@me/dev-plugin");
    rememberNoticeSender("@me/dev-plugin");
    assert.deepEqual(loadNoticeSenders(), ["@me/dev-plugin"]);
    assert.equal(values.get("fuyu-plugin-notice-senders"), '["@me/dev-plugin"]');
  });
});

test("the switch shows for a plugin that declares alerts, has sent one, or is muted, and for no other", () => {
  assert.equal(noticeSwitchShown("@fuyu/weather", true, [], []), true);
  assert.equal(noticeSwitchShown("@me/dev-plugin", false, [], ["@me/dev-plugin"]), true);
  assert.equal(noticeSwitchShown("@me/gone-quiet", false, ["@me/gone-quiet"], []), true);
  assert.equal(noticeSwitchShown("@someone/clock", false, ["@fuyu/weather"], ["@me/dev-plugin"]), false);
});
