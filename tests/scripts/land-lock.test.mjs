import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { landBusyNote, takeLandLock } from "../../scripts/mq/landLock.mjs";

const withDir = (fn) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "land-lock-"));
  try {
    fn(path.join(dir, "fuyu-land.lock"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("the first full land takes the lock and a second one is turned away", () => withDir((file) => {
  const first = takeLandLock({ file, pid: 10, isAlive: () => true, now: () => 0 });
  assert.equal(first.ok, true);
  const second = takeLandLock({ file, pid: 11, isAlive: () => true });
  assert.equal(second.ok, false);
  assert.equal(second.holder.pid, 10);
  first.release();
  assert.equal(takeLandLock({ file, pid: 11 }).ok, true);
}));

test("a lock left by a land that died is taken over", () => withDir((file) => {
  writeFileSync(file, JSON.stringify({ pid: 999999, since: 0 }));
  assert.equal(takeLandLock({ file, pid: 12, isAlive: () => false }).ok, true);
}));

test("the busy note says who holds it and what happens to the commits", () => {
  const note = landBusyNote({ pid: 77, since: 0 }, 5 * 60_000);
  assert.match(note, /pid 77，5 分钟前开始/);
  assert.match(note, /--only/);
});
