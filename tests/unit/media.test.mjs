import assert from "node:assert/strict";
import test from "node:test";
import { createAudioPeakStore } from "../../src/features/media/audioPeakStore.ts";
import { DEFAULT_MEDIA_STATE, isSameMediaState } from "../../src/features/media/mediaState.ts";
import { MUSIC_SOURCE_PRIORITY_STORAGE_KEY, loadMusicSourcePriority } from "../../src/features/media/storage.ts";

function withStorage(entries, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map(entries);
  const localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "window", descriptor);
    else delete globalThis.window;
  }
}

const session = (id, playing = false) => ({ id, label: id.toUpperCase(), playing });

test("media states compare by value, including the session list", () => {
  const a = { ...DEFAULT_MEDIA_STATE, title: "Song", sessions: [session("spotify", true)] };
  const b = { ...DEFAULT_MEDIA_STATE, title: "Song", sessions: [session("spotify", true)] };
  assert.equal(isSameMediaState(a, b), true);
  assert.equal(isSameMediaState(a, { ...b, title: "Other" }), false);
  assert.equal(isSameMediaState(a, { ...b, audioPeak: 0.1 }), false);
  assert.equal(isSameMediaState(a, { ...b, sessions: [session("spotify", false)] }), false);
  assert.equal(isSameMediaState(a, { ...b, sessions: [] }), false);
  assert.equal(isSameMediaState(a, { ...b, sessions: [session("spotify", true), session("qqmusic")] }), false);
});

test("the default media state reports nothing playing", () => {
  assert.equal(DEFAULT_MEDIA_STATE.available, false);
  assert.equal(DEFAULT_MEDIA_STATE.playbackStatus, "unavailable");
  assert.deepEqual(DEFAULT_MEDIA_STATE.sessions, []);
});

test("stored music source priority drops invalid and duplicate entries", () => {
  const stored = [
    { id: "spotify", label: "Spotify", extra: true },
    { id: "spotify", label: "Spotify again" },
    { id: "", label: "empty" },
    { id: "qqmusic" },
    null,
    { id: "cloudmusic", label: "网易云音乐" },
  ];
  withStorage([[MUSIC_SOURCE_PRIORITY_STORAGE_KEY, JSON.stringify(stored)]], () => {
    const loaded = loadMusicSourcePriority();
    assert.deepEqual(loaded.map(({ id, label }) => ({ id, label })), [
      { id: "spotify", label: "Spotify" },
      { id: "cloudmusic", label: "网易云音乐" },
    ]);
    assert.ok(loaded.every(source => Math.abs(source.lastSeen - Date.now()) < 5000));
  });
});

test("missing or corrupted music source priority reads as empty", () => {
  withStorage([], () => assert.deepEqual(loadMusicSourcePriority(), []));
  withStorage([[MUSIC_SOURCE_PRIORITY_STORAGE_KEY, "not json"]], () => assert.deepEqual(loadMusicSourcePriority(), []));
  withStorage([[MUSIC_SOURCE_PRIORITY_STORAGE_KEY, "{}"]], () => assert.deepEqual(loadMusicSourcePriority(), []));
});

test("audioPeak store notifies subscribers only when the peak value changes and resets when paused", () => {
  const store = createAudioPeakStore();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  store.set(0);
  assert.equal(notifications, 0);

  const active = store.sample(0.5, true);
  assert.equal(active, true);
  assert.equal(store.get(), 0.5);
  assert.equal(notifications, 1);

  store.set(0.5);
  assert.equal(notifications, 1);

  const decayedActive = store.sample(0, false);
  assert.equal(decayedActive, true);
  assert.ok(store.get() > 0 && store.get() < 0.5);
  assert.equal(notifications, 2);

  const pausedActive = store.mergeSnapshot(0.8, true, true);
  assert.equal(pausedActive, false);
  assert.equal(store.get(), 0);
  assert.equal(notifications, 3);

  unsubscribe();
  store.sample(0.4, true);
  assert.equal(notifications, 3);
});
