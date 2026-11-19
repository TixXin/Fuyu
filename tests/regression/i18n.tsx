import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { IslandApp } from "../../src/windows/island/IslandApp";
import { TranslationWindow } from "../../src/windows/translation/TranslationWindow";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { I18nProvider, LOCALE_STORAGE_KEY, preloadI18n, TRANSLATIONS, useLocale } from "../../src/i18n";

const query = new URLSearchParams(location.search);
const automated = query.has("test");
const translation = query.has("translation");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
const restore = () => {
  for (const key of Object.keys(localStorage).filter(key => key.startsWith("fuyu-"))) {
    if (!original.has(key)) localStorage.removeItem(key);
  }
  for (const [key, value] of original) localStorage.setItem(key, value);
};
window.addEventListener("beforeunload", restore);

const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
if (!translation) {
  if (automated || localStorage.getItem(LOCALE_STORAGE_KEY) === null) localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
  localStorage.setItem("fuyu-current-date", date);
  localStorage.setItem("fuyu-todos", JSON.stringify([{ id: "i18n-task", title: "保留用户任务 Привет", completed: false, createdAt: now.getTime() }]));
  localStorage.setItem("fuyu-daily-note", "用户的中文笔记");
  localStorage.setItem("fuyu-archives", JSON.stringify([{ date: "2026-10-21", todos: [], dailyNote: "历史笔记", savedAt: now.getTime(), savedToDisk: false }]));
  localStorage.setItem("fuyu-save-directory", "");
  localStorage.setItem("fuyu-qq-notification-access-requested", "true");
}
let revision = 0;
let reads = 0;
let clipboardText = "用户复制的文本";
let v2MigrationIslandPending = false;
const commands: string[] = [];
mockIPC((command, payload) => {
  commands.push(command);
  const args = (payload ?? {}) as Record<string, unknown>;
  switch (command) {
    case "get_launch_at_startup": return false;
    case "get_default_todo_save_directory": return "";
    case "get_clipboard_history": return { settings: { enabled: true, captureImages: true, maxItems: 100, shortcut: "Ctrl+X", shortcutEnabled: true }, items: [] };
    case "list_agent_sessions": return [];
    case "get_agent_status": return { codex: { phase: "idle", updatedAt: 0 }, claudeCode: { phase: "idle", updatedAt: 0 }, updatedAt: 0, statusPath: "" };
    case "get_media_state": return { available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable", title: null, artist: null, album: null, thumbnail: null, positionMs: 0, durationMs: 0, canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false, repeatMode: "unknown", canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null, sessions: [], updatedAt: 0 };
    case "get_audio_level": return { active: false, peak: 0, updatedAt: 0 };
    case "get_foreground_fullscreen": return { active: false, onIslandMonitor: false };
    case "set_island_interaction": return "disabled";
    case "get_qq_notification_state": return { revision: ++revision, enabled: true, status: "listening", items: [], error: null };
    case "set_wechat_expose_ui": case "set_wechat_hide_taskbar_button": return { revision: ++revision, enabled: true, status: "listening", pending: false, lastAttentionAt: null, error: null };
    case "get_qq_mail_state": return [{ revision: ++revision, email: "test@qq.com", configured: true, enabled: true, syncing: false, status: "connected", unreadCount: 1, items: [{ id: "mail:1", uid: 1, sender: "原始发件人", subject: "保留邮件主题", receivedAt: now.getTime(), unread: true }], lastSyncedAt: now.getTime(), error: null }];
    case "read_qq_mail": ++reads; return { id: args.messageId, content: "<script>removed</script>", contentType: "text/html" };
    case "has_translation_secret": return false;
    case "set_translation_shortcut": return args.shortcut;
    case "read_translation_clipboard": return clipboardText;
    case "get_v2_plugin_migration": return {
      official: [{ v2Id: "dev.focusd.weather", v3Id: "@fuyu/weather", title: { "zh-CN": "天气", en: "Weather" }, enabledInV2: true, configMigrated: true, installedInV3: false, registeredInYml: false }],
      other: [],
      islandPending: v2MigrationIslandPending,
      settingsPending: false,
    };
    case "plugin:window|is_visible": return true;
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows(translation ? "translation" : "main");

let changeLocale: ReturnType<typeof useLocale>["setLocale"];
let toggleExtraUi: (next: { settings: boolean }) => void;
function Fixture() {
  const { setLocale } = useLocale();
  const [extra, setExtra] = useState({ settings: !automated });
  toggleExtraUi = setExtra;
  changeLocale = setLocale;
  return translation ? (
    <TranslationWindow />
  ) : (
    <>
      <IslandApp />
      {extra.settings && <SettingsWindow />}
    </>
  );
}
let root: ReturnType<typeof createRoot> | null = null;
const mount = () => {
  root ??= createRoot(document.getElementById("root")!);
  root.render(<StrictMode><I18nProvider><Fixture /></I18nProvider></StrictMode>);
};
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const click = async (selector: string) => {
  const element = document.querySelector<HTMLButtonElement>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  await act(async () => { element.click(); });
};
const LANGUAGE_TRIGGER = [TRANSLATIONS["zh-CN"], TRANSLATIONS.en]
  .map((text) => `.settings-select .select-control__trigger[aria-label='${text.settings.language.label}']`)
  .join(", ");
const switchTo = async (locale: string) => {
  await click(LANGUAGE_TRIGGER);
  const menu = document.querySelector(LANGUAGE_TRIGGER)?.closest(".select-control");
  const option = menu?.querySelector<HTMLElement>(`.select-control__option[data-value='${locale}']`);
  if (!option) throw new Error(`Missing language option ${locale}`);
  await act(async () => {
    option.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
};

if (!automated) mount();
else {
  try {
    await preloadI18n("zh-CN", null);
    v2MigrationIslandPending = true;
    await act(async () => { mount(); });
    await act(async () => { toggleExtraUi({ settings: false }); await new Promise((resolve) => setTimeout(resolve, 40)); });
    check(document.querySelector(".island") !== null, "Main island mounts with only core and onboarding i18n slices");
    check(document.querySelector(".first-hint__text")?.textContent?.includes("检测到 1 个旧版插件") === true, "Island old-plugin migration notice renders without settings slice");
    await click(".first-hint__action:last-child");
    v2MigrationIslandPending = false;
    await preloadI18n("zh-CN", "settings");
    await act(async () => { toggleExtraUi({ settings: true }); });
    await click(".island__open-button");
    check(document.querySelector(LANGUAGE_TRIGGER)?.getAttribute("aria-label") === "界面语言", "Chinese language control is reachable");
    const dataKeys = ["fuyu-todos", "fuyu-daily-note", "fuyu-archives", "fuyu-settings", "fuyu-setting-presets"];
    const dataBefore = dataKeys.map(key => localStorage.getItem(key));
    const subscriptionsBefore = commands.filter(command => command === "get_qq_notification_state" || command === "set_wechat_expose_ui").length;
    await switchTo("en");
    check(document.documentElement.lang === "en" && localStorage.getItem(LOCALE_STORAGE_KEY) === "en", "Language changes immediately and persists");
    check(document.querySelector(".settings-sidebar")?.textContent?.includes("Appearance"), "Settings categories are translated");
    await click(".settings-sidebar__item[data-category='appearance']");
    await click(".settings-tabs__tab[data-tab='appearance']");
    check(document.querySelector(".editor-panel")?.textContent?.includes("Collapsed island scale"), "Current scale and font settings are translated");
    await click(".settings-sidebar__item[data-category='general']");
    check(dataKeys.every((key, index) => localStorage.getItem(key) === dataBefore[index]), "Switching keeps tasks, notes, settings, and custom presets unchanged");
    check(commands.filter(command => command === "get_qq_notification_state" || command === "set_wechat_expose_ui").length === subscriptionsBefore, "Switching does not reconnect notification receivers");
    await act(async () => { changeLocale!("constructor" as "en"); });
    check(document.documentElement.lang === "en", "Invalid locale cannot break the mounted interface");
    await click(".dot-button--todo");
    check(document.querySelector(".todo-island-row__title")?.textContent?.includes("保留用户任务 Привет"), "User task content stays as written");
    const archiveTab = [...document.querySelectorAll<HTMLButtonElement>(".todo-island__tab")].find((tab) => tab.textContent === "Archive");
    await act(async () => { archiveTab?.click(); await new Promise((resolve) => setTimeout(resolve, 40)); });
    check(document.querySelector(".todo-island__archive-preview")?.textContent === "No tasks were written down", "Archive empty states follow the selected language");
    check(document.querySelectorAll("[title]").length === 0, "No hover tooltips on the island");
    await click("button.island-message-button[aria-label^='Messages']");
    check(document.querySelector(".qq-panel__empty")?.textContent?.includes("No messages"), "QQ panel uses English copy");
    await click(".message-sources button[aria-label='WeChat reminders']");
    check(document.querySelector(".qq-panel__empty")?.textContent?.includes("No reminders"), "WeChat panel uses English copy");
    await click(".message-sources button[aria-label='Mail']");
    check(document.querySelector(".qq-mail-list")?.textContent?.includes("保留邮件主题"), "Mail subjects stay as written");
    await click("button[data-mail-id='mail:1']");
    check(document.querySelector(".qq-mail-body")?.textContent?.includes("No text to display"), "Sanitized empty HTML mail has a translated fallback");
    await switchTo("zh-CN");
    check(document.documentElement.lang === "zh-CN" && reads === 1, "Switching back keeps mail requests stable");
    await act(async () => { localStorage.setItem(LOCALE_STORAGE_KEY, "en"); window.dispatchEvent(new StorageEvent("storage", { key: LOCALE_STORAGE_KEY, newValue: "en", storageArea: localStorage })); });
    check(document.documentElement.lang === "en", "The provider accepts language changes from another window");
    await act(async () => { root?.unmount(); });
    clipboardText = "";
    const translationRoot = createRoot(document.getElementById("root")!);
    await act(async () => { translationRoot.render(<I18nProvider><TranslationWindow /></I18nProvider>); });
    check(document.querySelector("h1")?.textContent === "Quick translation", "A fresh translation window loads the persisted language");
    await click(".translation-window__translate");
    check(document.querySelector("[role='alert']")?.textContent?.includes("Enter source text"), "Translation validation follows the interface language");
    await act(async () => { translationRoot.unmount(); });
    document.documentElement.dataset.testResult = "passed";
  } catch (error) {
    document.documentElement.dataset.testResult = "failed";
    messages.push(`FAIL ${String(error)}`);
    console.error(error);
  } finally {
    restore();
    document.getElementById("results")!.textContent = messages.join("\n");
  }
}
