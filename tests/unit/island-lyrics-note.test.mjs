import assert from "node:assert/strict";
import test from "node:test";
import { islandLyricsNote } from "../../src/features/media/lyrics/islandLyricsNote.ts";
import { DEFAULT_NOTCH_TEXT } from "../../src/lib/settings/collapsedText.ts";

const settings = (change = {}) => ({ showCollapsedText: true, lyricsOnline: true, lyricsFolder: "", islandForm: "top", ...change });
const text = (change = {}) => ({ notch: DEFAULT_NOTCH_TEXT, hidden: [], ...change });

test("nothing blocks lyrics on a top island with a source", () => {
  assert.equal(islandLyricsNote(settings(), text(), false), null);
  assert.equal(islandLyricsNote(settings({ lyricsOnline: false, lyricsFolder: "/Music/lrc" }), text(), false), null);
});

test("names the setting that keeps lyrics off the collapsed island", () => {
  assert.equal(islandLyricsNote(settings({ showCollapsedText: false }), text(), false), "textOff");
  assert.equal(islandLyricsNote(settings(), text({ hidden: ["lyrics"] }), false), "hidden");
  assert.equal(islandLyricsNote(settings({ lyricsOnline: false, lyricsFolder: "  " }), text(), false), "noSource");
});

test("notch routing only counts when the island can sit on the notch", () => {
  const off = text({ notch: { ...DEFAULT_NOTCH_TEXT, lyrics: "off" } });
  assert.equal(islandLyricsNote(settings({ islandForm: "auto" }), off, true), "notchOff");
  assert.equal(islandLyricsNote(settings({ islandForm: "notch" }), off, false), "notchOff");
  assert.equal(islandLyricsNote(settings({ islandForm: "auto" }), off, false), null);
  assert.equal(islandLyricsNote(settings({ islandForm: "pill" }), off, true), null);
  assert.equal(islandLyricsNote(settings({ islandForm: "auto" }), text(), true), "notchPanel");
  assert.equal(islandLyricsNote(settings({ islandForm: "auto" }), text({ notch: { ...DEFAULT_NOTCH_TEXT, lyrics: "row" } }), true), null);
});

test("a switch that hides all text wins over the notch note", () => {
  assert.equal(islandLyricsNote(settings({ islandForm: "auto", showCollapsedText: false }), text({ hidden: ["lyrics"] }), true), "textOff");
});
