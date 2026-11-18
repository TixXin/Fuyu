import assert from "node:assert/strict";
import test from "node:test";
import { hasLoadedI18n, preloadI18n } from "../../src/i18n/runtime.ts";
import { serviceFeaturesForWindow } from "../../src/windowServicesMap.ts";

test("lightweight windows load zero feature window services while interactive windows load only needed ones", () => {
  for (const kind of ["pin", "drag-grid", "clipboard-preview", "tray-menu", "onboarding"]) {
    assert.deepEqual(serviceFeaturesForWindow(kind), [], kind);
  }
  assert.deepEqual(serviceFeaturesForWindow("translation"), ["translation"]);
  assert.deepEqual(serviceFeaturesForWindow("clipboard"), ["clipboard", "translation"]);
  assert.deepEqual(serviceFeaturesForWindow("screenshot"), ["agent-status", "file-shelf", "translation"]);
  assert.equal(serviceFeaturesForWindow("settings").includes("todos"), false);
  assert.equal(serviceFeaturesForWindow("settings").includes("agent-status"), true);
  assert.equal(serviceFeaturesForWindow(null).length, 10);
});

test("preloadI18n loads only core copy for lightweight windows and layers settings and onboarding slices on demand", async () => {
  assert.equal(hasLoadedI18n("en", "pin"), false);
  const pinEn = await preloadI18n("en", "pin");
  assert.equal(pinEn.trayMenu.quit, "Quit");
  assert.equal(pinEn.settings.project.appName, "Fuyu");
  assert.equal("pluginsV3" in pinEn.settings, false);
  assert.equal("hello" in pinEn.onboarding, false);
  assert.equal(hasLoadedI18n("en", "pin"), true);
  assert.equal(hasLoadedI18n("en", "settings"), false);
  assert.equal(hasLoadedI18n("en", null), false);

  const mainEn = await preloadI18n("en", null);
  assert.equal(typeof mainEn.onboarding.islandName, "string");
  assert.equal("pluginsV3" in mainEn.settings, false);
  assert.equal(hasLoadedI18n("en", null), true);
  assert.equal(hasLoadedI18n("en", "onboarding"), false);

  const onboardingEn = await preloadI18n("en", "onboarding");
  assert.equal(typeof onboardingEn.onboarding.hello.title, "string");
  assert.equal(onboardingEn.settings.categories.appearance, "Position and size");
  assert.equal(hasLoadedI18n("en", "settings"), true);
  assert.equal(hasLoadedI18n("en", "onboarding"), true);
});
