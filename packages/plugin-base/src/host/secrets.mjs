import { secretsV1 } from "../services.mjs";
import { serviceError } from "./services.mjs";

const RUST = {
  list: "pluginKernel.secretList",
  get: "pluginKernel.secretGet",
  set: "pluginKernel.secretSet",
  remove: "pluginKernel.secretRemove",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nameOf(method, params) {
  if (!isObject(params) || typeof params.name !== "string" || !params.name) throw serviceError("bad-params", `secrets/v1 ${method} needs { name }`);
  return params.name;
}

function valueOf(params) {
  if (typeof params.value !== "string" || !params.value) throw serviceError("bad-params", "secrets/v1 set needs { name, value } with a non-empty string value");
  return params.value;
}

function ownerOf(method, caller) {
  if (caller?.window || typeof caller?.plugin !== "string" || !caller.plugin) {
    throw serviceError("forbidden", `secrets/v1 ${method}: only a plugin's host part keeps secrets; its window asks its own host part instead`);
  }
  return caller.plugin;
}

export class PluginSecrets {
  constructor({ services }) {
    this.services = services;
    this.rpc = null;
    this.handle = null;
  }

  install(ctx) {
    this.handle = this.services.provideBuiltin(ctx, secretsV1, {
      list: (_params, caller) => this.ask("list", ownerOf("list", caller), {}),
      get: (params, caller) => this.ask("get", ownerOf("get", caller), { name: nameOf("get", params) }),
      set: (params, caller) => {
        const plugin = ownerOf("set", caller);
        return this.ask("set", plugin, { name: nameOf("set", params), value: valueOf(params) });
      },
      remove: (params, caller) => this.ask("remove", ownerOf("remove", caller), { name: nameOf("remove", params) }),
    });
    return () => void this.handle?.dispose();
  }

  attach(rpc) {
    this.rpc = rpc;
  }

  async ask(method, plugin, params) {
    if (!this.rpc) throw serviceError("not-ready", `secrets/v1 ${method}: the app's credential store is not connected`);
    try {
      return await this.rpc.call(RUST[method], { plugin, ...params });
    } catch (error) {
      const code = typeof error?.code === "string" && error.code ? error.code : "failed";
      throw serviceError(code, `secrets/v1 ${method}: ${String(error?.message ?? error)}`);
    }
  }
}
