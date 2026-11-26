import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";
import { TASKBAR_LYRICS_ICON_WIDTH, TASKBAR_LYRICS_WIDTH, taskbarLyricsWidth } from "../../src/features/media/taskbar/taskbarLyricsActive.ts";

const feed = (state, idle = "hide") => ({ state: { playbackStatus: "playing", title: "Song", ...state }, lines: null, offsetMs: 0, karaoke: null, content: "both", idle });

test("settings saved before the taskbar lyrics keep it off with the default look", () => {
  const settings = normalizeSettings({ lyricsOnIsland: true });
  assert.equal(settings.lyricsTaskbar, false);
  assert.equal(settings.lyricsTaskbarContent, "both");
  assert.equal(settings.lyricsTaskbarIdle, "hide");
});

test("unknown taskbar lyrics values fall back instead of passing through", () => {
  const settings = normalizeSettings({ lyricsTaskbar: "yes", lyricsTaskbarContent: "cover", lyricsTaskbarIdle: "dim" });
  assert.equal(settings.lyricsTaskbar, false);
  assert.equal(settings.lyricsTaskbarContent, "both");
  assert.equal(settings.lyricsTaskbarIdle, "hide");
  const kept = normalizeSettings({ lyricsTaskbar: true, lyricsTaskbarContent: "song", lyricsTaskbarIdle: "icon" });
  assert.deepEqual([kept.lyricsTaskbar, kept.lyricsTaskbarContent, kept.lyricsTaskbarIdle], [true, "song", "icon"]);
});

test("the strip takes no taskbar room when nothing plays unless it should leave an icon", () => {
  assert.equal(taskbarLyricsWidth(null), null);
  assert.equal(taskbarLyricsWidth(feed({ playbackStatus: "unavailable", title: null })), null);
  assert.equal(taskbarLyricsWidth(feed({ playbackStatus: "unavailable", title: null }, "icon")), TASKBAR_LYRICS_ICON_WIDTH);
  assert.equal(taskbarLyricsWidth(feed({ playbackStatus: "paused" })), TASKBAR_LYRICS_WIDTH);
  assert.equal(taskbarLyricsWidth(feed({})), TASKBAR_LYRICS_WIDTH);
});
