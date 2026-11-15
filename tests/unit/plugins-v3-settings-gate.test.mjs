import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "./settingsCategorySlot.mjs";
import { isCategoryAvailable } from "../../src/windows/settings/categories.ts";

test("the plugin platform v3 page shows only when Rust reports the host switched on", () => {
  for (const mac of [false, true]) {
    assert.equal(isCategoryAvailable("pluginsV3", new Set(), mac, false), false);
    assert.equal(isCategoryAvailable("pluginsV3", new Set(), mac, true), true);
  }
});

test("the plugin platform v3 window code follows the Rust switch, not the build kind", () => {
  for (const file of ["src/windows/settings/usePluginHostStatus.ts", "src/features/plugin-kernel/runtime.ts", "src/features/plugin-kernel/api.ts", "src/windows/island/usePluginHostEvents.ts"]) {
    assert.ok(!readFileSync(file, "utf8").includes("import.meta.env.DEV"), `${file} must use the host connection's enabled flag`);
  }
  assert.match(readFileSync("src/windows/settings/usePluginHostStatus.ts", "utf8"), /connection\?\.enabled === true/);
});
