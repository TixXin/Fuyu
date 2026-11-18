import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ENABLED_CATEGORIES,
  DEFAULT_SYNC_STATUS,
  OPTIONAL_GROUP_ITEMS,
  STALE_DEVICE_MS,
  SYNC_CATEGORY_ITEMS,
  enabledCategories,
  isDeviceStale,
  toggleCategoryList,
  toggleOptionalGroupList,
} from "../../src/features/sync/syncState.ts";
import { en, zhCN } from "../../src/i18n/sections/sync.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const WHITELIST = JSON.parse(readFileSync(join(ROOT, "src-tauri/src/sync/settings_whitelist.json"), "utf8"));

test("sync starts with no pre-filled folder, primary categories on, clipFavorites off, and all optional groups off", () => {
  assert.equal(DEFAULT_SYNC_STATUS.phase, "off");
  assert.equal(DEFAULT_SYNC_STATUS.folder, null);
  assert.deepEqual(enabledCategories(DEFAULT_SYNC_STATUS), [...DEFAULT_ENABLED_CATEGORIES]);
  assert.equal(DEFAULT_ENABLED_CATEGORIES.includes("clipFavorites"), false);
  assert.ok(zhCN.categories.items.clipFavorites.description.startsWith("默认关闭："));
  assert.ok(en.categories.items.clipFavorites.description.startsWith("Off by default:"));
  assert.deepEqual(DEFAULT_SYNC_STATUS.optionalGroups, []);
});

test("optional sync groups match settings_whitelist.json and explain why each starts off in both locales", () => {
  const whitelistGroups = Object.keys(WHITELIST.optionalGroups ?? {}).sort();
  assert.deepEqual([...OPTIONAL_GROUP_ITEMS].sort(), whitelistGroups);
  for (const group of OPTIONAL_GROUP_ITEMS) {
    assert.ok(zhCN.optional.items[group].title.length > 0, group);
    assert.ok(zhCN.optional.items[group].description.startsWith("默认关闭："), group);
    assert.ok(en.optional.items[group].title.length > 0, group);
    assert.ok(en.optional.items[group].description.startsWith("Off by default:"), group);
  }
});

test("toggling categories and optional groups keeps canonical order without duplicates", () => {
  const withoutLinks = toggleCategoryList(DEFAULT_ENABLED_CATEGORIES, "links", false);
  assert.deepEqual(withoutLinks, ["todos", "snippets", "settings", "presets"]);
  const backOn = toggleCategoryList(withoutLinks, "links", true);
  assert.deepEqual(backOn, [...DEFAULT_ENABLED_CATEGORIES]);
  const withClipFav = toggleCategoryList(DEFAULT_ENABLED_CATEGORIES, "clipFavorites", true);
  assert.deepEqual(withClipFav, [...SYNC_CATEGORY_ITEMS]);

  const opt1 = toggleOptionalGroupList([], "updateChannel", true);
  const opt2 = toggleOptionalGroupList(opt1, "translationProvider", true);
  assert.deepEqual(opt2, ["translationProvider", "updateChannel"]);
  assert.deepEqual(toggleOptionalGroupList(opt2, "translationProvider", false), ["updateChannel"]);
});

test("devices inactive for over 180 days are marked stale", () => {
  const now = Date.UTC(2026, 10, 17);
  assert.equal(isDeviceStale(0, now), false);
  assert.equal(isDeviceStale(now - STALE_DEVICE_MS + 1_000, now), false);
  assert.equal(isDeviceStale(now - STALE_DEVICE_MS - 1_000, now), true);
});
