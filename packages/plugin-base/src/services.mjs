import { SERVICE_NAME, SERVICE_TIMEOUT_MS } from "./protocol.mjs";

export { SERVICE_NAME };
export const MEMBER_NAME = /^[a-z][A-Za-z0-9]{0,63}$/;
export const RESERVED_MEMBERS = Object.freeze(["on", "then", "catch", "finally", "constructor", "toJSON", "toString", "valueOf"]);
export const DEFAULT_TIMEOUT_MS = SERVICE_TIMEOUT_MS;

const reserved = new Set(RESERVED_MEMBERS);

function members(kind, name, table) {
  if (table === undefined) return Object.freeze({});
  if (!table || typeof table !== "object" || Array.isArray(table)) throw new TypeError(`the ${kind}s of ${name} must be an object keyed by name`);
  const result = {};
  for (const [key, options] of Object.entries(table)) {
    if (!MEMBER_NAME.test(key) || reserved.has(key)) throw new TypeError(`${key} cannot be the name of a ${kind} in ${name}`);
    if (options !== true && (!options || typeof options !== "object")) throw new TypeError(`${name}.${key} must be true or an options object`);
    const timeoutMs = options === true ? undefined : options.timeoutMs;
    if (timeoutMs !== undefined && !(Number.isInteger(timeoutMs) && timeoutMs > 0)) throw new TypeError(`${name}.${key} has a bad timeoutMs`);
    const progress = kind === "method" && options !== true && options.progress === true;
    result[key] = Object.freeze({ ...(timeoutMs === undefined ? {} : { timeoutMs }), ...(progress ? { progress } : {}) });
  }
  return Object.freeze(result);
}

export function defineService(name, { methods, events } = {}) {
  if (typeof name !== "string" || !SERVICE_NAME.test(name)) throw new TypeError(`${name} is not a service name like "timers/v1"`);
  const at = name.lastIndexOf("/v");
  return Object.freeze({
    name,
    base: name.slice(0, at),
    version: Number(name.slice(at + 2)),
    methods: members("method", name, methods),
    events: members("event", name, events),
  });
}

export function isServiceDefinition(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.name === "string" &&
      SERVICE_NAME.test(value.name) &&
      value.methods &&
      typeof value.methods === "object" &&
      value.events &&
      typeof value.events === "object",
  );
}

export const commandsV1 = defineService("commands/v1", {
  methods: { list: true, run: true, setKeybinding: true },
  events: { changed: true },
});

export const pluginConfigV1 = defineService("plugin-config/v1", {
  methods: { list: true, get: true, set: true, reset: true },
  events: { changed: true },
});

export const pluginWindowsV1 = defineService("plugin-windows/v1", {
  methods: { getRules: true, setRules: true, list: true },
  events: { changed: true },
});
