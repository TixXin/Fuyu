import assert from "node:assert/strict";
import test from "node:test";
import { reconcileSources, sourceSwitch } from "../../src/features/messages/plugin/sourceSwitches.ts";

const stored = (qq, wechat) => ({ qq, wechat });

test("a source the plugin settings do not have yet takes the old stored value, on or off", () => {
  const result = reconcileSources(stored(false, true), {}, null);
  assert.deepEqual(result.write, [["qq", false], ["wechat", true]]);
  assert.deepEqual(result.mirror, []);
});

test("a new install with no old values writes both sources on, so the listeners start", () => {
  const result = reconcileSources(stored(true, true), { mail: true }, null);
  assert.deepEqual(result.write, [["qq", true], ["wechat", true]]);
});

test("once moved, the plugin settings win and are mirrored back to the old place", () => {
  const result = reconcileSources(stored(true, true), { qq: false, wechat: true }, null);
  assert.deepEqual(result.write, []);
  assert.deepEqual(result.mirror, [["qq", false]]);
});

test("an old value changed from outside (restored backup, onboarding) goes into the plugin settings", () => {
  const seen = stored(true, true);
  const result = reconcileSources(stored(true, false), { qq: true, wechat: true }, seen);
  assert.deepEqual(result.write, [["wechat", false]]);
  assert.deepEqual(result.mirror, []);
});

test("only a true or false in the plugin settings counts as a switch", () => {
  assert.equal(sourceSwitch({ qq: true }, "qq"), true);
  assert.equal(sourceSwitch({ qq: false }, "qq"), false);
  assert.equal(sourceSwitch({ qq: "false" }, "qq"), undefined);
  assert.equal(sourceSwitch({}, "wechat"), undefined);
});
