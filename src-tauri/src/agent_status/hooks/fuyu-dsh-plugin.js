import { request as httpRequest } from "node:http";
import { readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FUYU_DIR = "__FUYU_DIR__";
const RUNNING_FILE = join(FUYU_DIR, "agent-dsh-running.flag");
const HOLD_FILE = join(FUYU_DIR, "agent-dsh-running-hold.flag");
const STATUS_FILE = join(FUYU_DIR, "agent-status.json");
const CONFIG_FILE = join(FUYU_DIR, "agent-approval.json");
const ROUTE = "/dsh/permission";
const WAIT_MS = 140000;
const MIN_VISIBLE_MS = 800;
const MAX_RECENT_CALLS = 64;

export const name = "fuyu-island";

function text(value, max = 4096) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : "";
}

function sessionIdOf(session, agent) {
  return text(session?.id, 200) || text(session?.header?.id, 200) || text(agent?.id, 200) || "dsh-default";
}

async function fuyuDirExists() {
  try {
    return (await stat(FUYU_DIR)).isDirectory();
  } catch {
    return false;
  }
}

async function writeAtomic(target, content) {
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content, "utf8");
  await rename(tmp, target);
}

async function markRunning() {
  try {
    if (!(await fuyuDirExists())) return;
    await writeFile(RUNNING_FILE, "", "utf8");
    await rm(HOLD_FILE, { force: true });
  } catch {}
}

