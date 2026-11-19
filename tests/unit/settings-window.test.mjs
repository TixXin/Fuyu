import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/settings/settings.ts";
import { COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY, GLASS_BACKDROP_DEFAULT_MIGRATION_KEY, STORAGE_KEY } from "../../src/lib/settings/storage.ts";
import { createSettingsSyncController } from "../../src/lib/settings/useIslandSettings.ts";
import {
  PANEL_PREVIEW_STORAGE_KEY,
  PANEL_PREVIEW_THROTTLE_MS,
  isFreshPositionReset,
  parsePanelPreview,
  requestPanelPreview,
} from "../../src/windows/settings/storage.ts";

function withMockStorage(initial, run) {
  const store = new Map(Object.entries(initial));
  const writes = [];
  const prevWindow = globalThis.window;
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      const text = String(value);
      store.set(key, text);
      writes.push({ key, value: text });
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
  globalThis.window = { localStorage };
  try {
    return run({ store, writes });
  } finally {
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  }
}

test("panel preview requests are read only while fresh and well formed", () => {
  const now = 10_000;
  const request = (mode, requestedAt = now - 100) => JSON.stringify({ mode, requestedAt });

  assert.equal(parsePanelPreview(request("expanded"), now), "expanded");
  assert.equal(parsePanelPreview(request("collapsed"), now), "collapsed");
  assert.equal(parsePanelPreview(request("expanded", now - 5_000), now), null);
  assert.equal(parsePanelPreview(request("tucked"), now), null);
  assert.equal(parsePanelPreview(JSON.stringify({ mode: "expanded" }), now), null);
  assert.equal(parsePanelPreview("{broken", now), null);
  assert.equal(parsePanelPreview(null, now), null);
});

test("requestPanelPreview throttles repeated renewals of the same mode while switching modes at once", () => {
  withMockStorage({}, ({ writes }) => {
    const start = 50_000;
    requestPanelPreview("expanded", start);
    requestPanelPreview("expanded", start + 80);
    requestPanelPreview("expanded", start + PANEL_PREVIEW_THROTTLE_MS - 1);
    assert.equal(writes.length, 1);
    assert.deepEqual(JSON.parse(writes[0].value), { mode: "expanded", requestedAt: start });

    requestPanelPreview("expanded", start + PANEL_PREVIEW_THROTTLE_MS);
    assert.equal(writes.length, 2);
    assert.deepEqual(JSON.parse(writes[1].value), {
      mode: "expanded",
      requestedAt: start + PANEL_PREVIEW_THROTTLE_MS,
    });

    requestPanelPreview("collapsed", start + PANEL_PREVIEW_THROTTLE_MS + 20);
    assert.equal(writes.length, 3);
    assert.equal(writes[2].key, PANEL_PREVIEW_STORAGE_KEY);
    assert.deepEqual(JSON.parse(writes[2].value), {
      mode: "collapsed",
      requestedAt: start + PANEL_PREVIEW_THROTTLE_MS + 20,
    });
  });
});

test("position reset requests count only while fresh and well formed", () => {
  const now = 10_000;
  assert.equal(isFreshPositionReset(JSON.stringify({ requestedAt: now - 100 }), now), true);
  assert.equal(isFreshPositionReset(JSON.stringify({ requestedAt: now - 6_000 }), now), false);
  assert.equal(isFreshPositionReset(JSON.stringify({}), now), false);
  assert.equal(isFreshPositionReset("{broken", now), false);
  assert.equal(isFreshPositionReset(null, now), false);
});

test("external StorageEvent updates state without writing back to localStorage or snapping sliders back", () => {
  const base = normalizeSettings({ ...DEFAULT_SETTINGS, opacity: 60 });
  withMockStorage(
    {
      [STORAGE_KEY]: JSON.stringify(base),
      [COLLAPSED_TEXT_DEFAULT_MIGRATION_KEY]: "1",
      [GLASS_BACKDROP_DEFAULT_MIGRATION_KEY]: "1",
    },
    ({ store, writes }) => {
      const frames = [];
      let nextFrameId = 1;
      const makeController = (coalesceFrames = false) =>
        createSettingsSyncController({
          coalesceFrames,
          requestFrame: (cb) => {
            const id = nextFrameId++;
            frames.push({ id, cb });
            return id;
          },
          cancelFrame: (id) => {
            const idx = frames.findIndex((entry) => entry.id === id);
            if (idx >= 0) frames.splice(idx, 1);
          },
        });

      const settingsWin = makeController(true);
      const islandWin = makeController(false);
      settingsWin.syncInitial();
      islandWin.syncInitial();
      assert.equal(writes.length, 0);

      let islandObserved = islandWin.get();
      islandWin.subscribe((next) => {
        islandObserved = next;
      });

      settingsWin.setLocal((prev) => ({ ...prev, opacity: 65 }));
      assert.equal(writes.length, 1);
      assert.equal(JSON.parse(writes[0].value).opacity, 65);
      assert.equal(frames.length, 1);

      settingsWin.setLocal((prev) => ({ ...prev, opacity: 72 }));
      settingsWin.setLocal((prev) => ({ ...prev, opacity: 80 }));
      assert.equal(writes.length, 1);
      assert.equal(frames.length, 1);

      frames.shift().cb();
      assert.equal(writes.length, 2);
      assert.equal(JSON.parse(writes[1].value).opacity, 80);
      assert.equal(frames.length, 1);

      const writesBeforeIslandSync = writes.length;
      islandWin.syncExternal({ key: STORAGE_KEY, newValue: store.get(STORAGE_KEY) });
      assert.equal(islandObserved.opacity, 80);
      assert.equal(writes.length, writesBeforeIslandSync);

      const stalePayload = JSON.stringify({ ...base, opacity: 65 });
      settingsWin.setLocal((prev) => ({ ...prev, opacity: 88 }));
      assert.equal(writes.length, 2);
      settingsWin.syncExternal({ key: STORAGE_KEY, newValue: stalePayload });
      assert.equal(settingsWin.get().opacity, 88);

      settingsWin.flush();
      assert.equal(frames.length, 0);
      assert.equal(writes.length, 3);
      assert.equal(JSON.parse(store.get(STORAGE_KEY)).opacity, 88);

      settingsWin.syncExternal({ key: STORAGE_KEY, newValue: stalePayload });
      assert.equal(settingsWin.get().opacity, 88);
      assert.equal(writes.length, 3);

      const genuineExternal = JSON.stringify({ ...base, opacity: 55 });
      store.set(STORAGE_KEY, genuineExternal);
      settingsWin.syncExternal({ key: STORAGE_KEY, newValue: genuineExternal });
      assert.equal(settingsWin.get().opacity, 55);
      assert.equal(writes.length, 3);
    },
  );
});
