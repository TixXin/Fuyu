import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, coverAccents, hexToRgb, pickCoverColor, readableOn } from "../../src/features/media/coverColor.ts";

const DARK = "#000000";
const LIGHT = "#f2f2f5";

function image(colors) {
  const pixels = [];
  for (const [hex, count] of colors) {
    const [r, g, b] = hexToRgb(hex);
    for (let index = 0; index < count; index += 1) pixels.push(r, g, b, 255);
  }
  return Uint8ClampedArray.from(pixels);
}

function hue(hex) {
  const [r, g, b] = hexToRgb(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma === 0) return 0;
  return (max === r ? ((g - b) / chroma + 6) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4) * 60;
}

test("the dominant saturated colour wins over black, white and grey", () => {
  const picked = pickCoverColor(image([["#000000", 400], ["#ffffff", 300], ["#808080", 200], ["#d03030", 80], ["#3060d0", 20]]));
  assert.equal(picked, "#d03030");
});

test("a cover with no colourful pixels gives no colour", () => {
  assert.equal(pickCoverColor(image([["#000000", 500], ["#ffffff", 500], ["#777777", 200]])), null);
  assert.equal(pickCoverColor(new Uint8ClampedArray(0)), null);
});

test("transparent pixels are ignored", () => {
  const pixels = image([["#20a050", 10]]);
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 0;
  assert.equal(pickCoverColor(pixels), null);
});

for (const [name, color] of [["black", "#000000"], ["white", "#ffffff"], ["yellow", "#ffff00"], ["deep blue", "#0a1a6e"], ["red", "#d03030"]]) {
  test(`${name} becomes readable on both dark and light islands`, () => {
    const accents = coverAccents(color, DARK);
    assert.ok(contrastRatio(accents.dark, DARK) >= 3, `${accents.dark} on dark`);
    assert.ok(contrastRatio(accents.light, LIGHT) >= 3, `${accents.light} on light`);
    const fromLight = coverAccents(color, LIGHT);
    assert.deepEqual(fromLight, accents);
  });
}

test("adjusting keeps the hue and leaves readable colours alone", () => {
  assert.equal(readableOn("#ffff00", DARK), "#ffff00");
  const yellow = readableOn("#ffff00", LIGHT);
  assert.ok(Math.abs(hue(yellow) - 60) < 3, yellow);
  const blue = readableOn("#0a1a6e", DARK);
  assert.ok(Math.abs(hue(blue) - hue("#0a1a6e")) < 3, blue);
});

test("a custom island background is used for its own tone", () => {
  const navy = "#102040";
  const accents = coverAccents("#203060", navy);
  assert.ok(contrastRatio(accents.dark, navy) >= 3);
  assert.ok(contrastRatio(accents.light, LIGHT) >= 3);
});

test("the karaoke highlight follows the cover only when the setting is on, and old settings read as off", async () => {
  const { DEFAULT_LYRICS_SETTINGS, karaokeLook, normalizeLyricsSettings } = await import("../../src/features/media/lyrics/lyricsSettings.ts");
  assert.equal(DEFAULT_LYRICS_SETTINGS.lyricsCoverColor, false);
  assert.equal(normalizeLyricsSettings({}).lyricsCoverColor, false);
  assert.equal(normalizeLyricsSettings({ lyricsCoverColor: true }).lyricsCoverColor, true);
  assert.equal(karaokeLook(DEFAULT_LYRICS_SETTINGS, "#fff").lit, "#fff");
  assert.equal(karaokeLook({ ...DEFAULT_LYRICS_SETTINGS, lyricsCoverColor: true }, "#fff").lit, "var(--cover-accent, #fff)");
});
