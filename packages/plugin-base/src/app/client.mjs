import { PluginIsland } from "./island-service.mjs";
import { PluginSettings } from "./settings-service.mjs";

export const APP_CLIENT_SERVICES = Object.freeze([
  Object.freeze({ name: "settings", service: PluginSettings, options: ({ openSettings = null, reportSetup = null }) => ({ open: openSettings, setup: reportSetup }) }),
  Object.freeze({ name: "island", service: PluginIsland, options: ({ island = null }) => ({ control: island }) }),
]);
