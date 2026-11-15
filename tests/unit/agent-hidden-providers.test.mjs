import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/features/appearance/settings.ts";

test("every agent is shown until the user switches one off", () => {
  assert.deepEqual(DEFAULT_SETTINGS.agentHiddenProviders, []);
  assert.deepEqual(normalizeSettings({}).agentHiddenProviders, []);
  assert.deepEqual(normalizeSettings({ agentShowClaudeCode: true, agentShowCodex: true }).agentHiddenProviders, []);
});

test("the two old switches carry over into the hidden list", () => {
  assert.deepEqual(normalizeSettings({ agentShowClaudeCode: false }).agentHiddenProviders, ["claudeCode"]);
  assert.deepEqual(normalizeSettings({ agentShowCodex: false }).agentHiddenProviders, ["codex"]);
  assert.deepEqual(normalizeSettings({ agentShowClaudeCode: false, agentShowCodex: false }).agentHiddenProviders, ["claudeCode", "codex"]);
  assert.equal("agentShowCodex" in normalizeSettings({ agentShowCodex: false }), false);
});

test("a saved hidden list wins over the old switches and keeps agents this build does not know", () => {
  assert.deepEqual(normalizeSettings({ agentHiddenProviders: ["dsh", "opencode", "dsh", 3, ""], agentShowCodex: false }).agentHiddenProviders, ["dsh", "opencode"]);
  assert.deepEqual(normalizeSettings({ agentHiddenProviders: "codex" }).agentHiddenProviders, []);
});
