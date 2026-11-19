import assert from "node:assert/strict";
import test from "node:test";
import { ABOUT_TAB_STORAGE_KEY, FOCUS_REQUEST_MAX_AGE_MS, SETTINGS_FOCUS_STORAGE_KEY, rememberAboutPage, rememberedAboutPage, requestSettingsFocus, takeFocusRequest } from "../../src/windows/settings/storage.ts";

function withStorage(initial, run) {
  const store = new Map(Object.entries(initial));
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => void store.set(key, String(value)),
      removeItem: (key) => void store.delete(key),
    },
  };
  try {
    return run(store);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test("a focus request for a plugin carries the plugin and is read once", () => {
  withStorage({}, (store) => {
    requestSettingsFocus("pluginsV3", "@fuyu/weather");
    assert.equal(JSON.parse(store.get(SETTINGS_FOCUS_STORAGE_KEY)).plugin, "@fuyu/weather");
    assert.deepEqual(takeFocusRequest(), { section: "pluginsV3", plugin: "@fuyu/weather", tab: null });
    assert.equal(takeFocusRequest(), null);
  });
});

test("a request without a plugin keeps the old format and reads with no plugin", () => {
  withStorage({}, (store) => {
    requestSettingsFocus("updates");
    assert.deepEqual(Object.keys(JSON.parse(store.get(SETTINGS_FOCUS_STORAGE_KEY))).sort(), ["requestedAt", "section"]);
    assert.deepEqual(takeFocusRequest(), { section: "updates", plugin: null, tab: null });
  });
});

test("a plugin is only taken with the plugin page, and stale or broken requests are dropped", () => {
  const now = Date.now();
  const stored = (value) => ({ [SETTINGS_FOCUS_STORAGE_KEY]: JSON.stringify(value) });
  withStorage(stored({ section: "updates", requestedAt: now, plugin: "@fuyu/weather" }), () => assert.deepEqual(takeFocusRequest(), { section: "updates", plugin: null, tab: null }));
  withStorage(stored({ section: "pluginsV3", requestedAt: now, plugin: 42 }), () => assert.deepEqual(takeFocusRequest(), { section: "pluginsV3", plugin: null, tab: null }));
  withStorage(stored({ section: "pluginsV3", requestedAt: now - FOCUS_REQUEST_MAX_AGE_MS - 1, plugin: "@fuyu/weather" }), () => assert.equal(takeFocusRequest(), null));
  withStorage({ [SETTINGS_FOCUS_STORAGE_KEY]: "{" }, (store) => {
    assert.equal(takeFocusRequest(), null);
    assert.equal(store.has(SETTINGS_FOCUS_STORAGE_KEY), false);
  });
});

test("an updates request can name an About tab, and only updates keeps it", () => {
  const now = Date.now();
  const stored = (value) => ({ [SETTINGS_FOCUS_STORAGE_KEY]: JSON.stringify(value) });
  withStorage({}, (store) => {
    requestSettingsFocus("updates", undefined, "changelog");
    assert.deepEqual(Object.keys(JSON.parse(store.get(SETTINGS_FOCUS_STORAGE_KEY))).sort(), ["requestedAt", "section", "tab"]);
    assert.deepEqual(takeFocusRequest(), { section: "updates", plugin: null, tab: "changelog" });
  });
  withStorage(stored({ section: "updates", requestedAt: now, tab: "toString" }), () => assert.deepEqual(takeFocusRequest(), { section: "updates", plugin: null, tab: null }));
  withStorage(stored({ section: "music", requestedAt: now, tab: "help" }), () => assert.deepEqual(takeFocusRequest(), { section: "music", plugin: null, tab: null }));
});

test("the About page reopens on the last tab and starts on the overview", () => {
  withStorage({}, (store) => {
    assert.equal(rememberedAboutPage(), "about");
    rememberAboutPage("aboutChangelog");
    assert.equal(store.get(ABOUT_TAB_STORAGE_KEY), "changelog");
    assert.equal(rememberedAboutPage(), "aboutChangelog");
    rememberAboutPage("music");
    assert.equal(rememberedAboutPage(), "aboutChangelog");
    rememberAboutPage("about");
    assert.equal(store.get(ABOUT_TAB_STORAGE_KEY), "overview");
  });
  withStorage({ [ABOUT_TAB_STORAGE_KEY]: "constructor" }, () => assert.equal(rememberedAboutPage(), "about"));
});
