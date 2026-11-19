import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { configDirs, forwardTarget, threadCount } from "../../scripts/island-lab/server.mjs";
import { residueOf, sweep, switchable, threadsLine } from "../../scripts/island-lab/builtins.mjs";
import { agentStatus, permissionRequest, pluginNotification, qqMessage, questionRequest, trackNotification, wechatMessage } from "../../scripts/island-lab/actions.mjs";

test("the lab forwards only its own routes to the island", () => {
  assert.deepEqual(forwardTarget("island/emit", "POST"), { kind: "local", path: "/v1/dev/island/emit" });
  assert.deepEqual(forwardTarget("island/notch", "DELETE"), { kind: "local", path: "/v1/dev/island/notch" });
  assert.deepEqual(forwardTarget("island/edge", "PUT"), { kind: "local", path: "/v1/dev/island/edge" });
  assert.equal(forwardTarget("island/edge", "DELETE"), null);
  assert.deepEqual(forwardTarget("agent-status/lab", "PUT"), { kind: "local", path: "/v1/agent-status/lab" });
  assert.deepEqual(forwardTarget("approval/question", "POST"), { kind: "approval", path: "/claude/ask-user-question" });
  assert.equal(forwardTarget("island/emit", "GET"), null);
  assert.equal(forwardTarget("todos", "POST"), null);
  assert.equal(forwardTarget("agent-status/../todos", "PUT"), null);
  assert.equal(forwardTarget("approval/other", "POST"), null);
});

test("the lab looks for the configs in the development build's folder first, then the island home and app data", () => {
  const dirs = configDirs({ FUYU_HOME: "/data/fuyu", APPDATA: "/appdata" }, "/home/me");
  assert.deepEqual(dirs, [path.join("/appdata", "com.tixxin.fuyu.lane-1"), "/data/fuyu", path.join("/appdata", "com.tixxin.fuyu")]);
  const shared = configDirs({ FUYU_HOME: "/data/fuyu", APPDATA: "/appdata", FUYU_DEV_SHARED_IDENTITY: "1" }, "/home/me");
  assert.deepEqual(shared, ["/data/fuyu", path.join("/appdata", "com.tixxin.fuyu")]);
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

test("plugin notices go out as the notice the island takes, a track notice with media controls", () => {
  const card = pluginNotification("card");
  assert.equal(card.event, "plugin-notification");
  assert.deepEqual(Object.keys(card.payload.pluginName), ["zh-CN", "en"]);
  assert.equal(card.payload.layout, "card");
  assert.equal(card.payload.actions.length, 1);
  const track = trackNotification("安和桥", "宋冬野");
  assert.equal(track.event, "plugin-notification");
  assert.deepEqual([track.payload.title, track.payload.body, track.payload.controls, track.payload.layout], ["安和桥", "宋冬野", "media", "inline"]);
  assert.equal(typeof track.payload.durationMs, "number");
});

test("agent and approval bodies match what the island expects", () => {
  assert.equal(agentStatus("running").phase, "running");
  const permission = permissionRequest(1);
  assert.equal(typeof permission.session_id, "string");
  assert.equal(permission.tool_name, "Bash");
  assert.equal(questionRequest(1).tool_name, "AskUserQuestion");
});

test("the lab reads the built-in plugins and switches one, nothing else under /builtins", () => {
  assert.deepEqual(forwardTarget("builtins", "GET"), { kind: "local", path: "/v1/dev/builtins" });
  assert.deepEqual(forwardTarget("builtins/session-ring", "PUT"), { kind: "local", path: "/v1/dev/builtins/session-ring" });
  assert.equal(forwardTarget("builtins", "PUT"), null);
  assert.equal(forwardTarget("builtins/../todos", "PUT"), null);
  assert.equal(forwardTarget("builtins/Timer", "PUT"), null);
  assert.equal(threadCount(-1), null);
});

const diag = ({ enabled = false, running = false, state = "disabled", timers = 0, items = 0, listening = 0, calls = 0 } = {}) => ({
  rust: [{ id: "timer", kind: "builtin", enabled, background: [{ name: "ticker", registered: true, running }] }, { id: "updater", kind: "essential", enabled: true, background: [] }],
  host: { running: true, plugins: [{ id: "timer", state, usage: { timers, listeners: 0, services: 0, clients: 0 } }] },
  windows: [{ window: "main", plugins: [{ id: "timer", items, listening, calls, services: 0 }] }],
});

test("a switched-off plugin with nothing left has an empty row; each leftover gets its own line", () => {
  assert.deepEqual(residueOf("timer", diag({ calls: 4 }), diag({ calls: 4 })), []);
  assert.deepEqual(residueOf("timer", diag({ calls: 4 }), diag({ running: true, state: "running", timers: 1, items: 2, listening: 1, calls: 6 })), [
    "Rust 后台 ticker 还在跑",
    "宿主里是 running",
    "宿主 timers 1",
    "main 窗口还有 2 个插槽项",
    "main 窗口还在听 1 个事件",
    "main 窗口关掉后又调了 2 次命令",
  ]);
  assert.deepEqual(switchable(diag({ enabled: true })), ["timer"]);
  assert.equal(threadsLine(40, 37), "40 → 37（少 3）");
  assert.equal(threadsLine(null, 37), "—");
});

test("the sweep switches each plugin off, reads it twice and always switches it back on", async () => {
  const calls = [];
  let on = true;
  const call = async (method, route, body) => {
    calls.push(`${method} ${route}${body ? ` ${body.enabled}` : ""}`);
    if (method === "PUT") on = body.enabled;
    return { ...diag({ enabled: on, items: on ? 1 : 0 }), threads: on ? 40 : 38 };
  };
  const rows = await sweep(call, { pause: async () => {} });
  assert.deepEqual(rows, [{ id: "timer", left: [], threads: "40 → 38（少 2）" }]);
  assert.deepEqual(calls, ["GET builtins", "GET builtins", "PUT builtins/timer false", "GET builtins", "GET builtins", "PUT builtins/timer true"]);
});

test("the sweep leaves alone a plugin the user switched off while it was still waiting its turn", async () => {
  const on = { timer: true, "session-ring": true };
  const calls = [];
  const call = async (method, route, body) => {
    calls.push(`${method} ${route}${body ? ` ${body.enabled}` : ""}`);
    if (method === "PUT") {
      const id = route.slice("builtins/".length);
      on[id] = body.enabled;
      if (id === "timer" && body.enabled === false) on["session-ring"] = false;
    }
    return { rust: Object.entries(on).map(([id, enabled]) => ({ id, kind: "builtin", enabled, background: [] })), windows: [] };
  };
  const rows = await sweep(call, { pause: async () => {} });
  assert.deepEqual(rows.map((row) => row.id), ["timer"]);
  assert.equal(on["session-ring"], false);
  assert.ok(!calls.some((line) => line.startsWith("PUT builtins/session-ring")));
});
