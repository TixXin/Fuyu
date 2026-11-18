import { request as httpRequest } from "node:http";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const FUYU_DIR = "__FUYU_DIR__";
const RUNNING_FILE = join(FUYU_DIR, "agent-pi-running.flag");
const HOLD_FILE = join(FUYU_DIR, "agent-pi-running-hold.flag");
const STATUS_FILE = join(FUYU_DIR, "agent-status.json");
const NOTES_DIR = join(FUYU_DIR, "agent-notifications");
const SESSIONS_DIR = join(FUYU_DIR, "agent-sessions");
const CONFIG_FILE = join(FUYU_DIR, "agent-approval.json");
const ROUTE = "/pi/permission";
const WAIT_MS = 140000;
const MIN_VISIBLE_MS = 800;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const open = new Map();

function cleanId(raw) {
  return String(raw ?? "").replace(/[^A-Za-z0-9_.-]/g, "_");
}

function sessionIdOf(ctx) {
  try {
    const direct = ctx?.sessionManager?.getSessionId?.();
    if (typeof direct === "string" && SAFE_ID.test(direct)) return direct;
    const file = ctx?.sessionManager?.getSessionFile?.();
    if (typeof file === "string" && file.endsWith(".jsonl")) {
      const stem = basename(file, ".jsonl");
      const id = stem.includes("_") ? stem.slice(stem.lastIndexOf("_") + 1) : stem;
      if (SAFE_ID.test(id)) return id;
    }
  } catch {}
  return null;
}

function noteFile(id) {
  return join(NOTES_DIR, `pi-${cleanId(id)}.json`);
}

async function fuyuDirExists() {
  try {
    return (await stat(FUYU_DIR)).isDirectory();
  } catch {
    return false;
  }
}

async function writeAtomic(target, text) {
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, text, "utf8");
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
    state.pi = { phase, updatedAt: now };
    state.updatedAt = now;
    await writeAtomic(STATUS_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

async function recordSession(ctx, source, endedReason) {
  const sessionId = sessionIdOf(ctx);
  if (!sessionId) return;
  try {
    if (!(await fuyuDirExists())) return;
    await mkdir(SESSIONS_DIR, { recursive: true });
    const file = join(SESSIONS_DIR, `${sessionId}.json`);
    const now = Date.now();
    let record = {
      sessionId,
      provider: "pi",
      source: typeof source === "string" && source ? source : "startup",
      cwd: typeof ctx?.cwd === "string" ? ctx.cwd : null,
      pid: process.pid,
      startedAt: now,
    };
    if (endedReason) {
      try {
        const previous = JSON.parse(await readFile(file, "utf8"));
        if (previous && typeof previous === "object") record = { ...previous, ...record };
      } catch {}
      record.endedAt = now;
      record.reason = endedReason;
    }
    await writeAtomic(file, JSON.stringify(record));
  } catch {}
}

function settle(id) {
  const entry = open.get(id);
  if (!entry) return;
  open.delete(id);
  entry.controller.abort();
  rm(noteFile(id), { force: true }).catch(() => {});
}

function settleSession(sessionId) {
  for (const [id, entry] of open) {
    if (!sessionId || entry.sessionId === sessionId) settle(id);
  }
}

async function endpoint() {
  try {
    const config = JSON.parse((await readFile(CONFIG_FILE, "utf8")).replace(/^\uFEFF/, ""));
    if (!Number.isInteger(config.port) || typeof config.token !== "string" || !config.token) return null;
    return config;
  } catch {
    return null;
  }
}

function post(config, body, signal) {
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
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("error", () => resolve(null));
        res.on("end", () => {
          try {
            resolve(res.statusCode === 200 ? JSON.parse(text) : null);
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end(body);
  });
}

export default function fuyuIslandExtension(pi) {
  if (!pi || typeof pi.on !== "function") return;

  pi.on("session_start", async (event, ctx) => {
    await recordSession(ctx, event?.reason, null);
  });

  pi.on("agent_start", async () => {
    await markRunning();
  });

  pi.on("agent_end", async (event, ctx) => {
    settleSession(sessionIdOf(ctx));
    await markFinished(event?.error ? "failed" : "completed");
  });

  pi.on("session_shutdown", async (event, ctx) => {
    settleSession(sessionIdOf(ctx));
    await rm(RUNNING_FILE, { force: true }).catch(() => {});
    await recordSession(ctx, null, event?.reason ?? "quit");
  });

  pi.on("tool_call", async (event, ctx) => {
    await markRunning();
    if (process.env.FUYU_PI_APPROVAL !== "1") return;
    const sessionId = sessionIdOf(ctx);
    const callId = typeof event?.toolCallId === "string" && event.toolCallId ? event.toolCallId : `${sessionId ?? "pi"}-${Date.now()}`;
    if (!sessionId || open.has(callId)) return;
    const config = await endpoint();
    if (!config) return;
    const controller = new AbortController();
    open.set(callId, { controller, sessionId });
    try {
      if (!(await fuyuDirExists())) return;
      await mkdir(NOTES_DIR, { recursive: true });
      await writeFile(
        noteFile(callId),
        JSON.stringify({ hook_event_name: "PermissionRequest", session_id: sessionId, tool_name: event?.toolName ?? "tool" }),
      );
      const answer = await post(
        config,
        JSON.stringify({
          id: callId,
          sessionID: sessionId,
          permission: typeof event?.toolName === "string" ? event.toolName : "tool",
          patterns: [],
          metadata: event?.input && typeof event.input === "object" ? event.input : {},
          cwd: typeof ctx?.cwd === "string" ? ctx.cwd : null,
        }),
        controller.signal,
      );
      if (answer?.reply === "reject") {
        return { block: true, reason: typeof answer.message === "string" && answer.message ? answer.message : "Denied in Fuyu" };
      }
    } finally {
      settle(callId);
    }
  });
}
