import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const child = fileURLToPath(new URL("./host-child.mjs", import.meta.url));

function run(flags) {
  const result = spawnSync(process.execPath, [...flags, child], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("the host runs with code generation from strings disallowed, as the release host does", () => {
  const { codegen, status, live } = run(["--disallow-code-generation-from-strings"]);
  assert.equal(codegen, "blocked");
  assert.deepEqual(status.map((entry) => [entry.id, entry.state]), [["user", "running"], ["counter", "running"]]);
  assert.equal(live, 0, "stopping the host ran every cleanup");
});

test("the host loads plugins without --expose-internals, which only hot reload needs", () => {
  const { status } = run([]);
  assert.ok(status.every((entry) => entry.state === "running"));
});
