import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pluginConfigV1 } from "../services.mjs";
import { pluginId } from "./clients.mjs";
import { dataDirOf } from "./data.mjs";
import { installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";
import { SOURCE } from "./sources.mjs";
import { INTERNAL } from "./status.mjs";

export const CONFIG_FILE = "config.json";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defaultsOf(schema) {
  const defaults = {};
  if (!isPlainObject(schema?.properties)) return defaults;
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (isPlainObject(prop) && prop.default !== undefined) {
      defaults[key] = structuredClone(prop.default);
    }
  }
  return defaults;
}

function checkPropertyValue(key, value, prop) {
  if (!isPlainObject(prop)) return `unknown config key "${key}"`;
  switch (prop.type) {
    case "boolean":
      if (typeof value !== "boolean") return `config "${key}" must be a boolean`;
      break;
    case "string":
      if (typeof value !== "string") return `config "${key}" must be a string`;
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return `config "${key}" must be a finite number`;
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) return `config "${key}" must be an integer`;
      break;
    default:
      return `config "${key}" has unsupported schema type "${String(prop.type)}"`;
  }
  if (Array.isArray(prop.enum) && !prop.enum.includes(value)) {
    return `config "${key}" must be one of ${prop.enum.map((item) => JSON.stringify(item)).join(", ")}`;
  }
  if (typeof prop.minimum === "number" && typeof value === "number" && value < prop.minimum) {
    return `config "${key}" must be >= ${prop.minimum}`;
  }
  if (typeof prop.maximum === "number" && typeof value === "number" && value > prop.maximum) {
    return `config "${key}" must be <= ${prop.maximum}`;
  }
  return null;
}

export class PluginConfig {
  constructor({ dataRoot, services, usage = null }) {
    this.dataRoot = dataRoot;
    this.services = services;
    this.usage = usage;
    this.ctx = null;
    this.handle = null;
    this.listeners = new Map();
  }

  install(ctx) {
    this.ctx = ctx;
    const config = this;
    const unaccess = installInjectableAccessor(ctx, "config", function () {
      const caller = this;
      const id = pluginId(caller);
      return Object.freeze({
        get: () => config.get({ id }).values,
        set: async (patch) => config.set({ id, values: patch }).values,
        reset: async () => config.reset({ id }).values,
        onChange: (listener) => config.onChange(caller, id, listener),
      });
    });
    this.handle = this.services.provideBuiltin(ctx, pluginConfigV1, {
      list: () => this.list(),
      get: (params) => this.get(params),
      set: (params) => this.set(params),
      reset: (params) => this.reset(params),
    });
    return () => {
      void unaccess();
      void this.handle?.dispose();
    };
  }

  configFileOf(id) {
    if (typeof id !== "string" || !id) throw serviceError("bad-params", "plugin-config needs { id }");
    try {
      return join(dataDirOf(this.dataRoot, id), CONFIG_FILE);
    } catch (error) {
      throw serviceError("bad-params", error.message);
    }
  }

  schemaOf(id) {
    for (const entry of this.ctx?.loader?.entries() ?? []) {
      if (entry.options.id === id) return entry.options[SOURCE]?.configSchema ?? null;
    }
    return null;
  }

  readValidOverrides(file, schema) {
    let raw;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return {};
    }
    if (!isPlainObject(raw)) return {};
    if (!schema) return { ...raw };
    const props = isPlainObject(schema.properties) ? schema.properties : {};
    const valid = {};
    for (const [key, value] of Object.entries(raw)) {
      if (Object.hasOwn(props, key) && checkPropertyValue(key, value, props[key]) === null) {
        valid[key] = value;
      }
    }
    return valid;
  }

  list() {
    const items = [];
    for (const entry of this.ctx?.loader?.entries() ?? []) {
      if (INTERNAL.has(entry.options.name)) continue;
      if (!entry.options[SOURCE]?.configSchema) continue;
      items.push(this.get({ id: entry.options.id }));
    }
    return { items };
  }

  get(params = {}) {
    const id = params?.id;
    const file = this.configFileOf(id);
    const schema = this.schemaOf(id);
    const defaults = defaultsOf(schema);
    const overrides = this.readValidOverrides(file, schema);
    const values = { ...defaults, ...overrides };
    return { id, schema, values, defaults };
  }

  set(params = {}) {
    const id = params?.id;
    const patch = params?.values;
    const file = this.configFileOf(id);
    if (!isPlainObject(patch)) throw serviceError("bad-params", "plugin-config.set needs { id, values }");
    const schema = this.schemaOf(id);
    if (schema) {
      const props = isPlainObject(schema.properties) ? schema.properties : {};
      for (const [key, value] of Object.entries(patch)) {
        if (!Object.hasOwn(props, key)) {
          throw serviceError("bad-config", `unknown config key "${key}"`, { id, key });
        }
        const problem = checkPropertyValue(key, value, props[key]);
        if (problem) throw serviceError("bad-config", problem, { id, key });
      }
    }
    const defaults = defaultsOf(schema);
    const current = this.readValidOverrides(file, schema);
    const nextOverrides = { ...current, ...patch };
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(nextOverrides, null, 2)}\n`);
    const values = { ...defaults, ...nextOverrides };
    this.notify(id, values);
    return { id, schema, values, defaults };
  }

  reset(params = {}) {
    const id = params?.id;
    const file = this.configFileOf(id);
    rmSync(file, { force: true });
    const schema = this.schemaOf(id);
    const defaults = defaultsOf(schema);
    const values = { ...defaults };
    this.notify(id, values);
    return { id, schema, values, defaults };
  }

  onChange(ctx, id, listener) {
    if (typeof listener !== "function") throw new TypeError("ctx.config.onChange needs a listener function");
    const run = this.usage ? this.usage.wrap(id, listener) : listener;
    return ctx.effect(() => {
      let set = this.listeners.get(id);
      if (!set) this.listeners.set(id, (set = new Set()));
      const hook = { ctx, run, active: true };
      set.add(hook);
      return () => {
        hook.active = false;
        set.delete(hook);
        if (set.size === 0 && this.listeners.get(id) === set) this.listeners.delete(id);
      };
    }, "ctx.config.onChange()");
  }

  notify(id, values) {
    const hooks = this.listeners.get(id);
    if (hooks) {
      for (const hook of [...hooks]) {
        if (!hook.active) continue;
        try {
          hook.run(structuredClone(values));
        } catch (error) {
          hook.ctx.logger.error(error);
        }
      }
    }
    this.handle?.emit("changed", { id, values: structuredClone(values) });
  }
}
