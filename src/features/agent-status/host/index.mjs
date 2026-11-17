import { agentsV1 } from "@fuyu/plugin-services";

export const name = "agents";

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);
const FOCUS_FIELDS = new Set(["provider", "sessionId", "cwd", "title"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === "string" && value.length > 0 ? value : null);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function agentsError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  const data = { reason };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return agentsError(code, String(error?.message ?? error), data);
}

export function focusParams(params) {
  const read = isObject(params) ? params : {};
  const fields = Object.keys(read);
  const strings = fields.every((field) => FOCUS_FIELDS.has(field) && (read[field] === undefined || typeof read[field] === "string"));
  if (!strings || !text(read.provider)) {
    throw agentsError("bad-params", "agents/v1 focus takes { provider, sessionId?, cwd?, title? }, all strings");
  }
  return { provider: read.provider, sessionId: text(read.sessionId), cwd: text(read.cwd), title: text(read.title) };
}

export function sessionEntry(session, { listed, unseen, light }) {
  const provider = String(session?.provider ?? "");
  const sessionId = String(session?.sessionId ?? "");
  return {
    key: `${provider}:${sessionId}`,
    provider,
    sessionId,
    title: text(session?.title),
    cwd: text(session?.cwd),
    phase: String(session?.phase ?? "completed"),
    light: text(light) ?? "done",
    updatedAt: number(session?.updatedAt) ?? 0,
    remoteHost: text(session?.remoteHost),
    listed: listed === true,
    unseen: unseen === true,
  };
}

export function reportEntry(report) {
  return { id: String(report?.id ?? ""), name: String(report?.name ?? ""), phase: String(report?.phase ?? "idle"), updatedAt: number(report?.updatedAt) ?? 0 };
}

const usageWindow = (window) => (isObject(window) ? { name: String(window.name ?? ""), used: number(window.used) ?? 0, resetsAt: number(window.resetsAt) } : null);

export function usageReport(usage) {
  if (!isObject(usage)) return null;
  return {
    updatedAt: number(usage.updatedAt),
    fiveHour: usageWindow(usage.fiveHour),
    sevenDay: usageWindow(usage.sevenDay),
    models: Array.isArray(usage.models) ? usage.models.map(usageWindow).filter(Boolean) : [],
    plan: text(usage.plan),
    source: text(usage.source) ?? "hud",
    error: text(usage.error?.kind),
  };
}

export function apply(ctx) {
  const call = (method, params) =>
    ctx.rust.call(`agents.${method}`, params).catch((error) => {
      throw fromRust(error);
    });

  ctx.services.provide(agentsV1, {
    sessions: () => call("sessions", null),
    usage: () => call("usage", null),
    focus: (params) => call("focus", focusParams(params)),
    remoteHosts: () => call("remoteHosts", null),
  });
}
