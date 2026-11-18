import assert from "node:assert/strict";
import test from "node:test";
import { hasInstalledAgentHooks } from "../../src/features/agent-status/status.ts";

test("returns false when hooks state is null or every agent is absent or notInstalled", () => {
  assert.equal(hasInstalledAgentHooks(null), false);
  assert.equal(
    hasInstalledAgentHooks({
      codex: "absent",
      claudeCode: "absent",
      antigravity: "absent",
      scriptsOutdated: false,
    }),
    false,
  );
  assert.equal(
    hasInstalledAgentHooks({
      codex: "notInstalled",
      claudeCode: "notInstalled",
      workbuddy: "absent",
      scriptsOutdated: false,
    }),
    false,
  );
  assert.equal(
    hasInstalledAgentHooks({
      codex: "notInstalled",
      claudeCode: "absent",
      scriptsOutdated: true,
    }),
    false,
  );
});

test("returns true when any status-light agent has current or outdated hooks", () => {
  assert.equal(
    hasInstalledAgentHooks({
      codex: "current",
      claudeCode: "notInstalled",
      scriptsOutdated: false,
    }),
    true,
  );
  assert.equal(
    hasInstalledAgentHooks({
      codex: "notInstalled",
      claudeCode: "absent",
      antigravity: "outdated",
      scriptsOutdated: false,
    }),
    true,
  );
});

test("returns true when non-status-light agents such as opencode or mimo have installed hooks", () => {
  assert.equal(
    hasInstalledAgentHooks({
      codex: "absent",
      claudeCode: "absent",
      opencode: "current",
      scriptsOutdated: false,
    }),
    true,
  );
  assert.equal(
    hasInstalledAgentHooks({
      codex: "notInstalled",
      claudeCode: "notInstalled",
      mimo: "outdated",
      scriptsOutdated: false,
    }),
    true,
  );
});
