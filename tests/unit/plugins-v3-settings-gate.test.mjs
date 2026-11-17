import assert from "node:assert/strict";
import test from "node:test";
import "./settingsCategorySlot.mjs";
import { isCategoryAvailable } from "../../src/windows/settings/categories.ts";

test("the plugin platform v3 page shows only when Rust reports the host switched on", () => {
  for (const mac of [false, true]) {
    assert.equal(isCategoryAvailable("pluginsV3", new Set(), mac, false), false);
    assert.equal(isCategoryAvailable("pluginsV3", new Set(), mac, true), true);
  }
});
