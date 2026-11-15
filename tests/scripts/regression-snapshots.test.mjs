import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { compareSnapshot, lineDiff, snapshotFile } from "../../scripts/regression/snapshots.mjs";

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
