import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createLoader, createSlots } from "@fuyu/plugin-base/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { HOST, NORMAL } from "./pluginPageMocks";
import { I18nProvider } from "../../src/i18n";
import type { PluginHostConnector } from "../../src/windows/settings/usePluginHostStatus";

const { openPluginSettings, setPluginSettingsOpener } = await import("../../src/features/plugin-kernel/settingsOpener");
const { openPluginSettingsWindow } = await import("../../src/windows/settings/api");
const { SETTINGS_FOCUS_STORAGE_KEY, takeFocusRequest } = await import("../../src/windows/settings/storage");
const { requestPluginDetail } = await import("../../src/windows/settings/pluginPageHandoff");
const { PluginsV3SettingsPage } = await import("../../src/windows/settings/PluginsV3SettingsPage");

const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string, ...rest: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
const invoked: string[] = [];
const invoke = internals.invoke;
internals.invoke = (command, ...rest) => {
  invoked.push(command);
  return invoke(command, ...rest);
};
setPluginSettingsOpener(openPluginSettingsWindow);

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const settle = (ms = 80) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const stage = document.getElementById("stage")!;
const results = document.getElementById("results")!;

const openers = new Map<string, (...args: unknown[]) => Promise<void>>();
const modules: Record<string, unknown> = {
  "weather/island.js": { default: (ctx: { settings: { open: (...args: unknown[]) => Promise<void> } }) => void openers.set("@fuyu/weather", (...args) => ctx.settings.open(...args)) },
  "clock/island.js": { default: (ctx: { settings: { open: (...args: unknown[]) => Promise<void> } }) => void openers.set("@someone/clock", (...args) => ctx.settings.open(...args)) },
};
const loader = createLoader({
  registry: createSlots({}),
  base: "http://fuyu-plugin.localhost",
  openSettings: openPluginSettings,
  importModule: async (url) => modules[new URL(url).pathname.slice(1)],
  checkFile: async () => undefined,
});
const entry = (plugin: string, path: string) => ({ id: `${plugin}#island`, plugin, window: "island", path, version: "1" });

const settingsWindowReopened = () => {
  const request = takeFocusRequest();
  if (request?.plugin) requestPluginDetail(request.plugin, "settings");
  return request;
};

const connect: PluginHostConnector = (handlers) => {
  const timer = setTimeout(() => {
    handlers.onSnapshot?.({ plugins: NORMAL, host: HOST }, { seq: 1, fresh: true });
    handlers.onState?.("open");
  }, 0);
  return { close: () => clearTimeout(timer) };
};
const dialog = () => document.querySelector<HTMLElement>("[data-plugin-detail]");
const selectedTab = () => dialog()?.querySelector("[role='tab'][aria-selected='true']")?.getAttribute("data-tab");

try {
  await loader.sync([entry("@fuyu/weather", "weather/island.js"), entry("@someone/clock", "clock/island.js")]);
  check(openers.size === 2, "Both plugins load with ctx.settings in their window code");

  localStorage.removeItem(SETTINGS_FOCUS_STORAGE_KEY);
  await openers.get("@fuyu/weather")!("@someone/clock");
  const stored = JSON.parse(localStorage.getItem(SETTINGS_FOCUS_STORAGE_KEY) ?? "null") as { section?: string; plugin?: string } | null;
  check(invoked.includes("open_settings_window"), "ctx.settings.open() on the island opens the settings window");
  check(stored?.section === "pluginsV3" && stored.plugin === "@fuyu/weather", "and asks for the plugin page of the caller, even when it passes another plugin's id");

  const first = settingsWindowReopened();
  check(first?.section === "pluginsV3" && first.plugin === "@fuyu/weather", "The settings window reads the request once");
  check(takeFocusRequest() === null, "and the request is gone after it is read");

  await act(async () => {
    createRoot(stage).render(
      <StrictMode>
        <I18nProvider>
          <PluginsV3SettingsPage connect={connect} onOpenPage={() => undefined} />
        </I18nProvider>
      </StrictMode>,
    );
  });
  await settle(200);
  check(dialog()?.dataset.pluginDetail === "@fuyu/weather" && selectedTab() === "settings", "The plugin page opens the caller's detail dialog on its settings tab");
  check(dialog()?.querySelector("[data-schema-field='autoRefresh']"), "showing the plugin's own settings form");

  await act(async () => { dialog()?.querySelector<HTMLElement>("[data-tab='commands']")?.click(); });
  await openers.get("@fuyu/weather")!();
  await act(async () => { settingsWindowReopened(); });
  await settle();
  check(dialog()?.dataset.pluginDetail === "@fuyu/weather" && selectedTab() === "settings", "Calling it again while the dialog is on another tab goes back to the settings tab");

  await openers.get("@someone/clock")!();
  await act(async () => { settingsWindowReopened(); });
  await settle();
  check(dialog()?.dataset.pluginDetail === "@someone/clock" && selectedTab() === "settings", "With the plugin page already open, another plugin's call switches to that plugin's settings tab");

  await act(async () => { dialog()?.querySelector<HTMLElement>("[data-tab='settings']")?.click(); });
  await openers.get("@fuyu/weather")!();
  await act(async () => { settingsWindowReopened(); });
  await settle();
  check(dialog()?.dataset.pluginDetail === "@fuyu/weather" && selectedTab() === "settings", "Ends on the weather plugin's settings for the snapshot");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
