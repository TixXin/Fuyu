import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compareSnapshot, lineDiff, settledSnapshot, snapshotFile, UNSETTLED_PAGES } from "../../scripts/regression/snapshots.mjs";

test("snapshot files are named after the page, light ones get a suffix", () => {
  assert.equal(snapshotFile("/r", "collapsed-slots.html?test=1", "dark"), path.join("/r", "tests/regression/snapshots/collapsed-slots.html"));
  assert.equal(snapshotFile("/r", "calendar.html", "light"), path.join("/r", "tests/regression/snapshots/calendar.light.html"));
});

test("lineDiff shows the changed line with context", () => {
  const before = ["<div>", "  <span class=\"a\">", "  </span>", "</div>"].join("\n");
  const after = ["<div>", "  <span class=\"b\">", "  </span>", "</div>"].join("\n");
  const { changes, text } = lineDiff(before, after);
  assert.equal(changes, 2);
  assert.match(text, /^- {3}<span class="a">$/m);
  assert.match(text, /^\+ {3}<span class="b">$/m);
});

test("compareSnapshot reports missing, same, changed and writes only when updating", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fuyu-snap-"));
  try {
    assert.equal(compareSnapshot(root, "x.html", "dark", "a\n", false).status, "missing");
    assert.equal(compareSnapshot(root, "x.html", "dark", "a\n", true).status, "created");
    assert.equal(compareSnapshot(root, "x.html", "dark", "a\n", false).status, "same");
    writeFileSync(snapshotFile(root, "x.html", "dark"), "a\r\n");
    assert.equal(compareSnapshot(root, "x.html", "dark", "a\n", false).status, "same");
    const changed = compareSnapshot(root, "x.html", "dark", "b\n", false);
    assert.equal(changed.status, "changed");
    assert.equal(readFileSync(snapshotFile(root, "x.html", "dark"), "utf8"), "a\r\n");
    assert.equal(compareSnapshot(root, "x.html", "dark", "b\n", true).status, "updated");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a light snapshot equal to the dark one is not stored and still compared", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fuyu-snap-"));
  try {
    compareSnapshot(root, "y.html", "dark", "d\n", true);
    assert.equal(compareSnapshot(root, "y.html", "light", "d\n", true, "d\n").status, "same");
    assert.equal(existsSync(snapshotFile(root, "y.html", "light")), false);
    assert.equal(compareSnapshot(root, "y.html", "light", "d\n", false, "d\n").status, "same");
    assert.equal(compareSnapshot(root, "y.html", "light", "l\n", false, "d\n").status, "changed");
    assert.equal(compareSnapshot(root, "y.html", "light", "l\n", true, "d\n").status, "created");
    assert.equal(compareSnapshot(root, "y.html", "light", "d\n", true, "d\n").status, "removed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("with no light file, a light result equal to the stored dark snapshot passes even when this run's dark capture was off", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fuyu-snap-"));
  try {
    compareSnapshot(root, "z.html", "dark", "d\n", true);
    assert.equal(compareSnapshot(root, "z.html", "light", "d\n", false, "mid-transition\n").status, "same");
    const changed = compareSnapshot(root, "z.html", "light", "l\n", false, "mid-transition\n");
    assert.equal(changed.status, "changed");
    assert.ok(changed.diff.changes > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function captures(...values) {
  let calls = 0;
  const waits = [];
  return { capture: async () => values[Math.min(calls++, values.length - 1)], sleep: async (ms) => { waits.push(ms); }, waits, count: () => calls };
}

test("a capture that differs is taken once more after a wait, and passes when the page had only settled late", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fuyu-snap-"));
  try {
    compareSnapshot(root, "s.html", "dark", "settled\n", true);
    const quick = captures("settled\n");
    assert.deepEqual(await settledSnapshot({ root, page: "s.html", variant: "dark", update: false, darkActual: null, ...quick }), { status: "same", label: path.join("tests/regression/snapshots", "s.html"), actual: "settled\n" });
    assert.equal(quick.count(), 1);
    const late = captures("mid\n", "settled\n");
    const settled = await settledSnapshot({ root, page: "s.html", variant: "dark", update: false, darkActual: null, ...late });
    assert.equal(settled.status, "same");
    assert.equal(settled.late, true);
    assert.equal(settled.actual, "settled\n");
    assert.deepEqual(late.waits, [1000]);
    const wrong = await settledSnapshot({ root, page: "s.html", variant: "dark", update: false, darkActual: null, ...captures("other\n") });
    assert.equal(wrong.status, "changed");
    assert.equal(wrong.late, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("updating refuses a page whose DOM is still changing, except the listed pages", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "fuyu-snap-"));
  try {
    const moving = captures("a\n", "b\n");
    const refused = await settledSnapshot({ root, page: "u.html?test=1", variant: "dark", update: true, darkActual: null, ...moving });
    assert.equal(refused.status, "unsettled");
    assert.deepEqual(moving.waits, [1500]);
    assert.equal(existsSync(snapshotFile(root, "u.html", "dark")), false);
    const still = await settledSnapshot({ root, page: "u.html?test=1", variant: "dark", update: true, darkActual: null, ...captures("a\n") });
    assert.equal(still.status, "created");
    assert.equal(readFileSync(snapshotFile(root, "u.html", "dark"), "utf8"), "a\n");
    const unchanged = captures("a\n");
    assert.equal((await settledSnapshot({ root, page: "u.html?test=1", variant: "dark", update: true, darkActual: null, ...unchanged })).status, "same");
    assert.deepEqual(unchanged.waits, []);
    const listed = UNSETTLED_PAGES[0];
    assert.equal((await settledSnapshot({ root, page: listed, variant: "dark", update: true, darkActual: null, ...captures("a\n", "b\n") })).status, "created");
    assert.equal(readFileSync(snapshotFile(root, listed, "dark"), "utf8"), "a\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
