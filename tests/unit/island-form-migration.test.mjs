import assert from "node:assert/strict";
import test from "node:test";
import { legacyIslandForm, needsIslandFormMigration } from "../../src/lib/settings/islandFormMigration.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

const legacy = JSON.stringify({ menuBarPlacement: "notch", marginY: 0, opacity: 80 });
const mac = (notch) => ({ mac: true, notch });

test("old Mac settings on a screen with a real notch become the notch form", () => {
  assert.equal(legacyIslandForm(legacy, mac(true)), "notch");
  assert.equal(normalizeSettings({ ...JSON.parse(legacy), islandForm: "notch" }).islandForm, "notch");
});

test("old Mac settings without a real notch become the top form", () => {
  assert.equal(legacyIslandForm(legacy, mac(false)), "top");
});

test("old Windows settings are left alone and still read as the top form", () => {
  assert.equal(needsIslandFormMigration(legacy, false), false);
  assert.equal(legacyIslandForm(legacy, { mac: false, notch: false }), null);
  assert.equal(normalizeSettings(JSON.parse(legacy)).islandForm, "top");
});

test("settings with a form, under the menu bar, or unreadable are left alone", () => {
  assert.equal(legacyIslandForm(JSON.stringify({ islandForm: "pill" }), mac(true)), null);
  assert.equal(legacyIslandForm(JSON.stringify({ menuBarPlacement: "below" }), mac(true)), null);
  assert.equal(legacyIslandForm(null, mac(true)), null);
  assert.equal(legacyIslandForm("not json", mac(true)), null);
  assert.equal(legacyIslandForm("[]", mac(true)), null);
});

test("settings saved before the menu bar option existed count as over the menu bar", () => {
  assert.equal(legacyIslandForm(JSON.stringify({ opacity: 90 }), mac(true)), "notch");
});
