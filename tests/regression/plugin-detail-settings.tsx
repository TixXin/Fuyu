import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { commandsV1, pluginConfigV1, type CommandItem } from "@fuyu/plugin-services";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import "../../src/windows/settings/PluginPage.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS } from "../../src/i18n";
import type { InstalledEntry } from "../../src/windows/settings/pluginEntries";
import type { PluginDetailTab } from "../../src/windows/settings/pluginPageHandoff";
import type { PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";

const locale = "zh-CN";
const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, locale);
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });
mockIPC((command) => {
  if (command === "get_platform_support") return { os: "windows", unsupported: [], devBuild: false };
  return null;
});

const { windowServices } = await import("../../src/features/plugin-kernel/services");
const { windowSlots } = await import("../../src/features/plugin-kernel/slots");
const { PluginDetailModal } = await import("../../src/windows/settings/PluginDetailModal");

const t = TRANSLATIONS[locale].settings.pluginsV3.page.detail;
const loc = (zh: string, en: string) => ({ "zh-CN": zh, en });
const CLOCK = "@someone/clock";

windowServices.provide(pluginConfigV1, {
  list: () => ({ items: [] }),
  get: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
  set: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
  reset: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
});

const command = (pluginId: string, id: string, zh: string, en: string, active = true, keybinding: string | null = null): CommandItem => ({
  pluginId, pluginName: null, id, title: loc(zh, en), defaultKeybinding: keybinding, keybinding, active, conflicts: [],
});
const commands: CommandItem[] = [
  command(CLOCK, "add-city", "添加城市", "Add a city", true, "Alt+Shift+C"),
  command(CLOCK, "broken", "坏掉的命令", "Broken command"),
  command(CLOCK, "unhandled", "没接上的命令", "Unhandled command"),
  command("@me/gadget", "poke", "戳一下", "Poke", false),
  command("@someone/todo-sync", "sync", "立即同步", "Sync now"),
];
const runs: string[] = [];
let finishRun: (() => void) | null = null;
windowServices.provide(commandsV1, {
  list: () => ({ items: commands }),
  run: ({ plugin, command: id }) => {
    runs.push(`${plugin}:${id}`);
    if (id === "broken") return Promise.reject(new Error("the clock service is not responding"));
    if (id === "unhandled") return Promise.reject(Object.assign(new Error(`command ${id} of plugin ${plugin} is not running`), { code: "not-running" }));
    return new Promise<null>((resolve) => {
      finishRun = () => resolve(null);
    });
  },
  setKeybinding: () => ({ items: commands }),
});

function ClockSection() {
  const [inBar, setInBar] = useState(false);
  return (
    <section className="demo-clock" data-demo-section="clock">
      <h3>世界时钟</h3>
      <label>
        <input type="checkbox" checked={inBar} onChange={(event) => setInBar(event.currentTarget.checked)} />
        <span>{inBar ? "收起条上显示：开" : "收起条上显示：关"}</span>
      </label>
    </section>
  );
}
const ClockExtra = () => <p data-demo-section="clock-extra">时区列表</p>;
const OtherSection = () => <p data-demo-section="other">别的插件的设置</p>;
const BuiltinSection = () => <p data-demo-section="builtin">内置功能的设置</p>;
const registry = windowSlots("settings");
registry.add("settings.section/v1", { id: "world-clock", category: "pluginsV3", component: ClockSection }, CLOCK, { external: true });
registry.add("settings.section/v1", { id: "world-clock.zones", category: "todos", component: ClockExtra }, CLOCK, { external: true });
registry.add("settings.section/v1", { id: "notes", category: "pluginsV3", component: OtherSection }, "@someone/notes", { external: true });
registry.add("settings.section/v1", { id: "world-clock.builtin", category: "pluginsV3", component: BuiltinSection }, CLOCK, { external: false });

const plugin = (id: string, state: string): PluginStatusV3 => ({ id, name: id, state, kind: "third-party", source: "market" });
const entry = (id: string, title: string, state: string): InstalledEntry => ({
  id, title, plugin: plugin(id, state), description: null, version: "1.0.0", publisher: "someone", source: "market", managed: true, removable: true,
  enabled: state !== "disabled", status: { dot: state === "running" ? "ok" : state === "disabled" ? "off" : "wait", label: state === "running" ? null : state === "disabled" ? "off" : "waiting", note: null, attention: false },
});
const clock = entry(CLOCK, "世界时钟", "running");
const weather = entry("@fuyu/weather", "天气", "running");
const gadget = entry("@me/gadget", "小工具", "disabled");
const todoSync = entry("@someone/todo-sync", "待办同步", "waiting");

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const settle = (ms = 60) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const until = async (ready: () => boolean, label: string) => {
  for (let i = 0; i < 60; i += 1) {
    if (ready()) return;
    await settle(50);
  }
  throw new Error(`timed out waiting for ${label}`);
};
const click = (element: Element | null | undefined) => act(async () => { if (!element) throw new Error("missing element to click"); (element as HTMLElement).click(); });
const stage = document.getElementById("stage")!;
const results = document.getElementById("results")!;
let root: Root | null = null;

