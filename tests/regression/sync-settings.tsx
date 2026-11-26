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
const { renderGuideFixture } = await import("./syncGuideFixture");

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

const overflowing = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("*")].filter(
  (el) => !(el instanceof HTMLInputElement) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "hidden" && el.clientWidth > 0,
);

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

  const guideSteps = [...wide.querySelectorAll<HTMLElement>(".sync-guide__step")];
  check(
    guideSteps.length === 3
      && guideSteps[0].classList.contains("sync-guide__step--done")
      && guideSteps[1].getAttribute("aria-current") === "step"
      && guideSteps[1].textContent?.includes(zh.guide.folderTitle)
      && wide.textContent?.includes(zh.guide.later),
    "Without a folder or WebDAV the page shows three setup steps with step 2 current",
  );
  check(
    !groupByTitle(wide, zh.categories.groupTitle)
      && !groupByTitle(wide, zh.optional.groupTitle)
      && !groupByTitle(wide, zh.devices.groupTitle)
      && !groupByTitle(wide, zh.encryption.groupTitle)
      && !wide.querySelector(".sync-status"),
    "Before setup, what to sync, optional sync, devices and the encryption group stay hidden",
  );

  const wantEncSwitch = guideSteps[2].querySelector<HTMLInputElement>("input[role='switch']")!;
  check(!wantEncSwitch.checked, "End-to-end encryption starts off in the setup guide");
  await act(async () => { wantEncSwitch.click(); });
  await settle();

  const webdavChoice = [...wide.querySelectorAll<HTMLButtonElement>(".settings-choice__option")].find((btn) => btn.textContent === zh.backend.methods.webdav)!;
  await act(async () => { webdavChoice.click(); });
  await settle();
  check(wide.querySelector(".sync-guide__step[aria-current='step']")?.textContent?.includes(zh.guide.webdavTitle), "Choosing WebDAV turns step 2 into the WebDAV form");

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
  check(overflowing(narrow).length === 0 && narrow.scrollWidth <= 340, "The WebDAV step of the guide fits cleanly inside a 340px narrow container");

  const saveWebdavBtn = [...wide.querySelectorAll<HTMLButtonElement>(".sync-status__button--primary")].find((btn) => btn.textContent?.includes(zh.backend.webdav.saveAction))!;
  await act(async () => { saveWebdavBtn.click(); });
  await settle();
  await act(async () => { await harness.emitStatus({}); });
  await settle();
  const facts = wide.querySelector(".sync-status__facts")?.textContent ?? "";
  check(
    calls.some((call) => call.command === "set_sync_webdav")
      && !wide.querySelector(".sync-guide")
      && wide.querySelector(".settings-group")?.querySelector(".sync-status")
      && facts.includes("https://dav.jianguoyun.com/dav/我的坚果云/")
      && facts.includes(zh.status.devices(2))
      && facts.includes(zh.status.notEncrypted),
    "Saving WebDAV leaves the guide and puts the status card first with address, device count and encryption",
  );

  const encGroup = groupByTitle(wide, zh.encryption.groupTitle)!;
  check(
    encGroup.textContent?.includes(zh.encryption.badges.off)
      && encGroup.textContent?.includes(zh.encryption.warningTitle)
      && encGroup.textContent?.includes("找不回来")
      && encGroup.querySelector("#sync-enc-passphrase"),
    "Turning encryption on in the guide opens the passphrase form, with the can't-recover warning, once sync is set up",
  );

  const catGroup = groupByTitle(wide, zh.categories.groupTitle)!;
  const tiles = [...catGroup.querySelectorAll<HTMLElement>(".sync-tile")];
  const tileBoxes = tiles.map((tile) => tile.querySelector<HTMLInputElement>("input[type='checkbox']")!);
  check(
    tiles.length === 6
      && tileBoxes.slice(0, 5).every((input) => input.checked)
      && !tileBoxes[5].checked
      && tiles[0].querySelector(".sync-badge")?.textContent === zh.categories.states.ok
      && tiles[0].querySelector("label")?.title === zh.categories.items.todos.description
      && tiles[0].querySelector(".sync-tile__hint")?.textContent === zh.categories.items.todos.hint,
    "What to sync is six checkbox tiles: five on, clipboard favorites off, with a badge, a one-line hint and the full description on hover",
  );
  check(getComputedStyle(catGroup.querySelector(".sync-tiles")!).gridTemplateColumns.split(" ").length === 2, "Tiles sit in two columns in a wide window");
  const narrowTiles = narrow.querySelector<HTMLElement>(".sync-tiles");
  check(narrowTiles && getComputedStyle(narrowTiles).gridTemplateColumns.split(" ").length === 1, "Tiles fall back to one column in a narrow window");

  const optGroup = groupByTitle(wide, zh.optional.groupTitle)!;
  const optFold = optGroup.querySelector<HTMLDetailsElement>("details.settings-advanced")!;
  const optSwitches = [...optGroup.querySelectorAll<HTMLInputElement>("input[role='switch']")];
  const optDescs = [...optGroup.querySelectorAll<HTMLElement>(".settings-row__description")].map((el) => el.textContent ?? "");
  check(
    !optFold.open
      && optFold.querySelector("summary")?.textContent === zh.optional.summary(0, 7)
      && optSwitches.length === 7
      && optSwitches.every((input) => !input.checked)
      && optDescs.every((desc) => desc.startsWith("默认关闭：")),
    "All seven optional groups start off, folded away under a count of how many are on",
  );

  const narrowManage = narrow.querySelector<HTMLButtonElement>(".sync-status__manage")!;
  await act(async () => { narrowManage.click(); });
  await settle();
  check(narrow.querySelector("#sync-webdav-url") && overflowing(narrow).length === 0 && narrow.scrollWidth <= 340, "The set-up page with Change… open fits cleanly inside a 340px narrow container");

  const manageBtn = wide.querySelector<HTMLButtonElement>(".sync-status__manage")!;
  check(manageBtn.getAttribute("aria-expanded") === "false" && !groupByTitle(wide, zh.backend.groupTitle), "The sync method stays folded behind Change… once set up");
  await act(async () => { manageBtn.click(); });
  await settle();
  const reopenedPass = wide.querySelector<HTMLInputElement>("#sync-webdav-password");
  check(
    manageBtn.getAttribute("aria-expanded") === "true"
      && wide.textContent?.includes(zh.backend.webdav.activeBadge)
      && reopenedPass?.value === "",
    "Change… opens the sync method with WebDAV marked in use and no plaintext password kept",
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
  check(
    wide.querySelector(".sync-folder-path")?.textContent === NEXT_PICKED_FOLDER
      && wide.textContent?.includes(zh.status.phases.idle.headline)
      && wide.querySelector(".sync-status__facts")?.textContent?.includes(NEXT_PICKED_FOLDER),
    "Picking a folder saves it, shows it on the status card and switches status to ready",
  );

  check(wide.textContent?.includes("MacBook Air") && wide.textContent?.includes(zh.devices.thisDevice) && wide.textContent?.includes(zh.devices.stale),
    "Synced devices show this computer and flag devices inactive over 180 days");

  const revealBtn = [...wide.querySelectorAll<HTMLButtonElement>(".settings-link-button")].find((btn) => btn.textContent === zh.backend.revealFolder)!;
  await act(async () => { revealBtn.click(); });
  check(calls.some((call) => call.command === "plugin:opener|reveal_item_in_dir"), "Show in folder reveals the chosen sync directory");

  const syncNowBtn = wide.querySelector<HTMLButtonElement>(".sync-status__button")!;
  await act(async () => { syncNowBtn.click(); });
  check(calls.some((call) => call.command === "sync_now"), "Sync now triggers an immediate round");

  const optSwitchesNow = [...groupByTitle(wide, zh.optional.groupTitle)!.querySelectorAll<HTMLInputElement>("input[role='switch']")];
  await act(async () => { optSwitchesNow[0].click(); });
  await settle();
  const lastConfigCall = [...calls].reverse().find((call) => call.command === "set_sync_config");
  check(
    JSON.stringify(lastConfigCall?.args.optionalGroups) === JSON.stringify(["translationProvider"])
      && groupByTitle(wide, zh.optional.groupTitle)?.querySelector("summary")?.textContent === zh.optional.summary(1, 7),
    "Turning an optional group on sends its id to set_sync_config and updates the folded count",
  );

  const tileBoxesNow = [...groupByTitle(wide, zh.categories.groupTitle)!.querySelectorAll<HTMLInputElement>(".sync-tile input[type='checkbox']")];
  await act(async () => { tileBoxesNow[5].click(); });
  await settle();
  const lastCategories = [...calls].reverse().find((call) => call.command === "set_sync_config")?.args.categories;
  check(
    JSON.stringify(lastCategories) === JSON.stringify(["todos", "snippets", "links", "settings", "presets", "clipFavorites"]),
    "Ticking a tile turns that category on through set_sync_config",
  );

  await act(async () => {
    const cur = harness.getStatus();
    await harness.emitStatus({
      categories: cur.categories.map((entry) => (entry.category === "links" ? { ...entry, state: "error", message: "links.json 无法读取：权限不足" } : entry)),
    });
  });
  await settle();
  const linksTile = [...wide.querySelectorAll<HTMLElement>(".sync-tile")].find((tile) => tile.textContent?.includes(zh.categories.items.links.title));
  check(
    linksTile?.querySelector(".sync-tile__error[role='alert']")?.textContent === "links.json 无法读取：权限不足"
      && linksTile.querySelector(".sync-badge--error")?.textContent === zh.categories.states.error,
    "A category error shows its full message under the tile with an error badge",
  );

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
      && wide.textContent?.includes(en.categories.items.todos.hint)
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

  check(overflowing(narrow).length === 0 && narrow.scrollWidth <= 340, "Nothing overflows horizontally in a 340px narrow container");

  const guideFixture = document.createElement("div");
  guideFixture.id = "guide";
  guideFixture.style.cssText = "width: 340px; display: grid; gap: 14px;";
  wide.parentElement!.append(guideFixture);
  await act(async () => { renderGuideFixture(guideFixture, harness.getStatus()); });
  await settle();
  check(guideFixture.querySelectorAll(".sync-guide__step").length === 3 && overflowing(guideFixture).length === 0 && guideFixture.scrollWidth <= 340,
    "The setup guide fits a 340px narrow container");

  const { SyncLanSection } = await import("../../src/features/sync/SyncLanSection");
  const lanBox = document.createElement("div");
  lanBox.style.cssText = "width: 340px; display: grid; gap: 8px;";
  wide.parentElement!.append(lanBox);
  const lanStatus = { ...harness.getStatus(), backend: "lan" as const, phase: "idle" as const };
  await act(async () => {
    createRoot(lanBox).render(<I18nProvider><SyncLanSection status={lanStatus} busy={false} /></I18nProvider>);
  });
  await settle();
  const lanText = zh.backend.lan;
  const lanButton = (label: string) => [...lanBox.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes(label));
  await act(async () => { lanButton(lanText.enable)!.click(); });
  await settle();
  check(
    calls.some((call) => call.command === "set_sync_lan")
      && lanBox.textContent?.includes(lanText.thisDeviceHint("ABCD-1234", 47321))
      && lanBox.textContent?.includes("Windows PC"),
    "Turning on the local network link shows this computer's ID and port and a Fuyu found nearby",
  );
  await act(async () => { lanButton(lanText.showCode)!.click(); });
  await settle();
  check(lanBox.querySelector(".sync-lan__code")?.textContent === "482913", "Show pairing code puts the 6 digits on screen");
  await act(async () => { lanButton(lanText.nearbyUse)!.click(); });
  await settle();
  const [addressInput, codeInput] = [...lanBox.querySelectorAll<HTMLInputElement>(".sync-lan__join input")];
  check(addressInput.value === "192.168.1.20:47321", "Use address fills in the nearby computer's address");
  await act(async () => { setInputValue(codeInput, "000000"); });
  await settle();
  await act(async () => { lanButton(lanText.join)!.click(); });
  await settle();
  check(lanBox.textContent?.includes("配对码不对"), "A wrong pairing code shows the localized sync.lanWrongCode error");
  await act(async () => { setInputValue(codeInput, "482913"); });
  await settle();
  await act(async () => { lanButton(lanText.join)!.click(); });
  await settle();
  check(
    lanBox.textContent?.includes(lanText.peerHint("FFFF-FFFF", "192.168.1.20:47321")) && !lanBox.textContent?.includes(lanText.peersEmpty),
    "Pairing lists the other computer with its ID and address",
  );
  check(overflowing(lanBox).length === 0 && lanBox.scrollWidth <= 340, "The local network section fits a 340px narrow container");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
  console.error(error);
}
