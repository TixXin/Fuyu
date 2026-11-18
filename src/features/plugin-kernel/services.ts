import { createWindowServices } from "@fuyu/plugin-base/client/window-services";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";

const raw = createWindowServices();
let syncing = false;

function ensureSync() {
  if (syncing || typeof window === "undefined") return;
  syncing = true;
  subscribeBuiltinPlugins((plugins) => raw.setDisabledOwners(disabledBuiltinIds(plugins)));
}

export const windowServices: typeof raw = {
  ...raw,
  provide(service, impl, options) {
    ensureSync();
    return raw.provide(service, impl, options);
  },
  attach(proxy) {
    ensureSync();
    raw.attach(proxy);
  },
};
