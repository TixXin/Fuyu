import assert from "node:assert/strict";
import test from "node:test";
import { focusesWindowOnly, sessionHoverLines } from "../../src/features/agent-status/focusHint.ts";
import { zhCN } from "../../src/i18n/sections/agent.ts";

const baseSession = {
  provider: "claudeCode",
  sessionId: "s1",
  cwd: "/Users/me/fuyu",
  title: "会话定位",
  model: null,
  effort: null,
  phase: "running",
  lastMessage: null,
  updatedAt: 0,
  host: null,
  turnStartedAt: null,
};

test("window-only hint applies to desktop app hosts and hook-only desktop providers", () => {
  assert.equal(focusesWindowOnly({ provider: "claudeCode", host: { name: "Claude", exe: null, kind: "app" } }), true);
  assert.equal(focusesWindowOnly({ provider: "codex", host: { name: "Codex", exe: null, kind: "app" } }), true);
  assert.equal(focusesWindowOnly({ provider: "antigravity", host: null }), true);
  assert.equal(focusesWindowOnly({ provider: "antigravity", host: { name: "Ghostty", exe: "/Applications/Ghostty.app", kind: "terminal" } }), false);
  assert.equal(focusesWindowOnly({ provider: "trae", host: { name: "Trae", exe: null, kind: "editor" } }), true);
  assert.equal(focusesWindowOnly({ provider: "workbuddy", host: null }), false);
  assert.equal(focusesWindowOnly({ provider: "workbuddy", host: { name: "WorkBuddy", exe: null, kind: "app" } }), false);
  assert.equal(focusesWindowOnly({ provider: "claudeCode", host: { name: "Ghostty", exe: null, kind: "terminal" } }), false);
  assert.equal(focusesWindowOnly({ provider: "claudeCode", host: { name: "VS Code", exe: null, kind: "editor" } }), false);
  assert.equal(focusesWindowOnly({ provider: "antigravity", host: null, remoteHost: "devbox" }), false);
});

test("hover card lines append the manual switch note only when exact tab focus is unavailable", () => {
  const inTerminal = sessionHoverLines(
    { ...baseSession, host: { name: "Ghostty", exe: null, kind: "terminal" } },
    "fuyu · 会话定位",
    zhCN.sessions.hover,
  );
  assert.deepEqual(
    inTerminal.map((line) => line.text),
    ["fuyu · 会话定位", "目录：/Users/me/fuyu", "在 Ghostty 里运行"],
  );

  const inApp = sessionHoverLines(
    { ...baseSession, host: { name: "Claude", exe: null, kind: "app" } },
    "fuyu · 会话定位",
    zhCN.sessions.hover,
  );
  assert.deepEqual(
    inApp.map((line) => line.text),
    ["fuyu · 会话定位", "目录：/Users/me/fuyu", "在 Claude 里运行", zhCN.sessions.hover.windowOnly],
  );
});
