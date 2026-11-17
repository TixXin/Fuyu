import { calendarV1 } from "@fuyu/plugin-services";
import {
  createCalendarSourceRegistry,
  mergeCalendarEvents,
  mergeCalendarSources,
  normalizeCalendarEvent,
  normalizeCalendarProblem,
} from "./sources.mjs";

export const name = "calendar";

const PASSED = new Set(["bad-params", "timeout", "peer-gone"]);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function calendarError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function fromRust(error) {
  const reason = typeof error?.code === "string" ? error.code : "failed";
  const code = PASSED.has(reason) ? reason : reason === "inactive" ? "peer-gone" : "failed";
  const data = { reason };
  if (isObject(error?.data?.args)) data.args = error.data.args;
  if (typeof error?.data?.detail === "string") data.detail = error.data.detail;
  return calendarError(code, String(error?.message ?? error), data);
}

export function serviceEvents(snapshot) {
  const read = isObject(snapshot) ? snapshot : {};
  const list = (value) => (Array.isArray(value) ? value.filter(isObject) : []);
  return {
    events: list(read.events).filter((event) => typeof event.uid === "string").map((event) => normalizeCalendarEvent(event)),
    problems: list(read.problems).map((problem) => normalizeCalendarProblem(problem)),
    fetchedAt: number(read.fetchedAt),
    fromMs: number(read.fromMs),
    toMs: number(read.toMs),
    sourceCount: number(read.sourceCount),
  };
}

export function serviceSources(list) {
  const read = Array.isArray(list?.sources) ? list.sources : Array.isArray(list) ? list : [];
  return {
    sources: read
      .filter((source) => isObject(source) && typeof source.id === "string")
      .map((source) => ({
        id: source.id,
        kind: source.kind === "caldav" ? "caldav" : "ics",
        name: String(source.name ?? ""),
        host: String(source.host ?? ""),
      })),
  };
}

export function refreshOf(params) {
  if (params === undefined || params === null) return false;
  if (!isObject(params) || Object.keys(params).some((key) => key !== "refresh") || (params.refresh !== undefined && typeof params.refresh !== "boolean")) {
    throw calendarError("bad-params", "calendar/v1 events takes { refresh?: boolean }");
  }
  return params.refresh === true;
}

export function apply(ctx) {
  const registry = createCalendarSourceRegistry();
  const call = (method, params) =>
    ctx.rust.call(`calendar.${method}`, params, { timeoutMs: calendarV1.methods[method].timeoutMs }).catch((error) => {
      throw fromRust(error);
    });

  const provider = ctx.services.provide(calendarV1, {
    events: async (params) => {
      const refresh = refreshOf(params);
      const base = serviceEvents(await call("events", { refresh }));
      return mergeCalendarEvents(base, registry, refresh);
    },
    sources: async () => {
      const base = serviceSources(await call("sources", null));
      return mergeCalendarSources(base, registry);
    },
  });

  const unsub = registry.subscribe(() => provider.emit("changed", {}));
  ctx.effect(() => unsub, "calendar.sources.watch");
  const stopAccessor = ctx.reflect.accessor("calendarSources", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = registry.register(spec);
          caller.effect(() => off, `calendarSources.register(${spec?.id ?? ""})`);
          return off;
        },
      });
    },
  });
  ctx.effect(() => stopAccessor, "calendarSources.accessor");
  ctx.provide("calendar.sources", Object.freeze({ register: (spec) => registry.register(spec) }));
}
