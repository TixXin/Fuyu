import assert from "node:assert/strict";
import { test } from "node:test";
import { bundleText, parseRecommendedBundle, recommendedBundle } from "../../src/lib/onboarding-bundle/recommend.ts";

const text = (zh, en) => ({ "zh-CN": zh, en });
const plugin = (name, zh, en) => ({ name, displayName: text(zh, en) });
const bundle = (id, onboarding, members) => ({ id, displayName: text(`${id} 套装`, `${id} bundle`), description: text("一起装", "Installed together"), onboarding, members });
const PLUGINS = [plugin("@fuyu/pomodoro", "番茄钟", "Pomodoro"), plugin("@fuyu/todo-ring", "待办进度环", "To-do ring"), plugin("@fuyu/todo-digest", "待办摘要", "To-do digest")];

test("the guide is offered the first bundle marked for onboarding that still has something to install", () => {
  const snapshot = {
    plugins: PLUGINS,
    bundles: [
      bundle("plain", false, [{ name: "@fuyu/pomodoro", state: "available" }, { name: "@fuyu/todo-ring", state: "available" }]),
      bundle("owned", true, [{ name: "@fuyu/pomodoro", state: "installed" }, { name: "@fuyu/todo-ring", state: "disabled" }]),
      bundle("flow", true, [{ name: "@fuyu/pomodoro", state: "installed" }, { name: "@fuyu/todo-ring", state: "available" }, { name: "@fuyu/todo-digest", state: "unavailable" }, { name: "@gone/missing", state: "available" }]),
      bundle("later", true, [{ name: "@fuyu/pomodoro", state: "available" }, { name: "@fuyu/todo-ring", state: "available" }]),
    ],
  };
  assert.deepEqual(recommendedBundle(snapshot), {
    id: "flow",
    displayName: text("flow 套装", "flow bundle"),
    description: text("一起装", "Installed together"),
    members: [
      { name: "@fuyu/pomodoro", displayName: text("番茄钟", "Pomodoro") },
      { name: "@fuyu/todo-ring", displayName: text("待办进度环", "To-do ring") },
      { name: "@gone/missing", displayName: text("@gone/missing", "@gone/missing") },
    ],
  });
});

test("nothing is offered without a catalog, without bundles, or when every onboarding bundle is installed", () => {
  assert.equal(recommendedBundle(null), null);
  assert.equal(recommendedBundle({ plugins: PLUGINS }), null);
  assert.equal(recommendedBundle({ plugins: PLUGINS, bundles: [bundle("owned", true, [{ name: "@fuyu/pomodoro", state: "installed" }, { name: "@fuyu/todo-ring", state: "installed" }])] }), null);
  assert.equal(recommendedBundle({ plugins: PLUGINS, bundles: [bundle("plain", false, [{ name: "@fuyu/pomodoro", state: "available" }, { name: "@fuyu/todo-ring", state: "available" }])] }), null);
});

test("what the island stored reads back the same, and anything else reads as nothing", () => {
  const stored = recommendedBundle({ plugins: PLUGINS, bundles: [bundle("flow", true, [{ name: "@fuyu/pomodoro", state: "available" }, { name: "@fuyu/todo-ring", state: "available" }])] });
  assert.deepEqual(parseRecommendedBundle(JSON.parse(JSON.stringify(stored))), stored);
  for (const broken of [null, 7, "flow", [], {}, { ...stored, id: "" }, { ...stored, displayName: "flow" }, { ...stored, description: { en: "only english" } }, { ...stored, members: [] }, { ...stored, members: [{ name: 3 }, "x"] }]) {
    assert.equal(parseRecommendedBundle(broken), null);
  }
});

test("stored members beyond six and over-long text are cut, so a bad record cannot flood the card", () => {
  const members = Array.from({ length: 9 }, (_, index) => ({ name: `@a/p${index}`, displayName: text("名".repeat(500), "n".repeat(500)) }));
  const parsed = parseRecommendedBundle({ id: "big", displayName: text("大", "Big"), description: text("说明", "About"), members });
  assert.equal(parsed.members.length, 6);
  assert.equal(parsed.members[0].displayName.en.length, 200);
});

test("text follows the interface language and falls back to the other one", () => {
  assert.equal(bundleText(text("番茄工作法", "Pomodoro flow"), "en"), "Pomodoro flow");
  assert.equal(bundleText(text("番茄工作法", "Pomodoro flow"), "zh-CN"), "番茄工作法");
  assert.equal(bundleText(text("番茄工作法", ""), "en"), "番茄工作法");
  assert.equal(bundleText(text("", "Pomodoro flow"), "zh-CN"), "Pomodoro flow");
});
