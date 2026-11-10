import assert from "node:assert/strict";
import test from "node:test";
import { karaokeWords } from "../../src/features/media/lyrics/lrc.ts";
import { karaokeLook } from "../../src/features/media/lyrics/lyricsSettings.ts";
import { normalizeSettings } from "../../src/features/appearance/settings.ts";

test("a line's own word times are used as they are", () => {
  const words = [{ startMs: 1_000, endMs: 1_300, text: "Oh " }, { startMs: 1_300, endMs: 2_000, text: "I" }];
  assert.equal(karaokeWords({ timeMs: 1_000, text: "Oh I", words }, 5_000, false), words);
});

test("a line without word times fills evenly, character by character in Chinese, word by word in English", () => {
  const zh = karaokeWords({ timeMs: 10_000, text: "而风声 吹到" }, 14_000, true);
  assert.deepEqual(zh.map((word) => word.text), ["而", "风", "声 ", "吹", "到"]);
  assert.equal(zh[0].startMs, 10_000);
  // Most of the time to the next line: 85% of 4 s.
  assert.equal(zh[zh.length - 1].endMs, 13_400);
  const en = karaokeWords({ timeMs: 0, text: "Oh I believe" }, 2_000, true);
  assert.deepEqual(en.map((word) => word.text), ["Oh ", "I ", "believe"]);
  // Longer words take longer.
  assert.ok(en[2].endMs - en[2].startMs > en[1].endMs - en[1].startMs);
});

test("an even fill stays between 0.6 and 8 seconds and can be turned off", () => {
  assert.equal(karaokeWords({ timeMs: 0, text: "长长的间奏前一句" }, 60_000, true).at(-1).endMs, 8_000);
  assert.equal(karaokeWords({ timeMs: 0, text: "最后一句" }, null, true).at(-1).endMs, 6_800);
  assert.equal(karaokeWords({ timeMs: 0, text: "快" }, 100, true).at(-1).endMs, 600);
  assert.equal(karaokeWords({ timeMs: 0, text: "不填充" }, 3_000, false), undefined);
  assert.equal(karaokeWords({ timeMs: 0, text: "  " }, 3_000, true), undefined);
});

test("karaoke settings default to on and keep only known values", () => {
  const settings = normalizeSettings({});
  assert.equal(settings.lyricsKaraoke, true);
  assert.equal(settings.lyricsKaraokeFallback, "line");
  assert.equal(settings.lyricsKaraokeFill, "smooth");
  assert.equal(settings.lyricsKaraokeColor, "ink");
  assert.equal(settings.lyricsKaraokeDim, 45);
  assert.equal(settings.lyricsKaraokeFollow, true);
  const odd = normalizeSettings({ lyricsKaraoke: false, lyricsKaraokeColor: "rainbow", lyricsKaraokeCustomColor: "red", lyricsKaraokeDim: 99, lyricsKaraokeFill: "word" });
  assert.equal(odd.lyricsKaraoke, false);
  assert.equal(odd.lyricsKaraokeColor, "ink");
  assert.equal(odd.lyricsKaraokeCustomColor, "#ff8fab");
  assert.equal(odd.lyricsKaraokeDim, 80);
  assert.equal(odd.lyricsKaraokeFill, "word");
});

test("the look follows the colour choice; the unsung part is always the island's text, faded", () => {
  const base = normalizeSettings({ lyricsKaraokeDim: 30 });
  assert.equal(karaokeLook(base, "#ffffff").lit, "#ffffff");
  assert.equal(karaokeLook(base, "#ffffff").dim, "color-mix(in srgb, #ffffff 30%, transparent)");
  assert.match(karaokeLook({ ...base, lyricsKaraokeColor: "accent" }).lit, /--color-accent/);
  assert.equal(karaokeLook({ ...base, lyricsKaraokeColor: "custom", lyricsKaraokeCustomColor: "#ff0000" }).lit, "#ff0000");
});
