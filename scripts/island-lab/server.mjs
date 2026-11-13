import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { islandHome } from "../../packages/fuyu-plugin/src/dev.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.ISLAND_LAB_PORT ?? 5199);
const APP_ID = "com.tixxin.fuyu";
const APPROVAL_TIMEOUT_MS = 150_000;
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/lab.mjs": ["lab.mjs", "text/javascript; charset=utf-8"],
  "/actions.mjs": ["actions.mjs", "text/javascript; charset=utf-8"],
  "/lab.css": ["lab.css", "text/css; charset=utf-8"],
};

export function configDirs(env = process.env, home = os.homedir()) {
  const appData = env.APPDATA ?? (process.platform === "darwin"
    ? path.join(home, "Library", "Application Support")
    : path.join(home, "AppData", "Roaming"));
  return [islandHome(env, home), path.join(appData, APP_ID)];
}

function readConfig(name) {
  for (const dir of configDirs()) {
    const file = path.join(dir, name);
    if (!existsSync(file)) continue;
    try {
      return { file, ...JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) };
    } catch {
      return { file, broken: true };
    }
  }
  return null;
}

export function forwardTarget(route, method) {
  const parts = route.split("/").filter(Boolean);
  if (parts[0] === "island" && ["emit", "action"].includes(parts[1]) && parts.length === 2 && method === "POST") {
    return { kind: "local", path: `/v1/dev/island/${parts[1]}` };
  }
  if (parts[0] === "island" && parts[1] === "notch" && parts.length === 2 && ["PUT", "DELETE"].includes(method)) {
    return { kind: "local", path: "/v1/dev/island/notch" };
  }
  if (parts[0] === "agent-status" && parts.length === 2 && /^[a-z0-9-]{1,32}$/.test(parts[1]) && ["PUT", "DELETE"].includes(method)) {
    return { kind: "local", path: `/v1/agent-status/${parts[1]}` };
  }
  const approvalPaths = { claude: "/claude/permission-request", codex: "/codex/permission-request", question: "/claude/ask-user-question" };
  if (parts[0] === "approval" && parts.length === 2 && approvalPaths[parts[1]] && method === "POST") {
    return { kind: "approval", path: approvalPaths[parts[1]] };
  }
  return null;
}

function send(port, token, method, target, body, timeout) {
  return new Promise((resolve) => {
    const request = http.request({
      host: "127.0.0.1", port, method, path: target, timeout,
      headers: { Host: `127.0.0.1:${port}`, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => resolve({ status: response.statusCode ?? 502, text }));
    });
    request.on("timeout", () => request.destroy(new Error("timed out")));
    request.on("error", (error) => resolve({ status: 502, text: JSON.stringify({ ok: false, error: `岛没有响应：${error.message}` }) }));
    request.end(body);
  });
}

async function status() {
  const local = readConfig("local-api.json");
  const approval = readConfig("agent-approval.json");
  const result = { localApi: { found: Boolean(local), file: local?.file ?? null, enabled: Boolean(local?.enabled), allowWrite: Boolean(local?.allowWrite) }, approval: { found: Boolean(approval?.port) } };
  if (local?.enabled) {
    const health = await send(local.port, local.token, "GET", "/v1/health", "", 1500);
    result.localApi.reachable = health.status === 200;
    const probe = await send(local.port, local.token, "GET", "/v1/dev/island/emit", "", 1500);
    result.localApi.devBuild = probe.status === 405;
  }
  return result;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host ?? "";
  const allowed = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
  return allowed.includes(host) && (origin === undefined || allowed.some((value) => origin === `http://${value}`));
}

function reply(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  response.end(body);
}

async function handle(request, response) {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (!sameOrigin(request)) return reply(response, 403, JSON.stringify({ ok: false, error: "只接受本页面的请求。" }));
  const file = STATIC[url.pathname];
  if (file && request.method === "GET") return reply(response, 200, readFileSync(path.join(HERE, file[0])), file[1]);
  if (url.pathname === "/api/status") return reply(response, 200, JSON.stringify(await status()));
  const target = url.pathname.startsWith("/api/") ? forwardTarget(url.pathname.slice(5), request.method ?? "GET") : null;
  if (!target) return reply(response, 404, JSON.stringify({ ok: false, error: "没有这个接口。" }));
  let body = "";
  for await (const chunk of request) body += chunk;
  const config = readConfig(target.kind === "local" ? "local-api.json" : "agent-approval.json");
  if (!config?.port || !config?.token) {
    return reply(response, 503, JSON.stringify({ ok: false, error: target.kind === "local" ? "找不到本地接口的配置：先在岛的设置里打开本地接口。" : "找不到审批端口的配置：先在岛的设置里打开 Agent 审批。" }));
  }
  const answer = await send(config.port, config.token, request.method ?? "POST", target.path, body, target.kind === "approval" ? APPROVAL_TIMEOUT_MS : 8000);
  reply(response, answer.status, answer.text || "{}");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  http.createServer((request, response) => {
    handle(request, response).catch((error) => reply(response, 500, JSON.stringify({ ok: false, error: String(error) })));
  }).listen(PORT, "127.0.0.1", () => {
    console.log(`岛屿实验台：http://127.0.0.1:${PORT}/`);
  });
}
