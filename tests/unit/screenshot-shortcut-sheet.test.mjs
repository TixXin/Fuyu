import assert from "node:assert/strict";
import test from "node:test";
import { ANNOTATION_TOOLS, TOOL_KEYS } from "../../src/features/screenshot/annotations.ts";
import { DEFAULT_SCREENSHOT_SETTINGS, normalizeScreenshotSettings } from "../../src/features/screenshot/settings.ts";
import { cornerPosition, nearestCorner, shortcutSheet } from "../../src/features/screenshot/shortcutSheet.ts";

const keysOf = (groups) => groups.flatMap((group) => group.rows.flatMap((row) => row.keys));

test("after a region is chosen the sheet lists every annotation tool with the key the overlay listens for", () => {
  const tools = shortcutSheet("edit", false).find((group) => group.section === "tools");
  assert.deepEqual(tools.rows.map((row) => [row.id, row.keys[0]]), ANNOTATION_TOOLS.map((tool) => [tool, TOOL_KEYS[tool]]));
});

test("the sheet is the same before and after a region is chosen, so it never jumps in size", () => {
  assert.deepEqual(shortcutSheet("pick", false), shortcutSheet("edit", false));
  assert.deepEqual(shortcutSheet("pick", true), shortcutSheet("edit", true));
});

test("the sheet's own toggle key is not one of the tool keys", () => {
  assert.ok(!Object.values(TOOL_KEYS).includes("?"));
  for (const phase of ["pick", "edit", "record"]) assert.ok(keysOf(shortcutSheet(phase, false)).includes("?"), `${phase} tells how to collapse the sheet`);
});

test("measuring is shown as holding M, and only recording mentions F and G", () => {
  const measure = shortcutSheet("pick", false)[0].rows.find((row) => row.id === "measure");
  assert.deepEqual([measure.word, measure.keys], ["hold", ["M"]]);
  assert.ok(!keysOf(shortcutSheet("pick", false)).includes("F"));
  assert.ok(keysOf(shortcutSheet("record", false)).includes("F") && keysOf(shortcutSheet("record", false)).includes("G"));
});

test("Mac key names use the command key", () => {
  const finish = shortcutSheet("edit", true).find((group) => group.section === "finish").rows;
  assert.deepEqual(finish.find((row) => row.id === "save").keys, ["⌘", "S"]);
  assert.deepEqual(finish.find((row) => row.id === "deleteMark").keys, ["⌫"]);
});

test("a dropped sheet snaps to the corner nearest its centre and sits 12 px in from it", () => {
  const view = { width: 1920, height: 1080 };
  const size = { width: 300, height: 200 };
  assert.equal(nearestCorner({ x: 1500, y: 100, ...size }, view), "tr");
  assert.equal(nearestCorner({ x: 10, y: 800, ...size }, view), "bl");
  assert.deepEqual(cornerPosition("bl", view, size), { x: 12, y: 868 });
  assert.deepEqual(cornerPosition("tr", view, size), { x: 1608, y: 12 });
});

test("the sheet starts open in the bottom-left; unknown saved values fall back to that", () => {
  assert.equal(DEFAULT_SCREENSHOT_SETTINGS.shortcutPanel, "open");
  assert.equal(DEFAULT_SCREENSHOT_SETTINGS.shortcutCorner, "bl");
  const odd = normalizeScreenshotSettings({ shortcutPanel: "maybe", shortcutCorner: "middle" });
  assert.deepEqual([odd.shortcutPanel, odd.shortcutCorner], ["open", "bl"]);
  const saved = normalizeScreenshotSettings({ shortcutPanel: "off", shortcutCorner: "tr" });
  assert.deepEqual([saved.shortcutPanel, saved.shortcutCorner], ["off", "tr"]);
});
