import assert from "node:assert/strict";
import { test } from "node:test";
import { backgroundBuildEnv, backgroundJobs, efficiencyCores } from "../../scripts/build-load.mjs";

test("a background build gets half the logical CPUs, at least two", () => {
  assert.equal(backgroundJobs(20, 0), 10);
  assert.equal(backgroundJobs(7, 0), 3);
  assert.equal(backgroundJobs(2, 0), 2);
  assert.equal(backgroundJobs(1, 0), 2);
});

test("on a Mac with efficiency cores a background build gets one job per efficiency core", () => {
  assert.equal(backgroundJobs(10, 6), 6);
  assert.equal(backgroundJobs(8, 1), 2);
});

test("only a Mac reports efficiency cores", () => {
  assert.equal(efficiencyCores("win32"), 0);
  assert.equal(efficiencyCores("linux"), 0);
});

test("a CARGO_BUILD_JOBS the user set wins", () => {
  assert.deepEqual(backgroundBuildEnv({}, 20, 0), { CARGO_BUILD_JOBS: "10" });
  assert.deepEqual(backgroundBuildEnv({}, 10, 6), { CARGO_BUILD_JOBS: "6" });
  assert.deepEqual(backgroundBuildEnv({ CARGO_BUILD_JOBS: "4" }, 20, 0), {});
});
