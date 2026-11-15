import { request as httpRequest } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FUYU_DIR = "__FUYU_DIR__";
const NOTES_DIR = join(FUYU_DIR, "agent-notifications");
const CONFIG_FILE = join(FUYU_DIR, "agent-approval.json");
const ROUTE = "/opencode/permission";
const WAIT_MS = 140000;
const REPLIES = new Set(["once", "always", "reject"]);
const open = new Map();

function noteFile(id) {
  return join(NOTES_DIR, `opencode-plugin-${String(id).replace(/[^A-Za-z0-9_.-]/g, "_")}.json`);
}

async function note(request) {
  try {
    await mkdir(NOTES_DIR, { recursive: true });
    await writeFile(noteFile(request.id), JSON.stringify({ hook_event_name: "PermissionRequest", session_id: request.sessionID }));
  } catch {}
}

function asList(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return typeof value === "string" && value ? [value] : [];
}

function normalize(type, props) {
  if (!props || typeof props.id !== "string" || typeof props.sessionID !== "string") return null;
  if (type === "permission.asked") {
    return {
      id: props.id,
      sessionID: props.sessionID,
      permission: typeof props.permission === "string" ? props.permission : "",
      patterns: asList(props.patterns),
      metadata: props.metadata && typeof props.metadata === "object" ? props.metadata : {},
    };
  }
  return {
    id: props.id,
    sessionID: props.sessionID,
    permission: typeof props.type === "string" ? props.type : "",
    patterns: asList(props.pattern),
    metadata: props.metadata && typeof props.metadata === "object" ? props.metadata : {},
    message: typeof props.title === "string" ? props.title : undefined,
  };
}

async function endpoint() {
  try {
    const config = JSON.parse((await readFile(CONFIG_FILE, "utf8")).replace(/^﻿/, ""));
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

async function reply(client, request, answer) {
  const raw = client?._client;
  if (answer.message && raw && typeof raw.post === "function") {
    try {
      const result = await raw.post({
        url: "/permission/{requestID}/reply",
        path: { requestID: request.id },
        body: { reply: answer.reply, message: answer.message },
        headers: { "Content-Type": "application/json" },
      });
      if (result && !result.error) return;
    } catch {}
  }
  try {
    await client.postSessionIdPermissionsPermissionId({
      path: { id: request.sessionID, permissionID: request.id },
      body: { response: answer.reply },
    });
  } catch {}
}

function settle(id) {
  const entry = open.get(id);
  if (!entry) return;
  open.delete(id);
  entry.controller.abort();
  rm(noteFile(id), { force: true }).catch(() => {});
}

async function decide(client, request, directory, controller) {
  const config = await endpoint();
  if (!config || controller.signal.aborted) return;
  const answer = await post(config, JSON.stringify({ ...request, cwd: directory }), controller.signal);
  if (controller.signal.aborted || !open.has(request.id)) return;
  if (!answer || !REPLIES.has(answer.reply)) return;
  await reply(client, request, answer);
  settle(request.id);
}

async function server({ client, directory }) {
  return {
    event: async ({ event }) => {
      const props = event?.properties;
      switch (event?.type) {
        case "permission.asked":
        case "permission.updated": {
          const request = normalize(event.type, props);
          if (!request || open.has(request.id)) return;
          const controller = new AbortController();
          open.set(request.id, { controller, sessionID: request.sessionID });
          await note(request);
          decide(client, request, directory, controller).catch(() => {});
          return;
        }
        case "permission.replied":
          settle(props?.requestID ?? props?.permissionID);
          return;
        case "session.idle":
        case "session.error":
        case "session.deleted": {
          const sessionID = props?.sessionID ?? props?.info?.id;
          for (const [id, entry] of open) {
            if (entry.sessionID === sessionID) settle(id);
          }
          return;
        }
        default:
      }
    },
  };
}

export default { id: "fuyu-island", server, setup: async () => {} };
