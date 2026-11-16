import assert from "node:assert/strict";
import test from "node:test";
import { storedIslandForm } from "../../src/lib/settings/islandFormMigration.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";
import { islandFormLayout, islandMarginY, shownIslandForm } from "../../src/windows/island/islandForm.ts";

const legacy = { menuBarPlacement: "notch", marginY: 0, opacity: 80 };

test("Mac settings without a form, and new Mac installs, become the automatic form", () => {
  assert.equal(storedIslandForm(legacy, true), "auto");
  assert.equal(storedIslandForm({ opacity: 90 }, true), "auto");
  assert.equal(storedIslandForm(null, true), "auto");
  assert.equal(storedIslandForm({ islandForm: "sideways" }, true), "auto");
});

test("Mac settings that asked to stay under the menu bar keep the top form", () => {
  assert.equal(storedIslandForm({ menuBarPlacement: "below" }, true), "top");
});

test("a form the user already chose is kept on either system", () => {
  for (const form of ["auto", "top", "pill", "notch"]) {
    assert.equal(storedIslandForm({ ...legacy, islandForm: form }, true), form);
    assert.equal(storedIslandForm({ ...legacy, islandForm: form }, false), form);
  }
});

test("Windows settings without a form stay on the top form", () => {
  assert.equal(storedIslandForm(legacy, false), "top");
  assert.equal(storedIslandForm(null, false), "top");
  assert.equal(normalizeSettings(legacy).islandForm, "top");
  assert.equal(normalizeSettings({ ...legacy, islandForm: "notch" }).islandForm, "notch");
});

test("the automatic form is laid out as top until the island learns its screen", () => {
  const auto = { islandForm: "auto", marginY: 12, menuBarPlacement: "below" };
  assert.deepEqual(islandFormLayout(auto), { marginY: 12, underMenuBar: true, fitNotch: false, autoForm: true });
  assert.equal(islandFormLayout({ ...auto, islandForm: "notch" }).autoForm, false);
  assert.equal(shownIslandForm("auto", null), "top");
  assert.equal(shownIslandForm("auto", "notch"), "notch");
  assert.equal(shownIslandForm("pill", "notch"), "pill");
  assert.equal(islandMarginY(auto, "notch"), 0);
  assert.equal(islandMarginY(auto, "top"), 12);
});
