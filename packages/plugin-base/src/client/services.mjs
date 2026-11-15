import { SERVICE_TIMEOUT_MS } from "../protocol.mjs";
import { HostCallError } from "./connection.mjs";

const ANSWER_SLACK_MS = 1000;

const keyOf = (service, event) => `${service}\n${event}`;
const declared = (table, member) => typeof member === "string" && Object.hasOwn(table ?? {}, member);

function checkDefinition(definition) {
  const ok = definition && typeof definition === "object" && typeof definition.name === "string" && definition.methods && typeof definition.methods === "object" && definition.events && typeof definition.events === "object";
  if (!ok) throw new TypeError("a service needs a definition from defineService()");
}

export function createServiceProxy(call) {
  const listeners = new Map();
  const watchers = new Set();
  let available = [];

  const want = (service, event) => call("service.on", { service, event });
  const unwant = (service, event) => call("service.off", { service, event });

  return {
    get(definition) {
      checkDefinition(definition);
      const client = {};
      for (const [method, options] of Object.entries(definition.methods)) {
        client[method] = (params, { timeoutMs, onProgress } = {}) => {
          if (typeof onProgress === "function") {
            return Promise.reject(new HostCallError("unsupported", `${definition.name} ${method}: progress does not reach windows yet`));
          }
          const limit = Math.min(options?.timeoutMs ?? SERVICE_TIMEOUT_MS, Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : Infinity);
          return call("service.call", { service: definition.name, method, params: params ?? null }, { timeoutMs: limit + ANSWER_SLACK_MS });
        };
      }
      client.on = (event, listener) => {
        if (!declared(definition.events, event)) throw new HostCallError("no-event", `${definition.name} declares no event ${String(event)}`);
        const key = keyOf(definition.name, event);
        let set = listeners.get(key);
        if (!set) {
          listeners.set(key, (set = new Set()));
          void want(definition.name, event).catch(() => {});
        }
        const entry = { listener };
        set.add(entry);
        return async () => {
          if (!set.delete(entry) || set.size || listeners.get(key) !== set) return;
          listeners.delete(key);
          await unwant(definition.name, event).catch(() => {});
        };
      };
      return Object.freeze(client);
    },

    deliver(message) {
      const set = listeners.get(keyOf(message?.service, message?.event));
      if (!set) return;
      for (const { listener } of [...set]) {
        try {
          listener(message.data);
        } catch (error) {
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    },

    async resubscribe() {
      await Promise.all([...listeners.keys()].map((key) => want(...key.split("\n")).catch(() => {})));
    },

    update(list) {
      available = Array.isArray(list) ? list : [];
      for (const watcher of watchers) watcher(available);
    },

    list: () => available,
    has: (name) => available.some((entry) => entry.name === name),

    watch(watcher) {
      watchers.add(watcher);
      return () => watchers.delete(watcher);
    },

    subscriptions: () => listeners.size,
  };
}
