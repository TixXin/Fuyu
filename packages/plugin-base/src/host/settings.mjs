import { pluginId } from "./clients.mjs";
import { installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";

export const SETTINGS_OPEN_EVENT = "settings.open";
export const SETTINGS_OPENER_WINDOW = "island";

export class SettingsOpener {
  constructor() {
    this.windows = null;
  }

  install(ctx) {
    const opener = this;
    const unaccess = installInjectableAccessor(ctx, "settings", function () {
      const caller = this;
      return Object.freeze({ open: () => opener.open(pluginId(caller)) });
    });
    return () => void unaccess();
  }

  attachWindows(windows) {
    this.windows = windows;
    return () => {
      if (this.windows === windows) this.windows = null;
    };
  }

  async open(plugin) {
    if (!this.windows?.connected().includes(SETTINGS_OPENER_WINDOW)) {
      throw serviceError("not-ready", "the island window is not connected, so the settings cannot be opened");
    }
    this.windows.publish(SETTINGS_OPEN_EVENT, { plugin });
  }
}
