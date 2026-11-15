import { pluginId } from "./clients.mjs";

export const SERVICE_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*\/v[1-9][0-9]{0,3}$/;
export const SERVICE_TIMEOUT_MS = 30_000;
const MEMBER = /^[a-z][A-Za-z0-9]{0,63}$/;

export function serviceError(code, message, data) {
  return Object.assign(new Error(message), { code, ...(data === undefined ? {} : { data }) });
}

function jsonOrUndefined(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function failure(error) {
  if (typeof error?.code === "string" && error.code) {
    return serviceError(error.code, String(error.message ?? error), jsonOrUndefined(error.data));
  }
  return serviceError("failed", String(error?.message ?? error));
}

function checkName(name) {
  if (typeof name !== "string" || !SERVICE_NAME.test(name)) throw serviceError("bad-params", `${String(name)} is not a service name like "timers/v1"`);
}

function checkDefinition(definition) {
  const ok = definition && typeof definition === "object" && definition.methods && typeof definition.methods === "object" && definition.events && typeof definition.events === "object";
  if (!ok) throw new TypeError("a service needs a definition from defineService()");
  checkName(definition.name);
}

const eventKey = (name, event) => `service:${name}:${event}`;
const declared = (table, member) => typeof member === "string" && Object.hasOwn(table, member);

export class Services {
  constructor() {
    this.providers = new Map();
    this.interest = new Map();
    this.watchers = new Set();
    this.windows = null;
  }

  install(ctx) {
    const services = this;
    return ctx.reflect.accessor("services", {
      get() {
        const caller = this;
        return Object.freeze({
          provide: (definition, impl) => services.provide(caller, definition, impl),
          get: (definition) => services.get(caller, definition),
          list: () => services.list(),
        });
      },
    });
  }

  provide(ctx, definition, impl) {
    checkDefinition(definition);
    const methods = {};
    for (const method of Object.keys(definition.methods)) {
      if (typeof impl?.[method] !== "function") throw new TypeError(`the provider of ${definition.name} has no method ${method}`);
      methods[method] = impl[method];
    }
    const provider = { definition, impl, methods, plugin: pluginId(ctx), ctx, pending: new Set(), active: true };
    const handle = {
      emit: (event, data) => this.emit(provider, event, data),
      dispose: () => Promise.all([unregister(), unprovide()]).then(() => {}),
    };
    const unprovide = ctx.provide(definition.name, Object.freeze({ service: definition.name }));
    const unregister = ctx.effect(() => {
      this.providers.set(definition.name, provider);
      this.changed();
      return () => {
        provider.active = false;
        if (this.providers.get(definition.name) === provider) this.providers.delete(definition.name);
        for (const call of [...provider.pending]) call.fail(serviceError("peer-gone", `the provider of ${definition.name} went away before ${call.method} answered`, { service: definition.name, method: call.method }));
        this.changed();
      };
    }, `ctx.services.provide(${definition.name})`);
    return Object.freeze(handle);
  }

  get(ctx, definition) {
    checkDefinition(definition);
    const caller = { plugin: pluginId(ctx) };
    const client = {};
    for (const method of Object.keys(definition.methods)) {
      client[method] = (params, options) => this.invoke(definition.name, method, params, caller, options);
    }
    client.on = (event, listener) => {
      if (!declared(definition.events, event)) throw serviceError("no-event", `${definition.name} declares no event ${String(event)}`);
      return ctx.on(eventKey(definition.name, event), listener);
    };
    return Object.freeze(client);
  }

  invoke(name, method, params, caller, options = {}) {
    try {
      checkName(name);
    } catch (error) {
      return Promise.reject(error);
    }
    const provider = this.providers.get(name);
    if (!provider) return Promise.reject(serviceError("not-ready", `the service ${name} has no provider right now`, { service: name }));
    if (!declared(provider.definition.methods, method)) return Promise.reject(serviceError("no-method", `${name} declares no method ${String(method)}`, { service: name }));
    const declaredMs = provider.definition.methods[method].timeoutMs ?? SERVICE_TIMEOUT_MS;
    const askedMs = Number.isInteger(options?.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : Infinity;
    const limit = Math.min(declaredMs, askedMs);
    const streams = provider.definition.methods[method].progress === true && typeof options?.onProgress === "function";
    return new Promise((resolve, reject) => {
      let timer = null;
      const call = { method };
      const finish = (settle, value) => {
        if (!provider.pending.delete(call)) return;
        clearTimeout(timer);
        settle(value);
      };
      call.fail = (error) => finish(reject, error);
      provider.pending.add(call);
      timer = setTimeout(() => call.fail(serviceError("timeout", `${name} ${method} did not answer within ${limit} ms`, { service: name, method, timeoutMs: limit })), limit);
      timer.unref?.();
      const progress = (chunk) => {
        if (streams && provider.pending.has(call)) options.onProgress(chunk);
      };
      let result;
      try {
        result = Reflect.apply(provider.methods[method], provider.impl, [params, Object.freeze({ ...caller, progress })]);
      } catch (error) {
        return call.fail(failure(error));
      }
      Promise.resolve(result).then(
        (value) => finish(resolve, value),
        (error) => call.fail(failure(error)),
      );
    });
  }

  emit(provider, event, data) {
    const name = provider.definition.name;
    if (!declared(provider.definition.events, event)) throw serviceError("no-event", `${name} declares no event ${String(event)}`);
    if (!provider.active || this.providers.get(name) !== provider) return false;
    provider.ctx.emit(eventKey(name, event), data);
    this.toWindows(name, event, data);
    return true;
  }

  toWindows(name, event, data) {
    const key = eventKey(name, event);
    const wanted = this.interest.get(key);
    if (!wanted || !this.windows) return;
    const connected = new Set(this.windows.connected());
    for (const window of [...wanted]) if (!connected.has(window)) wanted.delete(window);
    if (!wanted.size) return void this.interest.delete(key);
    this.windows.publish("service", { service: name, event, data: data ?? null });
  }

  attachWindows(windows) {
    this.windows = windows;
    return () => {
      if (this.windows === windows) this.windows = null;
      this.interest.clear();
    };
  }

  windowCall(method, params, window) {
    if (method === "service.call") return this.callFromWindow(params, window);
    if (!params || typeof params !== "object") throw serviceError("bad-params", `${method} needs { service, event }`);
    checkName(params.service);
    if (typeof params.event !== "string" || !MEMBER.test(params.event)) throw serviceError("bad-params", `${method} needs the name of an event`);
    const key = eventKey(params.service, params.event);
    if (method === "service.off") {
      const wanted = this.interest.get(key);
      wanted?.delete(window);
      if (wanted && !wanted.size) this.interest.delete(key);
      return true;
    }
    const provider = this.providers.get(params.service);
    if (provider && !declared(provider.definition.events, params.event)) throw serviceError("no-event", `${params.service} declares no event ${params.event}`);
    if (!this.interest.has(key)) this.interest.set(key, new Set());
    this.interest.get(key).add(window);
    return true;
  }

  async callFromWindow(params, window) {
    if (!params || typeof params !== "object" || typeof params.method !== "string") throw serviceError("bad-params", "service.call needs { service, method, params }");
    const result = await this.invoke(params.service, params.method, params.params, { window });
    try {
      if (result !== undefined) JSON.stringify(result);
    } catch (error) {
      throw serviceError("bad-result", `${params.service} ${params.method} returned something that is not JSON: ${error.message}`);
    }
    return result ?? null;
  }

  list() {
    return [...this.providers.values()]
      .map(({ definition, plugin }) => ({ name: definition.name, plugin, methods: Object.keys(definition.methods), events: Object.keys(definition.events) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  watch(listener) {
    this.watchers.add(listener);
    return () => this.watchers.delete(listener);
  }

  changed() {
    const list = this.list();
    for (const listener of this.watchers) listener(list);
  }
}

export const SERVICE_CALLS = new Set(["service.call", "service.on", "service.off"]);
