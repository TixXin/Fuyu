import assert from "node:assert/strict";
import test from "node:test";

import { autoHookKey, autoHookTargets, hookWork, repairTargets } from "../../src/features/agent-status/hookPlan.ts";

const PROVIDERS = ["codex", "claudeCode", "qoder", "dsh", "grok"];
const AUTO = { install: true, update: true };

test("hook work lists outdated and missing hooks of agents that are switched on", () => {
  const state = { codex: "current", claudeCode: "outdated", qoder: "notInstalled", dsh: "outdated", grok: "notInstalled", scriptsOutdated: false };
  assert.deepEqual(hookWork(state, PROVIDERS, ["dsh", "grok"]), { fix: ["claudeCode"], install: ["qoder"], scriptsOutdated: false });
});

test("outdated scripts alone are repaired through one connected agent", () => {
  const state = { codex: "absent", claudeCode: "current", qoder: "current", scriptsOutdated: true };
  assert.deepEqual(repairTargets(state, PROVIDERS, []), ["claudeCode"]);
  assert.deepEqual(repairTargets({ ...state, scriptsOutdated: false }, PROVIDERS, []), []);
});

test("nothing is set up automatically on a computer that never had hooks", () => {
  const state = { codex: "notInstalled", claudeCode: "notInstalled", qoder: "notInstalled", scriptsOutdated: false };
  assert.deepEqual(autoHookTargets(state, PROVIDERS, [], AUTO, new Set()), []);
  assert.deepEqual(autoHookTargets(null, PROVIDERS, [], AUTO, new Set()), []);
});

test("new agents and outdated hooks follow their own switch", () => {
  const state = { codex: "current", claudeCode: "outdated", qoder: "notInstalled", dsh: "absent", grok: "notInstalled", scriptsOutdated: false };
  assert.deepEqual(autoHookTargets(state, PROVIDERS, ["grok"], AUTO, new Set()), ["claudeCode", "qoder"]);
  assert.deepEqual(autoHookTargets(state, PROVIDERS, ["grok"], { install: false, update: true }, new Set()), ["claudeCode"]);
  assert.deepEqual(autoHookTargets(state, PROVIDERS, ["grok"], { install: true, update: false }, new Set()), ["qoder"]);
});

test("an agent tried in the same state is not tried again until its state changes", () => {
  const state = { codex: "current", dsh: "outdated", scriptsOutdated: false };
  const tried = new Set([autoHookKey(state, "dsh")]);
  assert.deepEqual(autoHookTargets(state, PROVIDERS, [], AUTO, tried), []);
  assert.deepEqual(autoHookTargets({ ...state, dsh: "notInstalled" }, PROVIDERS, [], AUTO, tried), ["dsh"]);
});
