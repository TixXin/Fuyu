import { createWindowServices } from "@fuyu/plugin-base/client/window-services";
import { disabledBuiltinIds, subscribeBuiltinPlugins } from "./builtinSwitches.ts";

export const windowServices = createWindowServices();

if (typeof window !== "undefined") {
  subscribeBuiltinPlugins((plugins) => windowServices.setDisabledOwners(disabledBuiltinIds(plugins)));
}
