import assert from "node:assert/strict";
import { test } from "node:test";
import { playerName } from "../../src/features/media/playerNames.ts";
import { sourceLabel } from "../../src/features/media/sourceLabel.ts";

const state = (id, label) => ({ sourceApp: id, activeSessionId: id, sessions: id ? [{ id, label }] : [] });

test("a player the app knows keeps its friendly name", () => {
  assert.equal(sourceLabel(state("cloudmusic.exe", "NetEase Music"), null, "zh-CN"), "网易云音乐");
  assert.equal(sourceLabel(state("cloudmusic.exe", "NetEase Music"), null, "en"), "NetEase Cloud Music");
  assert.equal(sourceLabel(state("com.spotify.client", "Spotify"), "Spotify.app name", "zh-CN"), "Spotify");
});

test("a player only known by its package id shows the app's own name, not the id", () => {
  assert.equal(sourceLabel(state("com.soda.music", "com.soda.music"), "汽水音乐", "zh-CN"), "汽水音乐");
  assert.equal(sourceLabel(state("com.soda.music", "com.soda.music"), "汽水音乐", "en"), "Soda Music");
  assert.equal(sourceLabel(state("com.unknown.player", "com.unknown.player"), null, "zh-CN"), "com.unknown.player");
});

test("nothing playing gives no name", () => {
  assert.equal(sourceLabel(state(null, ""), null, "zh-CN"), null);
  assert.equal(sourceLabel(state(null, ""), "  ", "en"), null);
});

test("players with a Chinese and an English name read in the interface language, the rest keep one name", () => {
  const cases = [
    ["NetEase Music", "网易云音乐", "NetEase Cloud Music"],
    ["QQ Music", "QQ音乐", "QQ Music"],
    ["KuGou", "酷狗音乐", "KuGou Music"],
    ["Kuwo", "酷我音乐", "Kuwo Music"],
    ["汽水音乐", "汽水音乐", "Soda Music"],
    ["咪咕音乐", "咪咕音乐", "Migu Music"],
    ["LX Music", "洛雪音乐", "LX Music"],
    ["Salt Player", "椒盐音乐", "Salt Player"],
    ["HiBy Music", "海贝音乐", "HiBy Music"],
    ["音流", "音流", "Stream Music"],
    ["铜钟", "铜钟", "Tongzhong"],
    ["Groove", "Groove 音乐", "Groove Music"],
    ["foobar2000", "foobar2000", "foobar2000"],
    ["Spotify", "Spotify", "Spotify"],
    ["Apple Music", "Apple Music", "Apple Music"],
    ["YouTube Music", "YouTube Music", "YouTube Music"],
    ["Amazon Music", "Amazon Music", "Amazon Music"],
    ["TIDAL", "TIDAL", "TIDAL"],
    ["Deezer", "Deezer", "Deezer"],
    ["Qobuz", "Qobuz", "Qobuz"],
  ];
  for (const [label, zh, en] of cases) {
    assert.equal(playerName(label, "zh-CN"), zh);
    assert.equal(playerName(label, "en"), en);
  }
  assert.equal(playerName("MyBox Music", "zh-CN"), "MyBox Music");
});
