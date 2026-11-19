import { pluginId } from "./clients.mjs";
import { installInjectableAccessor } from "./owner.mjs";
import { serviceError } from "./services.mjs";

export const SETTINGS_OPEN_EVENT = "settings.open";
export const SETTINGS_OPENER_WINDOW = "island";
export const SETUP_HINT_MAX = 80;
const HINT_LOCALES = ["zh-CN", "en"];

const cleanText = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, SETUP_HINT_MAX) : "");

export function setupHint(hint) {
  if (typeof hint === "string") return cleanText(hint) || null;
  if (!hint || typeof hint !== "object" || Array.isArray(hint)) return null;
  const texts = HINT_LOCALES.map((locale) => [locale, cleanText(hint[locale])]).filter(([, text]) => text !== "");
  return texts.length > 0 ? Object.fromEntries(texts) : null;
}

export class SettingsOpener {
  constructor() {
    this.windows = null;
    this.setups = new Map();
    this.listeners = new Set();
  }

  install(ctx) {
    const opener = this;
    const cleared = new WeakSet();
    const unaccess = installInjectableAccessor(ctx, "settings", function () {
      const caller = this;
      return Object.freeze({
        open: () => opener.open(pluginId(caller)),
        setup: async (state) => {
          const plugin = pluginId(caller);
          if (caller.fiber && !cleared.has(caller.fiber)) {
            cleared.add(caller.fiber);
            caller.effect(() => () => opener.setup(plugin, null), "settings.setup");
          }
          opener.setup(plugin, state);
        },
      });
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

  setup(plugin, state) {
    if (typeof plugin !== "string" || plugin === "") throw serviceError("bad-params", "the setup state needs the id of the calling plugin");
    const next = state && typeof state === "object" && state.needed === true ? { hint: setupHint(state.hint) } : null;
    const before = this.setups.get(plugin) ?? null;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    if (next) this.setups.set(plugin, next);
    else this.setups.delete(plugin);
    for (const listener of [...this.listeners]) listener();
  }

  setupOf(plugin) {
    return this.setups.get(plugin) ?? null;
  }

  forget(plugin) {
    this.setup(plugin, null);
  }

  watch(listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}
