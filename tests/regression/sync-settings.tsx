import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import { act, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS, useLocale, type LocaleCode } from "../../src/i18n";
import { SYNC_STATUS_EVENT, type OptionalSyncGroup, type SyncCategory, type SyncStatus } from "../../src/features/sync/api";
import { SYNC_CATEGORY_ITEMS } from "../../src/features/sync/syncState";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

const LAST_SYNC = Date.UTC(2026, 10, 15, 1, 30);
const OLD_DEVICE_SYNC = Date.UTC(2026, 1, 1, 0, 0);

let currentStatus: SyncStatus = {
  phase: "off",
  folder: null,
  deviceId: "mac-studio-01",
  lastSyncAt: null,
  lastError: null,
  confirm: null,
  categories: SYNC_CATEGORY_ITEMS.map((category) => ({
    category,
    state: "waiting",
    message: null,
    lastSyncAt: null,
  })),
  optionalGroups: [],
  devices: [],
  skippedFiles: [],
};

const calls: { command: string; args: Record<string, unknown> }[] = [];
let nextPickedFolder: string | null = "/Users/demo/iCloud/FuyuSync";

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, args });
  switch (command) {
    case "get_sync_status":
      return structuredClone(currentStatus);
    case "plugin:dialog|open":
      return nextPickedFolder;
    case "plugin:opener|reveal_item_in_dir":
      return null;
    case "set_sync_config": {
      const folder = (args.folder as string | null) ?? null;
      const categories = (args.categories as SyncCategory[]) ?? [];
      const optionalGroups = (args.optionalGroups as OptionalSyncGroup[]) ?? [];
      currentStatus = {
        ...currentStatus,
        folder,
        phase: folder ? "idle" : "off",
        lastSyncAt: folder ? LAST_SYNC : null,
        optionalGroups,
        categories: SYNC_CATEGORY_ITEMS.map((category) => ({
          category,
          state: categories.includes(category) ? (folder ? "ok" : "waiting") : "off",
          message: null,
          lastSyncAt: folder && categories.includes(category) ? LAST_SYNC : null,
        })),
        devices: folder
          ? [
              { deviceId: "mac-studio-01", name: "MacBook Air", platform: "macos", appVersion: "0.3.11", lastSyncAt: LAST_SYNC, thisDevice: true },
              { deviceId: "win-desk-02", name: "Office-PC", platform: "windows", appVersion: "0.3.9", lastSyncAt: OLD_DEVICE_SYNC, thisDevice: false },
            ]
          : [],
      };
      return structuredClone(currentStatus);
    }
    case "sync_now":
      return null;
    case "confirm_sync_deletions": {
      currentStatus = {
        ...currentStatus,
        phase: "idle",
        confirm: null,
        categories: currentStatus.categories.map((entry) => (
          entry.state === "needsConfirm" ? { ...entry, state: "ok", lastSyncAt: LAST_SYNC } : entry
        )),
      };
      void emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
      return null;
    }
    default:
      return null;
  }
}, { shouldMockEvents: true });

const { SyncSettingsPage } = await import("../../src/windows/settings/SyncSettingsPage");

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const wide = document.getElementById("wide")!;
const narrow = document.getElementById("narrow")!;

let switchLocale: (locale: LocaleCode) => void = () => {};
function LocaleDriver() {
  const { setLocale } = useLocale();
  useEffect(() => { switchLocale = setLocale; }, [setLocale]);
  return null;
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
};

const groupByTitle = (root: HTMLElement, title: string) =>
  [...root.querySelectorAll<HTMLElement>(".settings-group")].find((group) => group.querySelector(".settings-group__title")?.textContent === title);

