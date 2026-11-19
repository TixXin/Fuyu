import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { FEATURE_PAGES, entryOf, sidebarItemOf, type SettingsCategory } from "../../src/windows/settings/categories";
import { SETTINGS_FOCUS_STORAGE_KEY, requestSettingsFocus } from "../../src/windows/settings/storage";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { mockBuiltinPlugins } from "./settingsMocks";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
window.addEventListener("beforeunload", () => {
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) {
    if (!original.has(key)) localStorage.removeItem(key);
  }
  for (const [key, value] of original) localStorage.setItem(key, value);
});
for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) localStorage.removeItem(key);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
localStorage.setItem("fuyu-save-directory", "");
localStorage.setItem("fuyu-qq-notification-access-requested", "true");
localStorage.setItem("fuyu-voice-input", JSON.stringify({ enabled: true }));
const FLAGS = ["todoEnabled", "calendarEnabled", "musicEnabled", "translationEnabled", "shelfEnabled", "screenshotEnabled", "agentStatusEnabled"] as const;
localStorage.setItem("fuyu-settings", JSON.stringify({ ...DEFAULT_SETTINGS, ...Object.fromEntries(FLAGS.map((flag) => [flag, true])) }));

const root = createRoot(document.getElementById("root")!);
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const element = <T extends HTMLElement>(selector: string) => {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
};
const click = (selector: string) => act(async () => { element<HTMLElement>(selector).click(); });
const listed = () => [...document.querySelectorAll<HTMLElement>(".settings-sidebar__item[data-category]")].map((item) => item.dataset.category!);
const active = () => document.querySelector<HTMLElement>(".settings-sidebar__item--active")?.dataset.category;
const tabs = () => [...document.querySelectorAll<HTMLElement>(".settings-tabs__tab")].map((tab) => tab.dataset.tab!);
const openPage = async (page: SettingsCategory) => {
  await click(`.settings-sidebar__item[data-category='${sidebarItemOf(page)}']`);
  if (entryOf(page)) await click(`.settings-tabs__tab[data-tab='${page}']`);
  await wait(40);
};
const overviewSwitch = (feature: string) => `.settings-overview__feature[data-feature='${feature}'] input[role='switch']`;
const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
const pluginOn = (id: string) => mockBuiltinPlugins().find((plugin) => plugin.id === id)?.enabled;
const search = () => element<HTMLInputElement>(".settings-sidebar__search input");
const type = async (value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => { setter.call(search(), value); search().dispatchEvent(new Event("input", { bubbles: true })); });
};
const offPage = (feature: string) => document.querySelector(`.feature-off[data-feature='${feature}']`);

