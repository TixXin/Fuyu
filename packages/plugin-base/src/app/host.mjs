import { IslandControl } from "./island.mjs";
import { SettingsOpener } from "./settings.mjs";

export { ISLAND_NOTICE_TIMEOUT_MS, ISLAND_REQUEST_EVENT, ISLAND_TIMEOUT_MS, ISLAND_WINDOW } from "./island.mjs";
export { SETTINGS_OPEN_EVENT, SETTINGS_OPENER_WINDOW, SETUP_HINT_MAX, setupHint } from "./settings.mjs";

export const APP_HOST_EXTENSIONS = Object.freeze([
  Object.freeze({ name: "settingsOpener", create: () => new SettingsOpener() }),
  Object.freeze({ name: "islandControl", create: () => new IslandControl() }),
]);
