import assert from "node:assert/strict";
import { test } from "node:test";
import { answerBisect, bisectOffList, startBisect } from "../../src/windows/settings/pluginBisect.ts";

test("startBisect and answerBisect narrow 5 third-party plugins down to the single culprit", () => {
  assert.deepEqual(startBisect([]), { phase: "idle" });

  let step = startBisect(["@a/one", "@b/two", "@c/three", "@d/four", "@e/five"]);
  assert.equal(step.phase, "testing");
  assert.equal(step.step, 1);
  assert.deepEqual(step.testedOff, ["@a/one", "@b/two", "@c/three"]);
  assert.deepEqual(bisectOffList(step), ["@a/one", "@b/two", "@c/three"]);

  step = answerBisect(step, "still-broken");
  assert.equal(step.phase, "testing");
  assert.equal(step.step, 2);
  assert.deepEqual(step.candidates, ["@d/four", "@e/five"]);
  assert.deepEqual(step.testedOff, ["@d/four"]);

  step = answerBisect(step, "still-broken");
  assert.deepEqual(step, { phase: "found", culprit: "@e/five", step: 2 });
  assert.deepEqual(bisectOffList(step), ["@e/five"]);
});

test("answerBisect identifies culprit when first half fixes the issue, and reports clear when single plugin does not fix it", () => {
  let step = startBisect(["@a/one", "@b/two"]);
  assert.deepEqual(step.testedOff, ["@a/one"]);
  step = answerBisect(step, "fixed");
  assert.deepEqual(step, { phase: "found", culprit: "@a/one", step: 1 });

  let single = startBisect(["@only/one"]);
  assert.deepEqual(single.testedOff, ["@only/one"]);
  single = answerBisect(single, "still-broken");
  assert.deepEqual(single, { phase: "clear", step: 1 });
  assert.deepEqual(bisectOffList(single), []);
});
