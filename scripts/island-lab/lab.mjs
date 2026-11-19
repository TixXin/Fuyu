import {
  NOTCHES, PAGES, agentStatus, deviceAlert, levelChange, permissionRequest, pluginNotification, qqMessage, questionRequest, trackNotification, wechatMessage,
} from "./actions.mjs";
import { sweep } from "./builtins.mjs";

const log = document.getElementById("log");
const statusLine = document.getElementById("status");

function note(text, kind = "info") {
  const line = document.createElement("li");
  line.className = `log__line log__line--${kind}`;
  line.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  log.prepend(line);
}

async function call(method, route, body) {
  const response = await fetch(`/api/${route}`, {
    method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data;
}

const data = (method, route, body) => call(method, route, body).then((answer) => answer?.data ?? answer);

function showSweep(rows, done) {
  let table = document.getElementById("builtins-table");
  if (!table) {
    const section = document.createElement("section");
    section.className = "group";
    section.innerHTML = '<h2>逐个关掉内置插件</h2><table id="builtins-table" class="sweep"><thead><tr><th>插件</th><th>关掉后还剩</th><th>线程数</th></tr></thead><tbody></tbody></table>';
    document.getElementById("groups").prepend(section);
    table = document.getElementById("builtins-table");
  }
  const body = table.querySelector("tbody");
  body.replaceChildren(...rows.map((row) => {
    const line = document.createElement("tr");
    line.dataset.state = row.left.length ? "left" : "clean";
    for (const text of [row.id, row.left.length ? row.left.join("；") : "没有残留", row.threads]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      line.append(cell);
    }
    return line;
  }));
  table.dataset.done = String(done);
}

async function sweepBuiltins() {
  const rows = [];
  note("开始逐个关掉内置插件，每个约 5 秒…");
  await sweep(data, { onRow: (row) => { rows.push(row); showSweep(rows, false); } });
  showSweep(rows, true);
  const left = rows.filter((row) => row.left.length).length;
  note(`核对完 ${rows.length} 个内置插件，${left} 个关掉后还有残留`, left ? "error" : "ok");
}

const emit = (event) => call("POST", "island/emit", event);
const action = (body) => call("POST", "island/action", body);
const agent = (phase) => call("PUT", "agent-status/lab", agentStatus(phase));

function approval(kind, body) {
  note(`已向岛发起${kind === "question" ? "提问" : "审批"}，等你在岛上回答…`);
  return call("POST", `approval/${kind}`, body).then((answer) => {
    if (answer && typeof answer === "object" && Object.keys(answer).length === 0) {
      note("岛没有接这个请求：设置里的 Agent 审批没开（或这类请求交还给终端处理）", "error");
      return;
    }
    note(`岛上的回答：${JSON.stringify(answer)}`, "ok");
  });
}

const now = () => Date.now();
const GROUPS = [
  ["刘海", [
    ["不模拟刘海（用屏幕真实的）", () => call("DELETE", "island/notch")],
    ...NOTCHES.map(({ label, width, height }) => [label, () => call("PUT", "island/notch", { width, height })]),
  ]],
  ["吸附边", [
    ["顶边", () => call("PUT", "island/edge", { edge: "top" })],
    ["底边", () => call("PUT", "island/edge", { edge: "bottom" })],
    ["左侧竖向岛", () => call("PUT", "island/edge", { edge: "left" })],
    ["右侧竖向岛", () => call("PUT", "island/edge", { edge: "right" })],
  ]],
  ["岛", [
    ...PAGES.map(([page, label]) => [`展开：${label}`, () => action({ action: "open", page })]),
    ["收起", () => action({ action: "collapse" })],
    ["贴边收起", () => action({ action: "tuck" })],
    ["从贴边弹出", () => action({ action: "reveal" })],
  ]],
  ["消息", [
    ["QQ 消息", () => emit(qqMessage(now()))],
    ["微信消息", () => emit(wechatMessage(now()))],
    ["插件通知（一行）", () => emit(pluginNotification("inline"))],
    ["插件通知（卡片）", () => emit(pluginNotification("card"))],
    ["换歌提示", () => emit(trackNotification())],
  ]],
  ["系统", [
    ["音量 45%", () => emit(levelChange("volume", 0.45))],
    ["静音", () => emit(levelChange("volume", 0.45, true))],
    ["亮度 70%", () => emit(levelChange("brightness", 0.7))],
    ["耳机连上", () => emit(deviceAlert({ kind: "audioConnected", name: "AirPods Pro", device: "headphones", battery: 80 }))],
    ["耳机断开", () => emit(deviceAlert({ kind: "audioDisconnected", name: "AirPods Pro", device: "headphones" }))],
    ["耳机电量低", () => emit(deviceAlert({ kind: "batteryLow", name: "AirPods Pro", battery: 10 }))],
    ["接上电源", () => emit(deviceAlert({ kind: "powerConnected", battery: 42 }))],
  ]],
  ["Agent", [
    ["运行中", () => agent("running")],
    ["等你确认", () => agent("waiting")],
    ["完成", () => agent("completed")],
    ["失败", () => agent("failed")],
    ["清除", () => call("DELETE", "agent-status/lab")],
    ["Claude 审批（Bash）", () => approval("claude", permissionRequest(now()))],
    ["Codex 审批", () => approval("codex", permissionRequest(now(), "codex"))],
    ["Claude 提问", () => approval("question", questionRequest(now()))],
  ]],
  ["内置插件", [
    ["逐个关掉内置插件并核对", sweepBuiltins],
  ]],
  ["场景", [
    ["刘海 + 消息 + Agent 一起来", async () => {
      await call("PUT", "island/notch", NOTCHES[0]);
      await agent("running");
      await emit(wechatMessage(now()));
    }],
    ["侧边 + 消息气泡 + 音量", async () => {
      await call("PUT", "island/edge", { edge: "left" });
      await agent("running");
      await emit(qqMessage(now()));
      setTimeout(() => void emit(levelChange("volume", 0.45)), 4500);
    }],
    ["复原", async () => {
      await call("PUT", "island/edge", { edge: "top" });
      await call("DELETE", "island/notch");
      await call("DELETE", "agent-status/lab");
      await action({ action: "collapse" });
    }],
  ]],
];

function render() {
  const root = document.getElementById("groups");
  for (const [title, items] of GROUPS) {
    const section = document.createElement("section");
    section.className = "group";
    const heading = document.createElement("h2");
    heading.textContent = title;
    section.append(heading);
    const row = document.createElement("div");
    row.className = "group__buttons";
    for (const [label, run] of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        Promise.resolve(run()).then(() => note(label, "ok")).catch((error) => note(`${label}：${error.message}`, "error"));
      });
      row.append(button);
    }
    section.append(row);
    root.append(section);
  }
}

async function refreshStatus() {
  const status = await call("GET", "status").catch((error) => ({ error: error.message }));
  const lab = status.lab ?? {};
  const problems = [];
  if (status.error) problems.push(status.error);
  else if (!lab.found) problems.push("找不到 island-lab.json：先跑 pnpm tauri dev（正式版不开实验台端口）");
  else if (!lab.reachable) problems.push("连不上开发版的岛：pnpm tauri dev 在运行吗？改过 Rust 的话等它重新编译完");
  if (!status.approval?.found) problems.push("找不到审批端口，审批和提问按钮用不了");
  statusLine.textContent = problems.length ? problems.join("；") : "已连上正在运行的开发版岛。";
  statusLine.dataset.state = problems.length ? "warn" : "ok";
}

render();
void refreshStatus();
document.getElementById("refresh").addEventListener("click", () => void refreshStatus());
