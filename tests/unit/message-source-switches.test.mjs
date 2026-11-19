import assert from "node:assert/strict";
import test from "node:test";
import {
  IM_SOURCE_IDS,
  imAutoClearKey,
  imSourceEnabled,
  isImAutoClearEnabled,
  mergedAutoClear,
  MESSAGE_SOURCES,
  migrateSources,
  sourceSwitch,
} from "../../src/features/messages/plugin/sourceSwitches.ts";

test("all ten message sources are unified under messages.config", () => {
  assert.deepEqual(MESSAGE_SOURCES, [
    "qq",
    "wechat",
    "mail",
    "telegram",
    "discord",
    "whatsapp",
    "tim",
    "feishu",
    "dingtalk",
    "wecom",
  ]);
});

test("legacy sources migrate once while the 7 new IM sources stay off on fresh installs and upgrades", () => {
  const write = migrateSources({ qq: false, wechat: true, mail: false }, {});
  assert.deepEqual(write, [["qq", false], ["wechat", true], ["mail", false]]);
  for (const id of IM_SOURCE_IDS) {
    assert.equal(imSourceEnabled({}, id), false);
    assert.equal(imSourceEnabled({ [id]: "true" }, id), false);
    assert.equal(imSourceEnabled({ [id]: true }, id), true);
    assert.equal(isImAutoClearEnabled({}, id), true);
    assert.equal(isImAutoClearEnabled({ [`${id}AutoClear`]: false }, id), false);
  }
});

test("sources already present in messages.config are kept without overwriting or mirroring back", () => {
  const write = migrateSources({ qq: true, wechat: true, mail: true }, { qq: false, mail: false });
  assert.deepEqual(write, [["wechat", true]]);
});

test("only a boolean in messages.config counts as a source switch", () => {
  assert.equal(sourceSwitch({ qq: true }, "qq"), true);
  assert.equal(sourceSwitch({ mail: false }, "mail"), false);
  assert.equal(sourceSwitch({ qq: "false" }, "qq"), undefined);
  assert.equal(sourceSwitch({}, "wechat"), undefined);
});

test("the merged remove-once-seen switch stays on when no source had it off", () => {
  assert.equal(mergedAutoClear({}, { qq: true, wechat: true }), true);
  assert.equal(mergedAutoClear({ telegram: true, [imAutoClearKey("telegram")]: true }, { qq: true, wechat: true }), true);
});

test("one source that had remove-once-seen off turns the merged switch off", () => {
  assert.equal(mergedAutoClear({}, { qq: false, wechat: true }), false);
  assert.equal(mergedAutoClear({}, { qq: true, wechat: false }), false);
  assert.equal(mergedAutoClear({ [imAutoClearKey("feishu")]: false }, { qq: true, wechat: true }), false);
});

test("once the merged switch is saved, the per-source values no longer count", () => {
  assert.equal(mergedAutoClear({ autoClear: true, [imAutoClearKey("feishu")]: false }, { qq: false, wechat: false }), true);
  assert.equal(mergedAutoClear({ autoClear: false }, { qq: true, wechat: true }), false);
  assert.equal(mergedAutoClear({ autoClear: "false" }, { qq: true, wechat: true }), true);
});
