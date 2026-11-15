import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const child = fileURLToPath(new URL("./churn-child.mjs", import.meta.url));

test("in a host process, 1000 loads and unloads of a plugin leave the handles, timers and heap as they were", () => {
  const run = spawnSync(process.execPath, ["--expose-gc", "--disallow-code-generation-from-strings", child, "1000"], { encoding: "utf8", timeout: 60000 });
  assert.equal(run.status, 0, run.stderr);
  const { applied, cleaned, live, before, after, stopped } = JSON.parse(run.stdout);
  assert.equal(applied, 1051);
  assert.equal(cleaned, 1050);
  assert.equal(live, 1);
  assert.deepEqual(after.resources, before.resources, "the same handles and timers are active");
  const heap = (after.heap - before.heap) / 1048576;
  const external = (after.external - before.external) / 1048576;
  assert.ok(heap < 2, `the heap grew by ${heap.toFixed(2)} MB`);
  assert.ok(external < 1, `external memory grew by ${external.toFixed(2)} MB`);
  assert.equal(stopped.live, 0);
  assert.deepEqual(stopped.resources, {}, "nothing is left once the host stops");
});
