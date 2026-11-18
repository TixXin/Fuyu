const PROVIDER_ID = /^[a-zA-Z][a-zA-Z0-9._-]{0,62}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === "string" && value.length > 0 ? value : null);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function sourceError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function normalizeSessionEntry(session, fallbackProvider = "") {
  const provider = String(session?.provider || fallbackProvider || "");
  const sessionId = String(session?.sessionId ?? "");
  return {
    key: typeof session?.key === "string" && session.key ? session.key : `${provider}:${sessionId}`,
    provider,
    sessionId,
    title: text(session?.title),
    cwd: text(session?.cwd),
    phase: String(session?.phase ?? "completed"),
    light: text(session?.light) ?? (session?.phase === "running" ? "working" : "done"),
    updatedAt: number(session?.updatedAt) ?? 0,
    remoteHost: text(session?.remoteHost),
    listed: session?.listed !== false,
    unseen: session?.unseen === true,
  };
}

export function normalizeReportEntry(report, fallbackId = "") {
  return {
    id: String(report?.id || fallbackId || ""),
    name: String(report?.name || report?.id || fallbackId || ""),
    phase: String(report?.phase ?? "idle"),
    updatedAt: number(report?.updatedAt) ?? 0,
  };
}

const usageWindow = (window) =>
  isObject(window) ? { name: String(window.name ?? ""), used: number(window.used) ?? 0, resetsAt: number(window.resetsAt) } : null;

export function normalizeUsageReport(usage) {
  if (!isObject(usage)) return null;
  return {
    updatedAt: number(usage.updatedAt),
    fiveHour: usageWindow(usage.fiveHour),
    sevenDay: usageWindow(usage.sevenDay),
    models: Array.isArray(usage.models) ? usage.models.map(usageWindow).filter(Boolean) : [],
    plan: text(usage.plan),
    source: text(usage.source) ?? "hud",
    error: text(usage.error?.kind ?? usage.error),
  };
}

export function createAgentSourceRegistry() {
  const sources = new Map();
  const listeners = new Set();

  function notify() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {}
    }
  }

  return {
    register(spec) {
      if (!isObject(spec) || typeof spec.provider !== "string" || !PROVIDER_ID.test(spec.provider)) {
        throw sourceError("bad-params", "an agent source needs a provider matching /^[a-zA-Z][a-zA-Z0-9._-]{0,62}$/");
      }
      if (sources.has(spec.provider)) {
        throw sourceError("conflict", `agent source ${spec.provider} is already registered`, { provider: spec.provider });
      }
      if (spec.sessions !== undefined && typeof spec.sessions !== "function") {
        throw sourceError("bad-params", `agent source ${spec.provider}: sessions must be a function when given`);
      }
      if (spec.others !== undefined && typeof spec.others !== "function") {
        throw sourceError("bad-params", `agent source ${spec.provider}: others must be a function when given`);
      }
      if (spec.focus !== undefined && typeof spec.focus !== "function") {
        throw sourceError("bad-params", `agent source ${spec.provider}: focus must be a function when given`);
      }
      if (spec.usage !== undefined && typeof spec.usage !== "function") {
        throw sourceError("bad-params", `agent source ${spec.provider}: usage must be a function when given`);
      }
      const entry = {
        provider: spec.provider,
        sessions: spec.sessions ?? null,
        others: spec.others ?? null,
        focus: spec.focus ?? null,
        usage: spec.usage ?? null,
      };
      sources.set(entry.provider, entry);
      notify();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (sources.get(entry.provider) === entry) {
          sources.delete(entry.provider);
          notify();
        }
      };
    },

    has(provider) {
      return typeof provider === "string" && sources.has(provider);
    },

    get(provider) {
      return typeof provider === "string" ? sources.get(provider) ?? null : null;
    },

    async mergeSessions(base) {
      const entries = [...sources.values()];
      const baseSessions = Array.isArray(base?.sessions) ? base.sessions : [];
      const baseOthers = Array.isArray(base?.others) ? base.others : [];
      if (!entries.length) return { sessions: baseSessions, others: baseOthers };
      const extraSessions = [];
      const extraOthers = [];
      await Promise.all(
        entries.map(async (entry) => {
          if (entry.sessions) {
            try {
              const list = await entry.sessions();
              if (Array.isArray(list)) {
                for (const item of list) {
                  if (isObject(item) && typeof item.sessionId === "string" && item.sessionId) {
                    extraSessions.push(normalizeSessionEntry(item, entry.provider));
                  }
                }
              }
            } catch {}
          }
          if (entry.others) {
            try {
              const list = await entry.others();
              if (Array.isArray(list)) {
                for (const item of list) {
                  if (isObject(item)) extraOthers.push(normalizeReportEntry(item, entry.provider));
                }
              }
            } catch {}
          }
        }),
      );
      const seenKeys = new Set(baseSessions.map((item) => item.key));
      const mergedSessions = [...baseSessions];
      for (const item of extraSessions) {
        if (!seenKeys.has(item.key)) {
          seenKeys.add(item.key);
          mergedSessions.push(item);
        }
      }
      return {
        sessions: mergedSessions,
        others: [...baseOthers, ...extraOthers],
      };
    },

    async mergeUsage(base) {
      const entries = [...sources.values()].filter((entry) => entry.usage);
      const claude = base?.claude ?? null;
      const codex = base?.codex ?? null;
      if (!entries.length) return { claude, codex };
      let nextClaude = claude;
      let nextCodex = codex;
      const extra = {};
      await Promise.all(
        entries.map(async (entry) => {
          try {
            const report = normalizeUsageReport(await entry.usage());
            if (entry.provider === "claude" || entry.provider === "claudeCode") {
              if (report) nextClaude = report;
            } else if (entry.provider === "codex") {
              if (report) nextCodex = report;
            } else {
              extra[entry.provider] = report;
            }
          } catch {
            if (entry.provider !== "claude" && entry.provider !== "claudeCode" && entry.provider !== "codex") {
              extra[entry.provider] = null;
            }
          }
        }),
      );
      return Object.keys(extra).length > 0 ? { claude: nextClaude, codex: nextCodex, extra } : { claude: nextClaude, codex: nextCodex };
    },

    async tryFocus(params) {
      const entry = sources.get(params.provider);
      if (!entry?.focus) return null;
      const result = await entry.focus(params);
      if (typeof result === "boolean") return { found: result };
      if (isObject(result) && typeof result.found === "boolean") return { found: result.found };
      return { found: false };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const agentSources = createAgentSourceRegistry();
export const registerAgentSource = (spec) => agentSources.register(spec);
export const subscribeAgentSources = (listener) => agentSources.subscribe(listener);
