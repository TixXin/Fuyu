import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettings } from "../../src/features/appearance/settings.ts";
import { introLine } from "../../src/features/media/lyrics/songLine.ts";

test("what shows before the first line defaults to the todo and old settings keep it", () => {
  assert.equal(normalizeSettings({}).lyricsIntro, "todo");
  assert.equal(normalizeSettings({ lyricsIntro: "song" }).lyricsIntro, "song");
  assert.equal(normalizeSettings({ lyricsIntro: "note" }).lyricsIntro, "note");
  assert.equal(normalizeSettings({ lyricsIntro: "banner" }).lyricsIntro, "todo");
});

test("the intro line shows the title or a note while the song plays", () => {
  const playing = { title: " 晴天 ", artist: "周杰伦", playbackStatus: "playing" };
  assert.equal(introLine(playing, "todo", ""), null);
  assert.deepEqual(introLine(playing, "song", "故事的小黄花从出生那年就飘着"), { text: "晴天 - 周杰伦", index: -3, longest: "故事的小黄花从出生那年就飘着", song: true });
  assert.equal(introLine({ ...playing, artist: null }, "song", "").text, "晴天");
  assert.equal(introLine(playing, "note", "").text, "♪");
  assert.equal(introLine({ ...playing, playbackStatus: "paused" }, "note", ""), null);
  assert.equal(introLine({ ...playing, title: null }, "song", ""), null);
});
