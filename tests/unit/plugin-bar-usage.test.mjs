import assert from "node:assert/strict";
import test from "node:test";
import { barUsageReport, readBarUsageReport } from "../../src/features/plugin-kernel/barUsage.ts";
import { barUsageModel, swapBarItems } from "../../src/windows/settings/barUsageRows.ts";

const entry = (id, extra = {}) => ({ id, title: id.toUpperCase(), running: true, declaresBar: true, settings: false, ...extra });
const box = (left, width, wanted = width) => ({ left, width, wanted, clipped: wanted > width });
const item = (id, owner, itemBox = null, hideable = true) => ({ id, owner, hideable, box: itemBox });
const report = (items, barWidth = 400) => ({ id: 1, collapsed: barWidth !== null, barWidth, items });

test("the island reports only plugin items, and no boxes while the bar is not on screen", () => {
  const candidates = [
    { id: "status-light", owner: "builtin", external: false },
    { id: "weather", owner: "@fuyu/weather", external: true },
    { id: "weather", owner: "@fuyu/weather", external: true },
    { id: "ring", owner: "@fuyu/todo-ring", external: true, group: "gauges" },
    { id: "cpu", owner: "@fuyu/monitor", external: true, group: "gauges", hideable: true },
  ];
  const boxes = { weather: { left: 300.4, width: 64, wanted: 64, clipped: false }, ring: { left: 380, width: 0, wanted: 0, clipped: false } };
  const shown = barUsageReport(7, candidates, 412.6, (id) => boxes[id]);
  assert.deepEqual(shown, {
    id: 7,
    collapsed: true,
    barWidth: 413,
    items: [
      { id: "weather", owner: "@fuyu/weather", hideable: true, box: { left: 300, width: 64, wanted: 64, clipped: false } },
      { id: "ring", owner: "@fuyu/todo-ring", hideable: false, box: null },
      { id: "cpu", owner: "@fuyu/monitor", hideable: true, box: null },
    ],
  });
  const open = barUsageReport(8, candidates, null, (id) => boxes[id]);
  assert.equal(open.collapsed, false);
  assert.equal(open.barWidth, null);
  assert.ok(open.items.every((entry) => entry.box === null));
});

test("a report read from another window drops what it cannot use", () => {
  assert.equal(readBarUsageReport(null), null);
  assert.equal(readBarUsageReport({ id: "1", items: [] }), null);
  const read = readBarUsageReport({
    id: 3,
    collapsed: true,
    barWidth: 400,
    items: [{ id: "weather", owner: "@fuyu/weather", box: { left: 10, width: 40, wanted: 30, clipped: "yes" } }, { id: "", owner: "x" }, { id: "y" }, "junk", { id: "z", owner: "@a/z", hideable: false, box: { left: "1" } }],
  });
  assert.deepEqual(read.items, [
    { id: "weather", owner: "@fuyu/weather", hideable: true, box: { left: 10, width: 40, wanted: 40, clipped: false } },
    { id: "z", owner: "@a/z", hideable: false, box: null },
  ]);
  assert.equal(readBarUsageReport({ id: 4, collapsed: true, barWidth: 0, items: [] }).collapsed, false);
});

test("rows follow the bar from left to right, then list what is not showing with the reason", () => {
  const entries = [entry("clock"), entry("weather", { settings: true }), entry("issues"), entry("off", { running: false }), entry("quiet"), entry("plain", { declaresBar: false }), entry("taken")];
  const model = barUsageModel(
    entries,
    report([item("w", "weather", box(300, 64)), item("c", "clock", box(120, 40, 62)), item("i", "issues"), item("t", "taken", box(370, 20)), item("x", "stranger", box(0, 10))]),
    [{ id: "t", zone: "right", hidden: true }, { id: "c", zone: "left" }],
  );
  assert.deepEqual(model.rows.map((row) => [row.key, row.state]), [["c", "clipped"], ["w", "shown"], ["t", "hidden"], ["i", "idle"], ["plugin:quiet", "idle"], ["plugin:off", "off"]]);
  assert.deepEqual([model.measured, model.barWidth, model.used, model.plugins, model.clipped], [true, 400, 104, 2, 1]);
  const [clock, weather, taken] = model.rows;
  assert.deepEqual([clock.left, clock.width, clock.cut, clock.zone], [120, 40, 22, "left"]);
  assert.deepEqual([weather.zone, weather.settings, weather.cut], ["right", true, 0]);
  assert.deepEqual([taken.left, taken.width], [null, null]);
  assert.equal(model.rows.at(-1).item, null);
});

test("an item the user cannot hide is not called hidden, and an unmeasured bar marks nothing as showing", () => {
  const fixed = barUsageModel([entry("ring")], report([item("r", "ring", box(10, 20), false)]), [{ id: "r", zone: "right", hidden: true }]);
  assert.equal(fixed.rows[0].state, "shown");
  const open = barUsageModel([entry("weather"), entry("off", { running: false }), entry("later")], report([item("w", "weather")], null), []);
  assert.deepEqual(open.rows.map((row) => [row.key, row.state]), [["w", "unmeasured"], ["plugin:later", "unmeasured"], ["plugin:off", "off"]]);
  assert.deepEqual([open.measured, open.barWidth, open.used, open.plugins], [false, null, 0, 0]);
  const silent = barUsageModel([entry("weather"), entry("plain", { declaresBar: false })], null, []);
  assert.deepEqual(silent.rows.map((row) => [row.key, row.state]), [["plugin:weather", "unmeasured"]]);
  assert.deepEqual(barUsageModel([entry("plain", { declaresBar: false })], null, []).rows, []);
});

test("moving swaps a plugin item with the next plugin item on the same side", () => {
  const entries = [entry("a"), entry("b"), entry("c"), entry("d")];
  const saved = [{ id: "status-light", zone: "left" }, { id: "a", zone: "right" }, { id: "music", zone: "right" }, { id: "b", zone: "right" }, { id: "c", zone: "left" }, { id: "d", zone: "right" }];
  const model = barUsageModel(entries, report([item("a", "a", box(200, 30)), item("b", "b", box(260, 30)), item("c", "c", box(20, 30)), item("d", "d")]), saved);
  const neighbours = Object.fromEntries(model.rows.map((row) => [row.key, [row.before, row.after]]));
  assert.deepEqual(neighbours, { c: [null, null], a: [null, "b"], b: ["a", null], d: [null, null] });
  assert.deepEqual(swapBarItems(model.placements, "a", "b").map(({ id }) => id), ["status-light", "b", "music", "a", "c", "d"]);
  assert.deepEqual(swapBarItems(model.placements, "a", "missing"), model.placements);
  const fresh = barUsageModel(entries.slice(0, 2), report([item("a", "a", box(200, 30)), item("b", "b", box(260, 30))]), []);
  assert.deepEqual(fresh.placements, [{ id: "a", zone: "right" }, { id: "b", zone: "right" }]);
});
