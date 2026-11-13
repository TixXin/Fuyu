import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { configDirs, forwardTarget } from "../../scripts/island-lab/server.mjs";
import { agentStatus, permissionRequest, qqMessage, questionRequest, wechatMessage } from "../../scripts/island-lab/actions.mjs";

test("the lab forwards only its own routes to the island", () => {
  assert.deepEqual(forwardTarget("island/emit", "POST"), { kind: "local", path: "/v1/dev/island/emit" });
  assert.deepEqual(forwardTarget("island/notch", "DELETE"), { kind: "local", path: "/v1/dev/island/notch" });
  assert.deepEqual(forwardTarget("agent-status/lab", "PUT"), { kind: "local", path: "/v1/agent-status/lab" });
  assert.deepEqual(forwardTarget("approval/question", "POST"), { kind: "approval", path: "/claude/ask-user-question" });
  assert.equal(forwardTarget("island/emit", "GET"), null);
  assert.equal(forwardTarget("todos", "POST"), null);
  assert.equal(forwardTarget("agent-status/../todos", "PUT"), null);
  assert.equal(forwardTarget("approval/other", "POST"), null);
});

test("the lab looks for the configs in the island home first, then app data", () => {
  const dirs = configDirs({ FUYU_HOME: "/data/fuyu", APPDATA: "/appdata" }, "/home/me");
  assert.deepEqual(dirs, ["/data/fuyu", path.join("/appdata", "com.tixxin.fuyu")]);
});

test("message payloads carry a fresh revision and show while the island is visible", () => {
  const qq = qqMessage(42);
  assert.equal(qq.event, "qq-notifications-changed");
  assert.equal(qq.payload.snapshot.revision, 42);
  assert.equal(qq.payload.newestId, qq.payload.snapshot.items[0].id);
  assert.equal(qq.payload.windowVisible, true);
  const wechat = wechatMessage(43);
  assert.equal(wechat.payload.snapshot.status, "listening");
  assert.equal(wechat.payload.snapshot.message, wechat.payload.snapshot.items[0].message);
});

test("agent and approval bodies match what the island expects", () => {
  assert.equal(agentStatus("running").phase, "running");
  const permission = permissionRequest(1);
  assert.equal(typeof permission.session_id, "string");
  assert.equal(permission.tool_name, "Bash");
  assert.equal(questionRequest(1).tool_name, "AskUserQuestion");
});
