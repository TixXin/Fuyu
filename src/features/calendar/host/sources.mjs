const SOURCE_ID = /^[a-z][a-z0-9._-]{0,62}$/;

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => (typeof value === "string" ? value : null);
const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function sourceError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data ? { data } : {}) });
}

export function normalizeCalendarEvent(event, fallbackCalendar = "") {
  return {
    uid: String(event.uid),
    title: String(event.title ?? ""),
    startMs: number(event.startMs),
    endMs: number(event.endMs),
    allDay: event.allDay === true,
    location: text(event.location),
    meetingLink: text(event.meetingLink),
    calendar: String(event.calendar || fallbackCalendar || ""),
  };
}

export function normalizeCalendarProblem(problem, fallbackSourceId = "") {
  const said = isObject(problem?.message) ? problem.message : null;
  return {
    sourceId: String(problem?.sourceId || fallbackSourceId || ""),
    reason: text(problem?.reason) ?? text(said?.code) ?? "failed",
    message: text(said?.message) ?? text(problem?.message) ?? "",
  };
}

export function createCalendarSourceRegistry() {
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
      if (!isObject(spec) || typeof spec.id !== "string" || !SOURCE_ID.test(spec.id)) {
        throw sourceError("bad-params", "a calendar source needs an id matching /^[a-z][a-z0-9._-]{0,62}$/");
      }
      if (sources.has(spec.id)) {
        throw sourceError("conflict", `calendar source ${spec.id} is already registered`, { id: spec.id });
      }
      if (typeof spec.name !== "string" || !spec.name.trim()) {
        throw sourceError("bad-params", `calendar source ${spec.id} needs a non-empty name`);
      }
      if (typeof spec.events !== "function") {
        throw sourceError("bad-params", `calendar source ${spec.id} must provide an events function`);
      }
      const entry = {
        id: spec.id,
        kind: typeof spec.kind === "string" && spec.kind.trim() ? spec.kind.trim() : "plugin",
        name: spec.name.trim(),
        host: typeof spec.host === "string" && spec.host.trim() ? spec.host.trim() : spec.id,
        events: spec.events,
      };
      sources.set(entry.id, entry);
      notify();
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (sources.get(entry.id) === entry) {
          sources.delete(entry.id);
          notify();
        }
      };
    },

    has(id) {
      return typeof id === "string" && sources.has(id);
    },

    list() {
      return [...sources.values()].map(({ id, kind, name, host }) => ({ id, kind, name, host }));
    },

    async collect({ refresh = false, fromMs = 0, toMs = 0 } = {}) {
      const entries = [...sources.values()];
      if (!entries.length) return { events: [], problems: [], sourceCount: 0 };
      const events = [];
      const problems = [];
      await Promise.all(
        entries.map(async (entry) => {
          try {
            const answer = await entry.events({ refresh: refresh === true, fromMs, toMs });
            const rawEvents = Array.isArray(answer) ? answer : isObject(answer) && Array.isArray(answer.events) ? answer.events : [];
            for (const item of rawEvents) {
              if (isObject(item) && typeof item.uid === "string") {
                events.push(normalizeCalendarEvent(item, entry.name));
              }
            }
            if (isObject(answer) && Array.isArray(answer.problems)) {
              for (const problem of answer.problems) {
                if (isObject(problem)) problems.push(normalizeCalendarProblem(problem, entry.id));
              }
            }
          } catch (error) {
            problems.push({
              sourceId: entry.id,
              reason: typeof error?.code === "string" && error.code ? error.code : "failed",
              message: String(error?.message ?? error),
            });
          }
        }),
      );
      return { events, problems, sourceCount: entries.length };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export async function mergeCalendarEvents(base, registry, refresh = false) {
  const extra = await registry.collect({ refresh, fromMs: base.fromMs, toMs: base.toMs });
  if (extra.sourceCount === 0) return base;
  const seen = new Set();
  const merged = [];
  for (const item of [...base.events, ...extra.events]) {
    const key = `${item.uid}\0${item.startMs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => a.startMs - b.startMs);
  return {
    events: merged,
    problems: [...base.problems, ...extra.problems],
    fetchedAt: base.fetchedAt || Date.now(),
    fromMs: base.fromMs,
    toMs: base.toMs,
    sourceCount: base.sourceCount + extra.sourceCount,
  };
}

export function mergeCalendarSources(base, registry) {
  return {
    sources: [...base.sources, ...registry.list()],
  };
}

export const calendarSources = createCalendarSourceRegistry();
export const registerCalendarSource = (spec) => calendarSources.register(spec);
export const subscribeCalendarSources = (listener) => calendarSources.subscribe(listener);
