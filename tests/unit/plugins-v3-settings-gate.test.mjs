import assert from "node:assert/strict";
import test from "node:test";
import "./settingsCategorySlot.mjs";
import { isCategoryAvailable } from "../../src/windows/settings/categories.ts";

test("the plugin platform v3 page is always available across platforms even when the host is off", () => {
  for (const mac of [false, true]) {
    assert.equal(isCategoryAvailable("pluginsV3", new Set(), mac), true);
  }
});