async function markFinished(phase) {
  const now = Date.now();
  try {
    if (!(await fuyuDirExists())) return;
    let visibleUntil = 0;
    try {
      const info = await stat(RUNNING_FILE);
      const elapsed = Math.max(0, now - Math.floor(info.mtimeMs));
      if (elapsed < MIN_VISIBLE_MS) visibleUntil = now + (MIN_VISIBLE_MS - elapsed);
    } catch {}
    await rm(RUNNING_FILE, { force: true });
    if (visibleUntil > now) await writeFile(HOLD_FILE, String(visibleUntil), "utf8");
    else await rm(HOLD_FILE, { force: true });
    let state = {};
    try {
      const existing = JSON.parse((await readFile(STATUS_FILE, "utf8")).replace(/^\uFEFF/, ""));
      if (existing && typeof existing === "object" && !Array.isArray(existing)) state = existing;
    } catch {}
    state.dsh = { phase, updatedAt: now };
    state.updatedAt = now;
    await writeAtomic(STATUS_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

async function readEndpoint(file) {
  try {
    const config = JSON.parse((await readFile(file, "utf8")).replace(/^﻿/, ""));
    if (!Number.isInteger(config.port) || typeof config.token !== "string" || !config.token) return null;
    return config;
  } catch {
    return null;
  }
}

async function endpoint() {
  const names = await readdir(FUYU_DIR).catch(() => []);
  const lanes = names.filter((name) => /^agent-approval\.lane-\d+\.json$/.test(name)).sort();
  const configs = [];
  for (const file of [CONFIG_FILE, ...lanes.map((name) => join(FUYU_DIR, name))]) {
    const config = await readEndpoint(file);
    if (config) configs.push(config);
  }
  return configs.length ? configs : null;
}

async function post(configs, body, signal) {
  for (const config of configs) {
    const result = await postTo(config, body, signal);
    if (result.reached || signal?.aborted) return result.answer;
  }
  return null;
}

function postTo(config, body, signal) {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        host: "127.0.0.1",
        port: config.port,
        path: ROUTE,
        method: "POST",
        signal,
        timeout: WAIT_MS,
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve({ reached: false, answer: null });
          return;
        }
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("error", () => resolve({ reached: true, answer: null }));
        res.on("end", () => {
          try {
            resolve({ reached: true, answer: JSON.parse(raw) });
          } catch {
            resolve({ reached: true, answer: null });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", (error) => resolve({ reached: error?.code !== "ECONNREFUSED", answer: null }));
    req.end(body);
  });
}

function rememberToolCall(recentCalls, data) {
  const callId = text(data?.callId, 200);
  if (!callId || typeof data?.arguments !== "string") return;
  try {
    const parsed = JSON.parse(data.arguments);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
    if (recentCalls.has(callId)) recentCalls.delete(callId);
    else if (recentCalls.size >= MAX_RECENT_CALLS) {
      const oldest = recentCalls.keys().next().value;
      if (oldest !== undefined) recentCalls.delete(oldest);
    }
    recentCalls.set(callId, parsed);
  } catch {}
}

function buildToolInput(req, recentCalls) {
  const callId = text(req?.callId, 200);
  const reason = text(req?.displayReason?.zh, 600) || text(req?.displayReason?.en, 600) || text(req?.reason, 600);
  const known = callId ? recentCalls.get(callId) : null;
  if (known && typeof known === "object" && !Array.isArray(known)) {
    const copy = { ...known };
    if (reason && typeof copy.description !== "string") copy.description = reason;
    return copy;
  }
  if (reason) {
    const lower = text(req?.toolName, 160).toLowerCase();
    if (lower.includes("shell") || lower.includes("bash") || lower.includes("exec") || lower.includes("command")) {
      return { command: reason };
    }
    return { description: reason };
  }
  return {};
}

export function apply(ctx) {
  if (!ctx || typeof ctx.on !== "function" || typeof ctx.inject !== "function" || typeof ctx.effect !== "function") {
    return;
  }
  const lifetime = new AbortController();
  const open = new Map();
  const recentCalls = new Map();
  let seq = 0;

  const settle = (key) => {
    const entry = open.get(key);
    if (!entry) return;
    open.delete(key);
    entry.controller.abort();
  };

  const settleSession = (sessionId) => {
    for (const [key, entry] of open) {
      if (!sessionId || entry.sessionId === sessionId) settle(key);
    }
  };

  const safely = (fn) => (...args) => {
    if (lifetime.signal.aborted) return;
    try {
      fn(...args);
    } catch {}
  };

  ctx.on("session/created", safely(() => {}));

  ctx.on(
    "session/event",
    safely((session, event) => {
      const type = event?.type;
      if (type === "turn/start") {
        void markRunning();
        return;
      }
      if (type === "tool/call") {
        rememberToolCall(recentCalls, event?.data);
        void markRunning();
        return;
      }
      if (type === "turn/end") {
        settleSession(sessionIdOf(session, null));
        const rawReason = event?.data?.reason;
        const kind = text(rawReason && typeof rawReason === "object" ? rawReason.kind : rawReason, 80).toLowerCase();
        void markFinished(kind === "error" ? "failed" : "completed");
      }
    }),
  );

  ctx.on(
    "session/disposed",
    safely((session) => {
      settleSession(sessionIdOf(session, null));
    }),
  );

  ctx.inject(["approval"], (approvalCtx) => {
    if (!approvalCtx || typeof approvalCtx.on !== "function") return;
    approvalCtx.on(
      "approval/request",
      async (req, next) => {
        if (req?.signal?.aborted) return "cancelled";
        if (lifetime.signal.aborted) return next();
        const config = await endpoint();
        if (!config) return next();
        if (req?.signal?.aborted) return "cancelled";
        if (lifetime.signal.aborted) return next();

        const session = req?.agent?.session;
        const sessionId = sessionIdOf(session, req?.agent);
        const cwd = text(session?.header?.cwd) || null;
        const toolName = text(req?.toolName, 160) || "tool";
        const key = `${text(req?.callId, 200) || "req"}-${++seq}`;
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        const signals = [req?.signal, lifetime.signal].filter((sig) => sig && typeof sig.addEventListener === "function");
        for (const sig of signals) {
          if (sig.aborted) {
            controller.abort();
            break;
          }
          sig.addEventListener("abort", onAbort, { once: true });
        }
        open.set(key, { controller, sessionId });

        let answer = null;
        try {
          const payload = JSON.stringify({
            session_id: sessionId,
            cwd,
            tool_name: toolName,
            tool_input: buildToolInput(req, recentCalls),
          });
          answer = await post(config, payload, controller.signal);
        } catch {
          answer = null;
        } finally {
          open.delete(key);
          for (const sig of signals) sig.removeEventListener("abort", onAbort);
        }

        if (req?.signal?.aborted) return "cancelled";
        if (lifetime.signal.aborted) return next();
        if (answer?.outcome === "allowed-once") return "allowed-once";
        if (answer?.outcome === "rejected") return "rejected";
        return next();
      },
      { prepend: true },
    );
  });

  ctx.effect(() => () => {
    lifetime.abort();
    for (const key of [...open.keys()]) settle(key);
    recentCalls.clear();
  }, "fuyu-island disposal");
}

export default apply;
