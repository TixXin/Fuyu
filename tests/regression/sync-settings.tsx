import { act, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS, useLocale, type LocaleCode } from "../../src/i18n";
import { installSyncSettingsMocks, NEXT_PICKED_FOLDER } from "./syncSettingsMocks";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

const harness = installSyncSettingsMocks();
const { calls } = harness;

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

  const encGroupInitial = groupByTitle(wide, zh.encryption.groupTitle)!;
  const openEncInitialBtn = [...encGroupInitial.querySelectorAll<HTMLButtonElement>("button")].find(
    (btn) => btn.textContent?.includes(zh.encryption.openEnableAction),
  )!;
  check(
    Boolean(encGroupInitial)
      && encGroupInitial.textContent?.includes(zh.encryption.badges.off)
      && openEncInitialBtn.disabled,
    "End-to-end encryption starts off by default and requires an active backend before enabling",
  );

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
  check(optSwitches.length === 7 && optSwitches.every((input) => !input.checked) && optDescs.every((desc) => desc.startsWith("默认关闭：")),
    "All seven optional sync groups start off and explain why");

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

  harness.setWebdavTestError({ code: "sync.webdavAuth", message: "The WebDAV username or app password was rejected." });
  const testBtn = [...wide.querySelectorAll<HTMLButtonElement>(".sync-status__button")].find((btn) => btn.textContent?.includes(zh.backend.webdav.testAction))!;
  await act(async () => { testBtn.click(); });
  await settle();
  check(wide.textContent?.includes("第三方应用密码"), "Wrong WebDAV password surfaces localized app-password guidance");

  harness.setWebdavTestError(null);
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
    await harness.emitStatus({
      phase: "folderMissing",
      error: { code: "sync.webdavRateLimited", message: "Rate limited" },
    });
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
  check(wide.querySelector(".sync-folder-path")?.textContent === NEXT_PICKED_FOLDER && wide.textContent?.includes(zh.status.phases.idle.headline),
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
    const cur = harness.getStatus();
    await harness.emitStatus({
      phase: "needsConfirm",
      confirm: { reason: "manyDeletions", category: "todos", removed: 18, total: 20 },
      categories: cur.categories.map((entry) => (entry.category === "todos" ? { ...entry, state: "needsConfirm" } : entry)),
    });
  });
  await settle();
  const confirmDialog = wide.querySelector<HTMLElement>(".sync-confirm[role='alertdialog']");
  check(Boolean(confirmDialog) && confirmDialog?.textContent?.includes("18 / 20"), "A mass-deletion safety brake shows an alertdialog naming the counts");

  const approveBtn = confirmDialog!.querySelector<HTMLButtonElement>(".sync-status__button--primary")!;
  await act(async () => { approveBtn.click(); });
  await settle();
  check(calls.some((call) => call.command === "confirm_sync_deletions") && !wide.querySelector(".sync-confirm"),
    "Confirming deletions calls confirm_sync_deletions and clears the brake");

  const encGroup = groupByTitle(wide, zh.encryption.groupTitle)!;
  const openEncBtn = [...encGroup.querySelectorAll<HTMLButtonElement>("button")].find(
    (btn) => btn.textContent?.includes(zh.encryption.openEnableAction),
  )!;
  await act(async () => { openEncBtn.click(); });
  await settle();
  check(
    encGroup.textContent?.includes(zh.encryption.warningTitle)
      && encGroup.textContent?.includes("找不回来"),
    "Opening E2EE setup prominently warns that forgotten passphrases cannot be recovered",
  );

  const encPassInput = encGroup.querySelector<HTMLInputElement>("#sync-enc-passphrase")!;
  const encConfirmInput = encGroup.querySelector<HTMLInputElement>("#sync-enc-confirm")!;
  await act(async () => {
    setInputValue(encPassInput, "correct-horse-battery");
    setInputValue(encConfirmInput, "mismatch-value");
  });
  await settle();
  check(encGroup.textContent?.includes(zh.encryption.passphraseMismatch), "Mismatched E2EE passphrases show an immediate alert");

  await act(async () => { setInputValue(encConfirmInput, "correct-horse-battery"); });
  await settle();
  const enableSubmitBtn = [...encGroup.querySelectorAll<HTMLButtonElement>(".sync-status__button--primary")].find(
    (btn) => btn.textContent?.includes(zh.encryption.enableSubmitAction),
  )!;
  await act(async () => { enableSubmitBtn.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "enable_sync_encryption")
      && encGroup.textContent?.includes(zh.encryption.badges.unlocked)
      && encGroup.textContent?.includes("9f8e7d6c5b4a"),
    "Enabling E2EE migrates remote data and shows unlocked status with key ID",
  );

  const copyRkBtn = [...encGroup.querySelectorAll<HTMLButtonElement>("button")].find(
    (btn) => btn.textContent?.includes(zh.encryption.copyRecoveryAction),
  )!;
  await act(async () => { copyRkBtn.click(); });
  await settle();
  const saveRkBtn = [...encGroup.querySelectorAll<HTMLButtonElement>("button")].find(
    (btn) => btn.textContent?.includes(zh.encryption.saveRecoveryAction),
  )!;
  await act(async () => { saveRkBtn.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "copy_sync_recovery_key")
      && calls.some((call) => call.command === "save_sync_recovery_key")
      && encGroup.textContent?.includes("fuyu-sync-recovery-key-2026-11-17-2240.txt"),
    "Recovery key can be copied concealed or saved to Downloads without exposing plaintext to JS",
  );

  await act(async () => {
    await harness.emitStatus({
      phase: "locked",
      encryption: { state: "locked", hasLocalKey: false, keyId: "9f8e7d6c5b4a" },
    });
  });
  await settle();
  check(
    wide.textContent?.includes(zh.status.phases.locked.headline)
      && encGroup.textContent?.includes(zh.encryption.badges.locked),
    "Locked remote store shows locked phase and prompts for passphrase or recovery key",
  );

  const unlockInput = encGroup.querySelector<HTMLInputElement>("#sync-enc-unlock")!;
  const unlockBtn = [...encGroup.querySelectorAll<HTMLButtonElement>(".sync-status__button--primary")].find(
    (btn) => btn.textContent?.includes(zh.encryption.unlockSubmitAction),
  )!;
  await act(async () => { setInputValue(unlockInput, "wrong-passphrase"); });
  await settle();
  await act(async () => { unlockBtn.click(); });
  await settle();
  check(encGroup.textContent?.includes("同步口令或恢复密钥不正确"), "Wrong passphrase shows localized sync.badPassphrase error");

  await act(async () => { setInputValue(unlockInput, "FUYU-ABCDEFG-HJKLMPQ-RSTUVWX-YZ23456-789ABCD-EFGHJKL-MNPQRST-UVWXYZ2"); });
  await settle();
  await act(async () => { unlockBtn.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "unlock_sync_encryption")
      && encGroup.textContent?.includes(zh.encryption.badges.unlocked),
    "Entering a recovery key unlocks E2EE on this computer",
  );

  await act(async () => { switchLocale("en"); });
  await settle();
  check(
    wide.textContent?.includes(en.optional.groupTitle)
      && wide.textContent?.includes("Off by default:")
      && wide.textContent?.includes(en.encryption.groupTitle)
      && wide.textContent?.includes(en.help.items.nutstoreWebdav.title),
    "Switching to English translates all sections, encryption controls, WebDAV guides and optional hints",
  );
  await act(async () => { switchLocale("zh-CN"); });
  await settle();

  await act(async () => {
    await harness.emitStatus({});
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
