import { agentsV1 } from "@fuyu/plugin-services";
import { createAgentSourceRegistry, normalizeReportEntry, normalizeSessionEntry, normalizeUsageReport } from "./sources.mjs";

export const name = "agents";

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);
const FOCUS_FIELDS = new Set(["provider", "sessionId", "cwd", "title"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === "string" && value.length > 0 ? value : null);

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
  return normalizeSessionEntry({ ...session, listed: listed === true, unseen: unseen === true, light: text(light) ?? "done" });
}

export function reportEntry(report) {
  return normalizeReportEntry(report);
}

export function usageReport(usage) {
  return normalizeUsageReport(usage);
}

export function apply(ctx) {
  const registry = createAgentSourceRegistry();
  const call = (method, params) =>
    ctx.rust.call(`agents.${method}`, params).catch((error) => {
      throw fromRust(error);
    });

  const provider = ctx.services.provide(agentsV1, {
    sessions: async () => {
      const base = await call("sessions", null);
      return registry.mergeSessions(base);
    },
    usage: async () => {
      const base = await call("usage", null);
      return registry.mergeUsage(base);
    },
    focus: async (params) => {
      const normalized = focusParams(params);
      const custom = await registry.tryFocus(normalized);
      if (custom) return custom;
      return call("focus", normalized);
    },
    remoteHosts: () => call("remoteHosts", null),
  });

  const unsub = registry.subscribe(() => {
    void registry
      .mergeSessions({ sessions: [], others: [] })
      .then((merged) => provider.emit("changed", { count: merged.sessions.length + merged.others.length }));
  });
  ctx.effect(() => unsub, "agents.sources.watch");
  const stopAccessor = ctx.reflect.accessor("agentSources", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = registry.register(spec);
          caller.effect(() => off, `agentSources.register(${spec?.provider ?? ""})`);
          return off;
        },
      });
    },
  });
  ctx.effect(() => stopAccessor, "agentSources.accessor");
  ctx.provide("agents.sources", Object.freeze({ register: (spec) => registry.register(spec) }));
}
