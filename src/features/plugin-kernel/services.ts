import { createWindowServices } from "@fuyu/plugin-base/client/window-services";
import type { ServiceProxy } from "@fuyu/plugin-base/client";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";

const raw = createWindowServices();
let syncing = false;
let layers: ServiceProxy[] = [];

function ensureSync() {
  if (syncing || typeof window === "undefined") return;
  syncing = true;
  subscribeBuiltinPlugins((plugins) => raw.setDisabledOwners(disabledBuiltinIds(plugins)));
}

function settle() {
  raw.attach(layers[layers.length - 1] ?? null);
}

export type LayeredWindowServices = Omit<typeof raw, "attach"> & {
  attach(proxy: ServiceProxy | null): () => void;
};

export const windowServices: LayeredWindowServices = {
  ...raw,
  provide(service, impl, options) {
    ensureSync();
    return raw.provide(service, impl, options);
  },
  attach(proxy) {
    ensureSync();
    if (proxy === null) {
      layers = [];
      settle();
      return () => undefined;
    }
    layers = [...layers.filter((item) => item !== proxy), proxy];
    settle();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (!layers.includes(proxy)) return;
      layers = layers.filter((item) => item !== proxy);
      settle();
    };
  },
};
