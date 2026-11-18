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
import { DEFAULT_ENABLED_CATEGORIES, SYNC_CATEGORY_ITEMS } from "../../src/features/sync/syncState";

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
  backend: "off",
  folder: null,
  webdav: null,
  deviceId: "mac-studio-01",
  lastSyncAt: null,
  lastError: null,
  error: null,
  confirm: null,
  categories: SYNC_CATEGORY_ITEMS.map((category) => ({
    category,
    state: DEFAULT_ENABLED_CATEGORIES.includes(category) ? "waiting" : "off",
    message: null,
    lastSyncAt: null,
  })),
  optionalGroups: [],
  devices: [],
  skippedFiles: [],
};

const calls: { command: string; args: Record<string, unknown> }[] = [];
const nextPickedFolder = "/Users/demo/iCloud/FuyuSync";
let nextWebdavTestError: unknown = null;

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
        backend: folder ? "folder" : "off",
        folder,
        phase: folder ? "idle" : "off",
        lastSyncAt: folder ? LAST_SYNC : null,
        error: null,
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
    case "test_sync_webdav": {
      if (nextWebdavTestError !== null) {
        throw nextWebdavTestError;
      }
      return null;
    }
    case "set_sync_webdav": {
      const url = String(args.url ?? "").trim();
      const username = String(args.username ?? "").trim();
      const categories = (args.categories as SyncCategory[]) ?? [];
      const optionalGroups = (args.optionalGroups as OptionalSyncGroup[]) ?? [];
      currentStatus = {
        ...currentStatus,
        backend: "webdav",
        phase: "idle",
        lastSyncAt: LAST_SYNC,
        lastError: null,
        error: null,
        webdav: { url: url.endsWith("/") ? url : `${url}/`, username, hasPassword: true },
        optionalGroups,
        categories: SYNC_CATEGORY_ITEMS.map((category) => ({
          category,
          state: categories.includes(category) ? "ok" : "off",
          message: null,
          lastSyncAt: categories.includes(category) ? LAST_SYNC : null,
        })),
        devices: [
          { deviceId: "mac-studio-01", name: "MacBook Air", platform: "macos", appVersion: "0.3.11", lastSyncAt: LAST_SYNC, thisDevice: true },
          { deviceId: "win-desk-02", name: "Office-PC", platform: "windows", appVersion: "0.3.9", lastSyncAt: OLD_DEVICE_SYNC, thisDevice: false },
        ],
      };
      return structuredClone(currentStatus);
    }
    case "stop_sync": {
      const forget = Boolean(args.forgetWebdav);
      currentStatus = {
        ...currentStatus,
        backend: "off",
        phase: "off",
        lastError: null,
        error: null,
        webdav: forget ? null : currentStatus.webdav,
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

const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
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
  check(
    catSwitches.length === 6
      && catSwitches.slice(0, 5).every((input) => input.checked)
      && !catSwitches[5].checked
      && wide.textContent?.includes(zh.categories.items.clipFavorites.title),
    "Five primary sync categories start enabled while clipboard favorites starts off",
  );

  const optGroup = groupByTitle(wide, zh.optional.groupTitle)!;
  const optSwitches = [...optGroup.querySelectorAll<HTMLInputElement>("input[role='switch']")];
  const optDescs = [...optGroup.querySelectorAll<HTMLElement>(".settings-row__description")].map((el) => el.textContent ?? "");
  check(optSwitches.length === 8 && optSwitches.every((input) => !input.checked) && optDescs.every((desc) => desc.startsWith("默认关闭：")),
    "All eight optional sync groups start off and explain why");

  const webdavChoice = [...wide.querySelectorAll<HTMLButtonElement>(".settings-choice__option")].find((btn) => btn.textContent === zh.backend.methods.webdav)!;
  await act(async () => { webdavChoice.click(); });
  await settle();

  const urlInput = wide.querySelector<HTMLInputElement>("#sync-webdav-url")!;
  const userInput = wide.querySelector<HTMLInputElement>("#sync-webdav-username")!;
  const passInput = wide.querySelector<HTMLInputElement>("#sync-webdav-password")!;
  await act(async () => {
    setInputValue(urlInput, "https://dav.jianguoyun.com/dav/我的坚果云");
    setInputValue(userInput, "alice@example.com");
    setInputValue(passInput, "app-secret-123");
  });
  await settle();

  nextWebdavTestError = { code: "sync.webdavAuth", message: "The WebDAV username or app password was rejected." };
  const testBtn = [...wide.querySelectorAll<HTMLButtonElement>(".sync-status__button")].find((btn) => btn.textContent?.includes(zh.backend.webdav.testAction))!;
  await act(async () => { testBtn.click(); });
  await settle();
  check(wide.textContent?.includes("第三方应用密码"), "Wrong WebDAV password surfaces localized app-password guidance");

  nextWebdavTestError = null;
  await act(async () => { testBtn.click(); });
  await settle();
  check(wide.textContent?.includes(zh.backend.webdav.testOk), "Test connection shows confirmation when WebDAV folder is reachable");

  const narrowWebdavChoice = [...narrow.querySelectorAll<HTMLButtonElement>(".settings-choice__option")].find((btn) => btn.textContent === zh.backend.methods.webdav)!;
  await act(async () => { narrowWebdavChoice.click(); });
  await settle();
  const narrowWebdavOverflow = [...narrow.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "hidden" && el.clientWidth > 0,
  );
  check(narrowWebdavOverflow.length === 0 && narrow.scrollWidth <= 340, "WebDAV form fits cleanly inside a 340px narrow container");

  const saveWebdavBtn = [...wide.querySelectorAll<HTMLButtonElement>(".sync-status__button--primary")].find((btn) => btn.textContent?.includes(zh.backend.webdav.saveAction))!;
  await act(async () => { saveWebdavBtn.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "set_sync_webdav")
      && passInput.value === ""
      && wide.textContent?.includes(zh.backend.webdav.activeBadge),
    "Saving WebDAV enables sync and clears plaintext password from the input",
  );

  await act(async () => {
    currentStatus = {
      ...currentStatus,
      phase: "folderMissing",
      error: { code: "sync.webdavRateLimited", message: "Rate limited" },
    };
    await emit(SYNC_STATUS_EVENT, structuredClone(currentStatus));
  });
  await settle();
  check(
    wide.textContent?.includes(zh.status.webdavUnavailable.headline) && wide.textContent?.includes("600"),
    "Rate-limited or offline WebDAV rounds show WebDAV-specific status and rate-limit hint",
  );

  const folderChoice = [...wide.querySelectorAll<HTMLButtonElement>(".settings-choice__option")].find((btn) => btn.textContent === zh.backend.methods.folder)!;
  const narrowFolderChoice = [...narrow.querySelectorAll<HTMLButtonElement>(".settings-choice__option")].find((btn) => btn.textContent === zh.backend.methods.folder)!;
  await act(async () => {
    folderChoice.click();
    narrowFolderChoice.click();
  });
  await settle();

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
  check(
    wide.textContent?.includes(en.optional.groupTitle)
      && wide.textContent?.includes("Off by default:")
      && wide.textContent?.includes(en.help.items.nutstoreWebdav.title),
    "Switching to English translates all sections, WebDAV guides and optional hints",
  );
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