try {
  await act(async () => { root.render(<StrictMode><I18nProvider><SettingsWindow /></I18nProvider></StrictMode>); });
  await wait(60);

  const withSwitch: string[] = [];
  for (const item of new Set(Object.values(FEATURE_PAGES).flat().map(sidebarItemOf))) {
    await click(`.settings-sidebar__item[data-category='${item}']`);
    for (const tab of tabs().length ? tabs() : [item]) {
      if (tab !== item) await click(`.settings-tabs__tab[data-tab='${tab}']`);
      await wait(40);
      if (document.querySelector(".feature-header input, .feature-off")) withSwitch.push(tab);
    }
  }
  check(withSwitch.length === 0, `No feature page has an on/off switch in its header${withSwitch.length ? ` (${withSwitch.join(", ")})` : ""}`);
  for (const page of ["todos", "calendar", "music", "translation", "clipboard", "shelf", "screenshot", "voiceInput"] as const) {
    await openPage(page);
    check(document.querySelector(".feature-header") && !document.querySelector(".feature-header--off"), `The ${page} page starts with its feature header`);
  }
  await openPage("agents");
  check(!document.querySelector(".feature-off") && !document.querySelector(".feature-header--off"), "The agents page starts enabled");

  await openPage("overview");
  await click(overviewSwitch("todos"));
  check(pluginOn("todos") === false && stored().todoEnabled === true && !listed().includes("todos"), "Turning todos off in the overview switches the built-in plugin off without mirroring to fuyu-settings and leaves it out of the sidebar");

  await act(async () => {
    requestSettingsFocus("savePath");
    window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_FOCUS_STORAGE_KEY, newValue: localStorage.getItem(SETTINGS_FOCUS_STORAGE_KEY) }));
  });
  await wait(40);
  check(active() === "todos" && offPage("todos") && document.querySelector(".feature-header--off"), "A link from the island to a feature that is off opens its page as the off page");
  check(!document.querySelector(".editor-panel .settings-group__card"), "The off page shows none of the feature's settings");
  check(Boolean(document.querySelector(".feature-off__enable")) && element(".feature-off").textContent!.includes("概览"), "The off page offers direct enable and a link to the overview");
  await click(".feature-off__enable");
  await wait(40);
  check(pluginOn("todos") === true && !offPage("todos") && Boolean(document.querySelector(".editor-panel .settings-group__card")), "Enable right on the off page turns the feature on and reveals its settings");
  await openPage("overview");
  await click(overviewSwitch("todos"));
  await act(async () => {
    requestSettingsFocus("savePath");
    window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_FOCUS_STORAGE_KEY, newValue: localStorage.getItem(SETTINGS_FOCUS_STORAGE_KEY) }));
  });
  await wait(40);
  await click(".feature-off__actions .settings-link-button");
  check(active() === "overview" && document.querySelector(overviewSwitch("todos")), "Go to overview opens the overview");

  await click(overviewSwitch("agents"));
  check(pluginOn("agents") === false && !listed().includes("agents"), "Turning AI Agent off leaves it out of the sidebar");
  await type("音效");
  await click(".settings-sidebar__hit--tab[data-tab='sounds']");
  await wait(40);
  check(offPage("agents") && tabs().length === 3, "Search opens a tab of a feature that is off as the off page, with its tabs still shown");
  await click(".settings-tabs__tab[data-tab='agentPush']");
  check(offPage("agents"), "Every tab of a feature that is off is the off page");

  await type("");
  await openPage("overview");
  await click(overviewSwitch("voiceInput"));
  const voice = () => JSON.parse(localStorage.getItem("fuyu-voice-input") ?? "{}") as Record<string, unknown>;
  check(pluginOn("voice-input") === false && voice().enabled === false && typeof voice().shortcut === "string" && !listed().includes("voiceInput"), "Voice input keeps its own setting: turning it off in the overview keeps its shortcut and leaves it out of the sidebar");
  await click(overviewSwitch("voiceInput"));
  check(pluginOn("voice-input") === true && voice().enabled === true && listed().includes("voiceInput"), "Turning voice input back on lists it again");
  await click(overviewSwitch("agents"));
  await click(overviewSwitch("todos"));
  check(pluginOn("agents") === true && pluginOn("todos") === true && listed().includes("agents") && listed().includes("todos"), "Turning them back on lists them again");
  await openPage("sounds");
  check(!document.querySelector(".feature-off") && document.querySelector(".editor-panel .settings-group__card"), "A feature turned back on shows its settings again");
  await openPage("generalApi");
  await click(".settings-group__header input[role='switch']");
  await wait(40);
  check(pluginOn("local-api") === false && active() === "generalApi" && tabs().length === 0 && Boolean(document.querySelector(".editor-panel input[role='switch']")), "Turning local-api off keeps its own page open, with an enable switch");
  await openPage("general");
  check(listed().includes("generalApi") && !tabs().includes("generalApi") && !document.querySelector(".settings-sidebar__more"), "Local API stays in the sidebar while it is off: the menu item does not follow the switch, and it is not a tab of General");
  await openPage("generalApi");
  check([...document.querySelectorAll(".editor-panel .settings-group__title")].map((title) => title.textContent).join() === "本机接口" && !document.querySelector(".local-api-example"), "While it is off the page shows only the card with the switch");
  await click(".editor-panel input[role='switch']");
  await wait(40);
  check(pluginOn("local-api") === true && Boolean(document.querySelector(".settings-group__header input[role='switch']")), "Turning local-api back on there restores its full settings");
  await openPage("todos");
  check(!document.querySelector(".feature-off") && document.querySelector(".feature-header") && !document.querySelector(".feature-header input"), "The todos page is back, still without a switch");

  document.getElementById("results")!.textContent = `${messages.join("\n")}\nALL PASS`;
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.getElementById("results")!.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  document.documentElement.dataset.testResult = "failed";
  console.error(error);
}