try {
  await act(async () => {
    createRoot(wide).render(
      <StrictMode><I18nProvider><LocaleDriver /><SyncSettingsPage /></I18nProvider></StrictMode>,
    );
    createRoot(narrow).render(
      <StrictMode><I18nProvider><SyncSettingsPage /></I18nProvider></StrictMode>,
    );
  });
  await settle();

  const zh = TRANSLATIONS["zh-CN"].sync;
  const en = TRANSLATIONS.en.sync;

  check(wide.textContent?.includes(zh.status.phases.off.headline) && wide.textContent?.includes(zh.backend.folderUnset), "Sync starts off without a pre-filled folder");

  const catGroup = groupByTitle(wide, zh.categories.groupTitle)!;
  const catSwitches = [...catGroup.querySelectorAll<HTMLInputElement>("input[role='switch']")];
  check(catSwitches.length === 5 && catSwitches.every((input) => input.checked), "All five primary sync categories start enabled");

  const optGroup = groupByTitle(wide, zh.optional.groupTitle)!;
  const optSwitches = [...optGroup.querySelectorAll<HTMLInputElement>("input[role='switch']")];
  const optDescs = [...optGroup.querySelectorAll<HTMLElement>(".settings-row__description")].map((el) => el.textContent ?? "");
  check(optSwitches.length === 8 && optSwitches.every((input) => !input.checked) && optDescs.every((desc) => desc.startsWith("默认关闭：")),
    "All eight optional sync groups start off and explain why");

  const chooseBtn = [...wide.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((btn) => btn.textContent === zh.backend.chooseFolder)!;
  await act(async () => { chooseBtn.click(); });
  await settle();
  check(wide.querySelector(".sync-folder-path")?.textContent === nextPickedFolder && wide.textContent?.includes(zh.status.phases.idle.headline),
    "Picking a folder saves it and switches status to ready");

  check(wide.textContent?.includes("MacBook Air") && wide.textContent?.includes(zh.devices.thisDevice) && wide.textContent?.includes(zh.devices.stale),
    "Synced devices show this computer and flag devices inactive over 180 days");

  const revealBtn = [...wide.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((btn) => btn.textContent === zh.backend.revealFolder)!;
  await act(async () => { revealBtn.click(); });
  check(calls.some((call) => call.command === "plugin:opener|reveal_item_in_dir"), "Show in folder reveals the chosen sync directory");

  const syncNowBtn = wide.querySelector<HTMLButtonElement>(".sync-status__button")!;
  await act(async () => { syncNowBtn.click(); });
  check(calls.some((call) => call.command === "sync_now"), "Sync now triggers an immediate round");

  await act(async () => { optSwitches[0].click(); });
  await settle();
  const lastConfigCall = [...calls].reverse().find((call) => call.command === "set_sync_config");
  check(JSON.stringify(lastConfigCall?.args.optionalGroups) === JSON.stringify(["translationProvider"]), "Turning an optional group on sends its id to set_sync_config");

  await act(async () => {
    currentStatus = {
      ...currentStatus,
      phase: "needsConfirm",
      confirm: { reason: "manyDeletions", category: "todos", removed: 18, total: 20 },
      categories: currentStatus.categories.map((entry) => (entry.category === "todos" ? { ...entry, state: "needsConfirm" } : entry)),
    };
    await emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
  });
  await settle();
  const confirmDialog = wide.querySelector<HTMLElement>(".sync-confirm[role='alertdialog']");
  check(Boolean(confirmDialog) && confirmDialog?.textContent?.includes("18 / 20"), "A mass-deletion safety brake shows an alertdialog naming the counts");

  const approveBtn = confirmDialog!.querySelector<HTMLButtonElement>(".sync-status__button--primary")!;
  await act(async () => { approveBtn.click(); });
  await settle();
  check(calls.some((call) => call.command === "confirm_sync_deletions") && !wide.querySelector(".sync-confirm"),
    "Confirming deletions calls confirm_sync_deletions and clears the brake");

  await act(async () => { switchLocale("en"); });
  await settle();
  check(wide.textContent?.includes(en.optional.groupTitle) && wide.textContent?.includes("Off by default:"), "Switching to English translates all sections and optional hints");
  await act(async () => { switchLocale("zh-CN"); });
  await settle();

  await act(async () => {
    await emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
  });
  await settle();

  const narrowOverflow = [...narrow.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "hidden" && el.clientWidth > 0,
  );
  check(narrowOverflow.length === 0 && narrow.scrollWidth <= 340, "Nothing overflows horizontally in a 340px narrow container");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
  console.error(error);
}
