import assert from "node:assert/strict";
import { test } from "node:test";
import { sourceLabel } from "../../src/features/media/sourceLabel.ts";

const state = (id, label) => ({ sourceApp: id, activeSessionId: id, sessions: id ? [{ id, label }] : [] });

test("a player the app knows keeps its friendly name", () => {
  assert.equal(sourceLabel(state("cloudmusic.exe", "NetEase Music"), null), "NetEase Music");
  assert.equal(sourceLabel(state("com.spotify.client", "Spotify"), "Spotify.app name"), "Spotify");
});

test("a player only known by its package id shows the app's own name, not the id", () => {
  assert.equal(sourceLabel(state("com.soda.music", "com.soda.music"), "汽水音乐"), "汽水音乐");
  assert.equal(sourceLabel(state("com.soda.music", "com.soda.music"), null), "com.soda.music");
});

test("nothing playing gives no name", () => {
  assert.equal(sourceLabel(state(null, ""), null), null);
  assert.equal(sourceLabel(state(null, ""), "  "), null);
});
