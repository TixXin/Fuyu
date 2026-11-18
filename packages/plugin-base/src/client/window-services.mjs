import { SERVICE_NAME, SERVICE_TIMEOUT_MS } from "../protocol.mjs";
import { HostCallError } from "./connection.mjs";

const keyOf = (service, event) => `${service}\n${event}`;
const declared = (table, member) => typeof member === "string" && Object.hasOwn(table ?? {}, member);
const serviceError = (code, message, data) => new HostCallError(code, message, data);

function checkDefinition(definition) {
  const ok = definition && typeof definition === "object" && typeof definition.name === "string" && definition.methods && typeof definition.methods === "object" && definition.events && typeof definition.events === "object";
  if (!ok) throw new TypeError("a service needs a definition from defineService()");
  if (!SERVICE_NAME.test(definition.name)) throw serviceError("bad-params", `${definition.name} is not a service name like "timers/v1"`);
}

function failure(error) {
  if (error instanceof HostCallError) return error;
  if (typeof error?.code === "string" && error.code) return serviceError(error.code, String(error.message ?? error), error.data);
  return serviceError("failed", String(error?.message ?? error));
}

export function createWindowServices({ remote = null, owner: defaultOwner = "builtin" } = {}) {
  const providers = new Map();
  const listeners = new Map();
  const remoteOff = new Map();
  const watchers = new Set();
  let disabled = new Set();
  let disabledServices = new Set();
  let host = remote;
  let unwatchHost = null;

  const replacedOnHost = (provider) => {
    const remoteList = typeof host?.list === "function" ? host.list() : [];
    const remoteEntry = remoteList.find((entry) => entry?.name === provider.definition.name);
    return Boolean(remoteEntry && typeof remoteEntry.plugin === "string" && remoteEntry.plugin !== provider.owner);
  };
  const isProviderDisabled = (provider) =>
    disabled.has(provider.owner) ||
    disabledServices.has(provider.definition.name) ||
    disabledServices.has(`${provider.owner}:${provider.definition.name}`) ||
    replacedOnHost(provider);
  const live = (provider) => provider.active && !isProviderDisabled(provider) && providers.get(provider.definition.name)?.includes(provider);
  const current = (name) => providers.get(name)?.find((provider) => !isProviderDisabled(provider)) ?? null;

  function changed() {
    const list = table.list();
    for (const watcher of [...watchers]) watcher(list);
  }

  function failPending(provider, why) {
    for (const call of [...provider.pending]) call.fail(serviceError("peer-gone", `the provider of ${provider.definition.name} ${why} before ${call.method} answered`, { service: provider.definition.name, method: call.method }));
  }

  function invokeLocal(provider, method, params, options) {
    const name = provider.definition.name;
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
      const progress = (chunk) => {
        if (streams && provider.pending.has(call)) options.onProgress(chunk);
      };
      let result;
      try {
        result = Reflect.apply(provider.impl[method], provider.impl, [params, Object.freeze({ window: true, progress })]);
      } catch (error) {
        return call.fail(failure(error));
      }
      Promise.resolve(result).then(
        (value) => finish(resolve, value),
        (error) => call.fail(failure(error)),
      );
    });
  }

  function invoke(definition, method, params, options) {
    const name = definition.name;
    const provider = current(name);
    if (provider) {
      if (!declared(provider.definition.methods, method)) return Promise.reject(serviceError("no-method", `${name} declares no method ${String(method)}`, { service: name }));
      return invokeLocal(provider, method, params, options);
    }
    if (host) {
      const client = host.get(definition);
      if (typeof client[method] !== "function") return Promise.reject(serviceError("no-method", `${name} declares no method ${String(method)}`, { service: name }));
      return Promise.resolve()
        .then(() => client[method](params, options))
        .catch((error) => Promise.reject(failure(error)));
    }
    return Promise.reject(serviceError("not-ready", `the service ${name} has no provider in this window and the plugin host is not connected`, { service: name }));
  }

  function hearRemote(definition, event) {
    const key = keyOf(definition.name, event);
    if (!host || remoteOff.has(key)) return;
    const deliver = (data) => {
      for (const listener of [...(listeners.get(key) ?? [])]) {
        try {
          listener(data);
        } catch (error) {
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    };
    remoteOff.set(key, host.get(definition).on(event, deliver));
  }

  function dropRemote(key) {
    const off = remoteOff.get(key);
    remoteOff.delete(key);
    return off ? Promise.resolve(off()).catch(() => {}) : Promise.resolve();
  }

  const definitions = new Map();

  const table = {
    provide(definition, impl, { owner = defaultOwner } = {}) {
      checkDefinition(definition);
      if (typeof owner !== "string" || !owner) throw new TypeError("a provider needs an owner");
      for (const method of Object.keys(definition.methods)) {
        if (typeof impl?.[method] !== "function") throw new TypeError(`the provider of ${definition.name} has no method ${method}`);
      }
      const provider = { definition, impl, owner, pending: new Set(), active: true };
      const list = providers.get(definition.name) ?? [];
      providers.set(definition.name, [provider, ...list]);
      changed();
      return Object.freeze({
        emit(event, data) {
          if (!declared(definition.events, event)) throw serviceError("no-event", `${definition.name} declares no event ${String(event)}`);
          if (!live(provider) || current(definition.name) !== provider) return false;
          for (const listener of [...(listeners.get(keyOf(definition.name, event)) ?? [])]) {
            try {
              listener(data ?? null);
            } catch (error) {
              queueMicrotask(() => {
                throw error;
              });
            }
          }
          return true;
        },
        async dispose() {
          if (!provider.active) return;
          provider.active = false;
          const rest = (providers.get(definition.name) ?? []).filter((item) => item !== provider);
          if (rest.length) providers.set(definition.name, rest);
          else providers.delete(definition.name);
          failPending(provider, "went away");
          changed();
        },
      });
    },

    get(definition) {
      checkDefinition(definition);
      definitions.set(definition.name, definition);
      const client = {};
      for (const method of Object.keys(definition.methods)) {
        client[method] = (params, options) => invoke(definition, method, params, options);
      }
      client.on = (event, listener) => {
        if (!declared(definition.events, event)) throw serviceError("no-event", `${definition.name} declares no event ${String(event)}`);
        if (typeof listener !== "function") throw new TypeError("a listener must be a function");
        const key = keyOf(definition.name, event);
        let set = listeners.get(key);
        if (!set) listeners.set(key, (set = new Set()));
        const entry = (data) => listener(data);
        set.add(entry);
        hearRemote(definition, event);
        return async () => {
          if (!set.delete(entry) || set.size || listeners.get(key) !== set) return;
          listeners.delete(key);
          await dropRemote(key);
        };
      };
      return Object.freeze(client);
    },

    attach(proxy) {
      if (proxy === host) return;
      unwatchHost?.();
      unwatchHost = null;
      for (const key of [...remoteOff.keys()]) void dropRemote(key);
      host = proxy ?? null;
      if (typeof host?.watch === "function") unwatchHost = host.watch(() => changed());
      for (const key of listeners.keys()) {
        const [name, event] = key.split("\n");
        const definition = definitions.get(name);
        if (definition) hearRemote(definition, event);
      }
      changed();
    },

    setDisabledOwners(ids) {
      const next = new Set(ids);
      for (const list of providers.values()) {
        for (const provider of list) if (next.has(provider.owner) && !disabled.has(provider.owner)) failPending(provider, "was switched off");
      }
      disabled = next;
      changed();
    },

    setDisabledServices(names) {
      const next = new Set(names);
      for (const list of providers.values()) {
        for (const provider of list) {
          const wasOff = disabledServices.has(provider.definition.name) || disabledServices.has(`${provider.owner}:${provider.definition.name}`);
          const nowOff = next.has(provider.definition.name) || next.has(`${provider.owner}:${provider.definition.name}`);
          if (nowOff && !wasOff) failPending(provider, "yielded its service");
        }
      }
      disabledServices = next;
      changed();
    },

    list() {
      return [...providers.values()]
        .flatMap((list) => list.filter((provider) => !isProviderDisabled(provider)).slice(0, 1))
        .map(({ definition, owner }) => ({ name: definition.name, plugin: owner, methods: Object.keys(definition.methods), events: Object.keys(definition.events) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    has: (name) => current(name) !== null,

    owned(owner) {
      let services = 0;
      for (const list of providers.values()) services += list.filter((provider) => provider.owner === owner).length;
      return { services };
    },

    listeners: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),

    watch(watcher) {
      watchers.add(watcher);
      return () => watchers.delete(watcher);
    },
  };
  if (typeof host?.watch === "function") unwatchHost = host.watch(() => changed());
  return Object.freeze(table);
}
