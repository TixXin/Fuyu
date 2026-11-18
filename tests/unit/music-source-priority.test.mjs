import assert from "node:assert/strict";
import test from "node:test";
import {
  SOURCE_EXPIRE_MS,
  SOURCE_TOUCH_MS,
  mergeSessionsWithCustomPlayers,
  parseMusicSourcePriority,
  pickEffectiveMediaTarget,
  syncMusicSources,
} from "../../src/features/media/sourcePriority.ts";

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const live = (id) => ({ id, label: id.toUpperCase() });

test("old entries without a time count as seen now, new entries keep theirs", () => {
  const parsed = parseMusicSourcePriority([{ id: "a", label: "A" }, { id: "b", label: "B", lastSeen: NOW - DAY }, { id: "c", label: "C", lastSeen: "x" }], NOW);
  assert.deepEqual(parsed.map(source => source.lastSeen), [NOW, NOW - DAY, NOW]);
});

test("entries not seen for 60 days are dropped unless the player is live", () => {
  const old = NOW - SOURCE_EXPIRE_MS - DAY;
  const current = [{ id: "a", label: "A", lastSeen: old }, { id: "b", label: "B", lastSeen: old }, { id: "c", label: "C", lastSeen: NOW - 59 * DAY }];
  const next = syncMusicSources(current, [live("b")], NOW);
  assert.deepEqual(next.map(source => source.id), ["b", "c"]);
  assert.equal(next[0].lastSeen, NOW);
});

test("a removed player that is still live returns at the end; order is kept", () => {
  const current = [{ id: "a", label: "A", lastSeen: NOW }, { id: "c", label: "C", lastSeen: NOW }];
  const next = syncMusicSources(current, [live("a"), live("b"), live("c")], NOW);
  assert.deepEqual(next.map(source => source.id), ["a", "c", "b"]);
});

test("nothing changes (same reference) when everything is fresh", () => {
  const current = [{ id: "a", label: "A", lastSeen: NOW - SOURCE_TOUCH_MS + 1000 }];
  assert.equal(syncMusicSources(current, [live("a")], NOW), current);
});

test("picks a playing fallback player even before source priority syncs it, and merges custom players without duplicates", () => {
  const priority = [{ id: "msedge.exe", label: "Edge", lastSeen: NOW }];
  const sessions = [
    { id: "msedge.exe", label: "Edge", playing: false },
    { id: "xtMusic.exe", label: "飞牛音乐", playing: true },
  ];
  assert.equal(pickEffectiveMediaTarget(sessions, priority), "xtMusic.exe");

  const merged = mergeSessionsWithCustomPlayers(sessions, [
    { id: "xtmusic.exe", label: "飞牛音乐" },
    { id: "mybox.exe", label: "MyBox" },
  ]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ["msedge.exe", "xtMusic.exe", "mybox.exe"],
  );
});
