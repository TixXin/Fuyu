import assert from "node:assert/strict";
import test from "node:test";
import { blockedShortcut } from "../../src/lib/browserDefaults.ts";

const keys = (key, mods = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });
const mac = { mac: true, dev: false };
const win = { mac: false, dev: false };

test("browser shortcuts are blocked on each platform's primary key", () => {
  for (const key of ["p", "f", "s", "u", "n", "=", "-", "0", "["]) {
    assert.equal(blockedShortcut(keys(key, { metaKey: true }), mac), true, `⌘${key}`);
    assert.equal(blockedShortcut(keys(key, { ctrlKey: true }), win), true, `Ctrl+${key}`);
  }
  assert.equal(blockedShortcut(keys("ArrowLeft", { altKey: true }), win), true);
  assert.equal(blockedShortcut(keys("F7"), win), true);
});

test("reload and devtools stay available in dev only", () => {
  assert.equal(blockedShortcut(keys("r", { metaKey: true }), mac), true);
  assert.equal(blockedShortcut(keys("r", { metaKey: true }), { mac: true, dev: true }), false);
  assert.equal(blockedShortcut(keys("F5"), win), true);
  assert.equal(blockedShortcut(keys("F12"), { mac: false, dev: true }), false);
  assert.equal(blockedShortcut(keys("i", { ctrlKey: true, shiftKey: true }), win), true);
  assert.equal(blockedShortcut(keys("i", { metaKey: true, altKey: true }), mac), true);
});

test("typing and the app's own keys are left alone", () => {
  assert.equal(blockedShortcut(keys("a"), mac), false);
  assert.equal(blockedShortcut(keys("k", { metaKey: true }), mac), false);
  assert.equal(blockedShortcut(keys("c", { metaKey: true }), mac), false);
  assert.equal(blockedShortcut(keys("v", { ctrlKey: true }), win), false);
  assert.equal(blockedShortcut(keys("h", { ctrlKey: true }), mac), false);
  assert.equal(blockedShortcut(keys("ArrowLeft", { metaKey: true }), mac), false);
});
