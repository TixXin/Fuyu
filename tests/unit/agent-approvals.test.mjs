import assert from "node:assert/strict";
import test from "node:test";
import { alwaysAllowRule, approvalPreview } from "../../src/features/agent-status/approvals/preview.ts";

test("a shell command shows the command and the agent's note", () => {
  assert.deepEqual(approvalPreview({ command: "npm test", description: "Run the tests" }), {
    kind: "command",
    text: "npm test",
    note: "Run the tests",
  });
});

test("a Codex command list is joined into one line", () => {
  assert.equal(approvalPreview({ command: ["git", "status", "--short"] }).text, "git status --short");
});

test("file tools show the path, web tools the address", () => {
  assert.deepEqual(approvalPreview({ file_path: "src/main.tsx", old_string: "a", new_string: "b" }), {
    kind: "file",
    text: "src/main.tsx",
    note: null,
  });
  assert.equal(approvalPreview({ url: "https://example.com", prompt: "x" }).kind, "url");
});

test("other input falls back to its JSON, cut short", () => {
  assert.deepEqual(approvalPreview({ server: "s", args: [1] }), { kind: "input", text: '{"server":"s","args":[1]}', note: null });
  const long = approvalPreview({ data: "x".repeat(2000) });
  assert.ok(long.text.length <= 601 && long.text.endsWith("…"));
  assert.equal(approvalPreview(null).text, "null");
});

test("always allow uses the first addRules suggestion", () => {
  const suggestions = [
    { type: "setMode", mode: "acceptEdits" },
    { type: "addRules", rules: [{ toolName: "Bash", ruleContent: "npm test:*" }], behavior: "allow", destination: "localSettings" },
  ];
  assert.equal(alwaysAllowRule(suggestions), "Bash(npm test:*)");
  assert.equal(alwaysAllowRule([{ type: "addRules", rules: [{ toolName: "WebSearch" }] }]), "WebSearch");
  assert.equal(alwaysAllowRule(undefined), null);
  assert.equal(alwaysAllowRule([{ type: "setMode", mode: "plan" }]), null);
});

async function withStorage(entries, body) {
  const values = new Map(entries);
  const previous = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) } };
  try {
    await body();
  } finally {
    globalThis.window = previous;
  }
}

test("approval settings: on for a new install, off for an island that ran before them, saved settings as saved", async () => {
  const { loadAgentApprovalSettings, normalizeAgentApprovalSettings } = await import("../../src/features/agent-status/approvals/storage.ts");
  assert.deepEqual(normalizeAgentApprovalSettings(null), { onIsland: true, whenInFront: true });
  assert.deepEqual(normalizeAgentApprovalSettings({ onIsland: true }), { onIsland: true, whenInFront: false });
  assert.deepEqual(normalizeAgentApprovalSettings({}), { onIsland: false, whenInFront: false });
  await withStorage([], () => assert.deepEqual(loadAgentApprovalSettings(), { onIsland: true, whenInFront: true }));
  await withStorage([["fuyu-settings", "{}"]], () => assert.deepEqual(loadAgentApprovalSettings(), { onIsland: false, whenInFront: false }));
  await withStorage([["fuyu-settings", "{}"], ["fuyu-agent-approval", '{"onIsland":true,"whenInFront":false}']], () =>
    assert.deepEqual(loadAgentApprovalSettings(), { onIsland: true, whenInFront: false }));
});

test("agent sounds: every event for a new install; islands that ran before keep the quieter set", async () => {
  const { DEFAULT_AGENT_SOUND_SETTINGS, loadAgentSoundSettings, normalizeAgentSoundSettings } = await import("../../src/features/agent-status/sounds/storage.ts");
  assert.ok(Object.values(DEFAULT_AGENT_SOUND_SETTINGS.events).every(Boolean));
  assert.equal(DEFAULT_AGENT_SOUND_SETTINGS.quietWhenInFront, false);
  const earlier = (settings) => {
    assert.deepEqual([settings.events.start, settings.events.ack, settings.events.idle, settings.events.complete], [false, false, false, true]);
    assert.equal(settings.quietWhenInFront, true);
  };
  earlier(normalizeAgentSoundSettings({ volume: 50 }));
  await withStorage([], () => assert.deepEqual(loadAgentSoundSettings(), DEFAULT_AGENT_SOUND_SETTINGS));
  await withStorage([["fuyu-settings", "{}"]], () => earlier(loadAgentSoundSettings()));
});
