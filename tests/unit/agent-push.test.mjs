import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_AGENT_PUSH_SETTINGS, normalizeAgentPushSettings, pushRoute } from "../../src/features/agent-status/push/storage.ts";
import { queuePushes, takeDuePushes } from "../../src/features/agent-status/push/pushQueue.ts";
import { ccConnectText, pushBody, takeoverCommands } from "../../src/features/agent-status/push/pushText.ts";

test("phone push is off by default and pushes only after 5 minutes away", () => {
  assert.deepEqual(normalizeAgentPushSettings(null), DEFAULT_AGENT_PUSH_SETTINGS);
  assert.equal(DEFAULT_AGENT_PUSH_SETTINGS.enabled, false);
  assert.equal(DEFAULT_AGENT_PUSH_SETTINGS.awayMinutes, 5);
});

test("saved push settings are read safely", () => {
  const read = normalizeAgentPushSettings({ enabled: true, server: "  http://nas:8080 ", events: { completed: false, extra: true }, awayMinutes: 7 });
  assert.deepEqual(read, {
    enabled: true,
    server: "http://nas:8080",
    events: { waiting: true, completed: false, failed: true },
    awayMinutes: 5,
    channel: "bark",
    mutedHosts: [],
    ccConnect: {},
  });
  assert.equal(normalizeAgentPushSettings({ awayMinutes: 0 }).awayMinutes, 0);
  assert.equal(normalizeAgentPushSettings({ server: 42 }).server, "");
});

test("the old single cc-connect project becomes this computer's, keeping only chat keys, once each", () => {
  const read = normalizeAgentPushSettings({ channel: "ccConnect", ccConnect: { project: " pc ", chats: ["telegram:1:1", "telegram:1:1", "nope", 7] } });
  assert.equal(read.channel, "ccConnect");
  assert.deepEqual(read.ccConnect, { "": { chats: [{ project: "pc", key: "telegram:1:1", agent: "claudecode" }], viaLocal: false } });
  assert.equal(normalizeAgentPushSettings({ channel: "sms" }).channel, "bark");
});

test("each computer keeps its chats of any number of projects", () => {
  const read = normalizeAgentPushSettings({
    mutedHosts: ["zcm6", "zcm6", 3],
    ccConnect: {
      "": { chats: [{ project: "pc", key: "telegram:1:1", agent: "claudecode" }, { project: "cx", key: "telegram:1:1", agent: "codex" }] },
      zcm6: { chats: [{ project: "zcm6", key: "discord:2:3" }, { project: "", key: "x:1" }], viaLocal: true },
    },
  });
  assert.deepEqual(read.mutedHosts, ["zcm6"]);
  assert.equal(read.ccConnect[""].chats.length, 2);
  assert.deepEqual(read.ccConnect.zcm6, { chats: [{ project: "zcm6", key: "discord:2:3", agent: null }], viaLocal: true });
});

test("a computer's sessions go through its own cc-connect, or this computer's without takeover", () => {
  const settings = normalizeAgentPushSettings({
    ccConnect: { "": { chats: [{ project: "pc", key: "telegram:1:1" }] }, zcm6: { chats: [{ project: "zcm6", key: "telegram:1:1" }] }, nas: { viaLocal: true } },
  });
  assert.deepEqual(pushRoute(settings, "zcm6"), { via: "zcm6", chats: settings.ccConnect.zcm6.chats, takeover: true });
  assert.deepEqual(pushRoute(settings, "nas"), { via: "", chats: settings.ccConnect[""].chats, takeover: false });
  // Not set up yet: as before computers had their own, this computer's chats, without takeover.
  assert.deepEqual(pushRoute(settings, "other"), { via: "", chats: settings.ccConnect[""].chats, takeover: false });
});

const session = (sessionId, phase, extra = {}) => ({
  provider: "claudeCode", sessionId, cwd: "/work", title: "Fix it", phase, lastMessage: "last", updatedAt: 1, turnStartedAt: 1, ...extra,
});