async function show(item: InstalledEntry, tab: PluginDetailTab, stale = false) {
  if (root) await act(async () => root!.unmount());
  const host = document.createElement("div");
  stage.replaceChildren(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <StrictMode>
        <I18nProvider>
          <PluginDetailModal entry={item} initialTab={tab} stale={stale} onClose={() => undefined} onAction={() => undefined} onOpenShortcuts={() => undefined} />
        </I18nProvider>
      </StrictMode>,
    );
  });
  await settle(80);
  return document.querySelector<HTMLElement>(`[data-plugin-detail='${item.id}']`)!;
}
const visible = (element: Element | null) => element instanceof HTMLElement && getComputedStyle(element).display !== "none";
const runButton = (dialog: HTMLElement, id: string) => dialog.querySelector<HTMLButtonElement>(`[data-command='${id}'] [data-action='run-command']`)!;

try {
  let dialog = await show(clock, "settings");
  const sections = dialog.querySelector("[data-plugin-sections='@someone/clock']");
  check(sections?.querySelector("[data-demo-section='clock']"), "Settings: a plugin's own settings section shows in its detail dialog");
  check(sections?.querySelector("[data-demo-section='clock-extra']"), "A section the plugin files under another category still shows, because sections belong to the plugin by id");
  check(!dialog.querySelector("[data-demo-section='other']") && !dialog.querySelector("[data-demo-section='builtin']"), "Sections from other plugins and built-in sections stay out");
  check(!visible(dialog.querySelector(".plugin-detail__no-settings")), "The 'no settings' note hides when the plugin has its own section");
  await click(sections?.querySelector("input[type='checkbox']"));
  check(sections?.textContent?.includes("收起条上显示：开"), "The section works in place: toggling its control changes it");

  dialog = await show(weather, "settings");
  check(!dialog.querySelector("[data-plugin-sections]") && visible(dialog.querySelector(".plugin-detail__no-settings")), "A plugin with no section and no form says it has no settings");

  dialog = await show(gadget, "settings");
  check(dialog.querySelector("[data-settings-off]")?.textContent === t.settingsOff, "A plugin that is not running says its own settings show once it runs");

  dialog = await show(clock, "commands");
  check(!dialog.querySelector("[data-run-blocked]") && dialog.querySelectorAll("[data-action='run-command']").length === 3, "Commands: each command of a running plugin has a Run button");
  const add = runButton(dialog, "add-city");
  await click(add);
  check(runs.includes("@someone/clock:add-city"), "Run calls commands.run with the plugin and command id");
  check(add.disabled && add.getAttribute("aria-busy") === "true" && add.textContent === t.running, "While it runs the button is busy and says so");
  await act(async () => finishRun?.());
  await until(() => add.textContent === t.ran, "the done label");
  check(!add.disabled, "When it finishes the button says it ran");
  await until(() => add.textContent === t.run, "the button to settle back");
  check(add.closest("[data-run-state]")?.getAttribute("data-run-state") === "idle", "and goes back to Run after a moment");
  await click(runButton(dialog, "broken"));
  await until(() => Boolean(dialog.querySelector("[data-command='broken'] [data-run-error]")), "the failure message");
  check(dialog.querySelector("[data-command='broken'] [data-run-error]")?.textContent === t.runFailed("the clock service is not responding") && !runButton(dialog, "broken").disabled, "A failed run shows why and the button can be pressed again");

  await click(runButton(dialog, "unhandled"));
  await until(() => Boolean(dialog.querySelector("[data-command='unhandled'] [data-run-error]")), "the unhandled message");
  check(dialog.querySelector("[data-command='unhandled'] [data-run-error]")?.textContent === t.runFailed(t.runNotHandled), "A command the plugin declared but never handles says the plugin needs an update instead of the raw host message");

  dialog = await show(clock, "commands", true);
  check(dialog.querySelector("[data-run-blocked='offline']")?.textContent === t.runBlocked.offline && runButton(dialog, "add-city").disabled && runButton(dialog, "add-city").title === t.runBlocked.offline, "Run is locked with a reason when the plugin process is not connected");
  dialog = await show(gadget, "commands");
  check(dialog.querySelector("[data-run-blocked='off']") && runButton(dialog, "poke").disabled, "Run is locked with a reason when the plugin is off");
  dialog = await show(todoSync, "commands");
  check(dialog.querySelector("[data-run-blocked='notRunning']") && runButton(dialog, "sync").disabled, "Run is locked with a reason when the plugin is not running yet");

  const before = runs.length;
  await click(runButton(dialog, "sync"));
  check(runs.length === before, "A locked Run button does not call commands.run");

  dialog = await show(clock, "settings");
  check(dialog.querySelector("[data-plugin-sections='@someone/clock']"), "Ends on the plugin's settings for the snapshot");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
