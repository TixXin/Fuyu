import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { run } from "../../scripts/heavy/heavy.mjs";

const exitWith = (code) => ["--", "node", "-e", `process.exit(${code})`];

test("the build cache is pruned after every queued job, also when the job fails", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "heavy-run-"));
  const saved = { dir: process.env.FUYU_HEAVY_DIR, slots: process.env.FUYU_HEAVY_SLOTS };
  process.env.FUYU_HEAVY_DIR = dir;
  process.env.FUYU_HEAVY_SLOTS = "1";
  try {
    let pruned = 0;
    const env = { ...process.env, FUYU_HEAVY: "" };
    assert.equal(run(exitWith(3), env, { afterJob: () => { pruned += 1; } }), 3);
    assert.equal(run(exitWith(0), env, { afterJob: () => { pruned += 1; } }), 0);
    assert.equal(pruned, 2);
  } finally {
    for (const [key, value] of [["FUYU_HEAVY_DIR", saved.dir], ["FUYU_HEAVY_SLOTS", saved.slots]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a job nested inside another queued job leaves pruning to the outer one", () => {
  let pruned = 0;
  assert.equal(run(exitWith(0), { ...process.env, FUYU_HEAVY: "1" }, { afterJob: () => { pruned += 1; } }), 0);
  assert.equal(pruned, 0);
});