test("a push waits until the user is away, and goes once", () => {
  const queue = new Map();
  const waiting = session("a1", "waiting");
  queuePushes(queue, [{ kind: "waiting", session: waiting }]);
  assert.deepEqual(takeDuePushes(queue, [waiting], false, () => false), []);
  assert.deepEqual(takeDuePushes(queue, [waiting], true, () => false), [{ kind: "waiting", session: waiting }]);
  assert.deepEqual(takeDuePushes(queue, [waiting], true, () => false), []);
});

test("a push is dropped once the user looked or the session moved on", () => {
  const queue = new Map();
  queuePushes(queue, [{ kind: "waiting", session: session("a1", "waiting") }, { kind: "completed", session: session("b2", "completed") }]);
  takeDuePushes(queue, [session("a1", "running"), session("b2", "completed")], false, (looked) => looked.sessionId === "b2");
  assert.equal(queue.size, 0);
  queuePushes(queue, [{ kind: "failed", session: session("c3", "failed") }]);
  assert.deepEqual(takeDuePushes(queue, [], true, () => false), []);
});

test("only the newest three pushes go at once", () => {
  const queue = new Map();
  const sessions = ["a", "b", "c", "d"].map((id) => session(id, "completed"));
  queuePushes(queue, sessions.map((entry) => ({ kind: "completed", session: entry })));
  assert.deepEqual(takeDuePushes(queue, sessions, true, () => false).map((alert) => alert.session.sessionId), ["b", "c", "d"]);
});

test("takeover commands only from a project of the session's own agent", () => {
  const claude = session("0123456789abcdef", "waiting");
  assert.deepEqual(takeoverCommands(claude, "claudecode"), ["/cd /work", "/switch 01234567"]);
  assert.deepEqual(takeoverCommands({ ...claude, remoteHost: "zcm6" }, "claudecode"), ["/cd /work", "/switch 01234567"]);
  assert.deepEqual(takeoverCommands(claude, "codex"), []);
  assert.deepEqual(takeoverCommands(claude, null), []);
  assert.deepEqual(takeoverCommands({ ...claude, provider: "codex" }, "codex"), ["/cd /work", "/switch 01234567"]);
  assert.deepEqual(takeoverCommands({ ...claude, cwd: null }, "claudecode"), []);
});

test("the push body is what the session waits on, else its tool or last message", () => {
  const waiting = session("a", "waiting", { currentTool: { name: "Bash", detail: "git push" } });
  assert.equal(pushBody({ kind: "waiting", session: waiting }, { entrypoint: null, wait: { kind: "question", text: "Which?" } }), "Which?");
  assert.equal(pushBody({ kind: "waiting", session: waiting }, { entrypoint: null, wait: null }), "Bash: git push");
  assert.equal(pushBody({ kind: "failed", session: waiting }, { entrypoint: null, wait: { kind: "reply", text: "x" } }), "last");
});

test("a cc-connect push puts each command on its own, inline on Discord", () => {
  const commands = ["/cd /work", "/switch 01234567"];
  const fence = "```";
  assert.equal(ccConnectText("T", "body", commands, "Take over:", "discord"), ["🔔 T", "body", "Take over:", "`/cd /work`", "`/switch 01234567`"].join("\n"));
  assert.equal(
    ccConnectText("T", "body", commands, "Take over:", "telegram"),
    ["🔔 T", "body", "Take over:", `${fence}bash`, "/cd /work", fence, `${fence}bash`, "/switch 01234567", fence].join("\n"),
  );
  assert.equal(ccConnectText("T", "", [], "Take over:", "feishu"), "🔔 T");
  const cut = ccConnectText("T", `${fence}\n${"x".repeat(700)}`, [], "", "feishu");
  assert.ok(cut.endsWith(`…\n${fence}`));
});
