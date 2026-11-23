import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LAUNCHER, hiddenBuiltins, launcherGrid, moveItem, normalizeLauncher, serializeLauncher, withApp } from "../../src/features/system-widgets/launcherItems.ts";

test("a missing or unreadable list falls back to the four built-in items", () => {
  assert.deepEqual(normalizeLauncher(undefined), DEFAULT_LAUNCHER);
  assert.deepEqual(normalizeLauncher({ version: 2, items: [] }), DEFAULT_LAUNCHER);
  assert.deepEqual(normalizeLauncher({ version: 1, items: "x" }), DEFAULT_LAUNCHER);
});

test("an emptied list stays empty instead of coming back as the defaults", () => {
  const stored = serializeLauncher([]);
  assert.deepEqual(normalizeLauncher(JSON.parse(JSON.stringify(stored))), []);
});

test("unknown built-ins, empty paths and duplicates are dropped when reading", () => {
  const items = normalizeLauncher({
    version: 1,
    items: [{ builtin: "rm" }, { builtin: "files" }, { builtin: "files" }, { path: "" }, { path: "C:\\Apps\\Code.exe", name: " Code " }, { path: "c:\\apps\\code.exe", name: "again" }],
  });
  assert.deepEqual(items, [{ builtin: "files" }, { path: "C:\\Apps\\Code.exe", name: "Code" }]);
});

test("adding an app appends it once, and removed built-ins can be offered back", () => {
  const once = withApp(DEFAULT_LAUNCHER, "/Applications/Safari.app", "Safari");
  assert.equal(once.length, 5);
  assert.deepEqual(withApp(once, "/Applications/Safari.app", "Safari"), once);
  assert.deepEqual(hiddenBuiltins(once.filter((item) => !("builtin" in item) || item.builtin !== "calculator")), ["calculator"]);
});

test("moving an item puts it at the target position", () => {
  assert.deepEqual(moveItem([{ builtin: "terminal" }, { builtin: "files" }, { builtin: "settings" }], 0, 2), [{ builtin: "files" }, { builtin: "settings" }, { builtin: "terminal" }]);
  assert.deepEqual(moveItem([{ builtin: "terminal" }], 0, 5), [{ builtin: "terminal" }]);
});

test("the grid keeps big tiles while they fit and shrinks them for more apps", () => {
  assert.equal(launcherGrid(4, 96, 98).tile, 40);
  assert.equal(launcherGrid(5, 96, 98).tile, 28);
  assert.equal(launcherGrid(5, 96, 98).capacity, 9);
  assert.deepEqual([launcherGrid(8, 224, 98).tile, launcherGrid(8, 224, 98).columns], [40, 4]);
  assert.ok(launcherGrid(30, 96, 98).capacity < 30);
});
