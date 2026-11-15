import assert from "node:assert/strict";
import test from "node:test";

const { pillParts, shortEffort } = await import("../../src/features/agent-status/sessionPill.ts");
const { splitToolDetail } = await import("../../src/features/agent-status/toolDetail.ts");

test("pill splits the model label into model and a short effort", () => {
  assert.deepEqual(pillParts("Opus 5.5 · Medium", "Opus 5.5"), { model: "Opus 5.5", effort: "M" });
  assert.deepEqual(pillParts("Opus 5.5", "Opus 5.5"), { model: "Opus 5.5", effort: null });
  assert.deepEqual(pillParts("High", null), { model: null, effort: "H" });
  assert.deepEqual(pillParts(null, "Opus 5.5"), { model: null, effort: null });
  assert.deepEqual(pillParts("gpt-5.5 · 超高", "gpt-5.5"), { model: "gpt-5.5", effort: "超高" });
  assert.equal(shortEffort("xhigh"), "XH");
});

test("long tool details keep the last path part visible", () => {
  assert.deepEqual(splitToolDetail("npm test"), { head: "npm test", tail: "" });
  assert.deepEqual(splitToolDetail("cd /Users/tixxin/Desktop/projects/Fuyu && node scripts/run-regression.mjs agent"), {
    head: "cd /Users/tixxin/Desktop/projects/Fuyu && node scripts",
    tail: "/run-regression.mjs agent",
  });
  assert.deepEqual(splitToolDetail("C:\\Users\\me\\projects\\fuyu\\src\\features\\agent-status\\Row.tsx"), {
    head: "C:\\Users\\me\\projects\\fuyu\\src\\features\\agent-status",
    tail: "\\Row.tsx",
  });
  const noPath = "echo a very long command without any separators in it at all";
  assert.deepEqual(splitToolDetail(noPath), { head: noPath, tail: "" });
});
