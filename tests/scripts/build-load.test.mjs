import assert from "node:assert/strict";
import { test } from "node:test";
import { backgroundBuildEnv, backgroundJobs } from "../../scripts/build-load.mjs";

test("a background build gets half the logical CPUs, at least two", () => {
  assert.equal(backgroundJobs(20), 10);
  assert.equal(backgroundJobs(7), 3);
  assert.equal(backgroundJobs(2), 2);
  assert.equal(backgroundJobs(1), 2);
});

test("a CARGO_BUILD_JOBS the user set wins", () => {
  assert.deepEqual(backgroundBuildEnv({}, 20), { CARGO_BUILD_JOBS: "10" });
  assert.deepEqual(backgroundBuildEnv({ CARGO_BUILD_JOBS: "4" }, 20), {});
});
