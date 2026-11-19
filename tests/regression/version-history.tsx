import { mockIPC } from "@tauri-apps/api/mocks";
import { act, StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS, useLocale, type LocaleCode } from "../../src/i18n";

const CURRENT = "0.3.9-beta.2";
const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

mockIPC((command) => {
  switch (command) {
    case "plugin:app|version": return CURRENT;
    case "updater_configured": return false;
    default: return null;
  }
}, { shouldMockEvents: true });

const { VersionHistory } = await import("../../src/features/updater/VersionHistory");
const { BUNDLED_RELEASES } = await import("../../src/features/updater/bundledReleases");
const RELEASES = BUNDLED_RELEASES.map((release, index) => ({ ...release, date: `2026-10-${String(1 + (index % 28)).padStart(2, "0")}` }));
const { checkOnFirstVisit } = await import("../../src/features/updater/updaterController");

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const settle = (ms = 80) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
let switchLocale: (locale: LocaleCode) => void = () => {};

function LocaleSwitch() {
  const { setLocale } = useLocale();
  useEffect(() => { switchLocale = setLocale; }, [setLocale]);
  return null;
}

const host = document.getElementById("history")!;
const rows = () => [...host.querySelectorAll<HTMLElement>(".version-history__item")];
const rowButton = (base: string) => host.querySelector<HTMLButtonElement>(`.version-history__item[data-base='${base}'] .version-history__row`)!;
const notes = () => host.querySelector<HTMLElement>(".version-history__notes");
const waitForNotes = async (version: string) => {
  for (let i = 0; i < 40 && notes()?.dataset.version !== version; i += 1) await settle(50);
  return notes();
};

try {
  await act(async () => { await checkOnFirstVisit(); });
  await act(async () => {
    createRoot(host).render(<StrictMode><I18nProvider><LocaleSwitch /><VersionHistory releases={RELEASES} /></I18nProvider></StrictMode>);
    createRoot(document.getElementById("narrow")!).render(<StrictMode><I18nProvider><VersionHistory releases={RELEASES} /></I18nProvider></StrictMode>);
  });
  await settle();
  const zh = TRANSLATIONS["zh-CN"].settings.versionHistory;
  const en = TRANSLATIONS.en.settings.versionHistory;

  check(host.querySelector(".settings-group__title")?.textContent === zh.title, "The about page has a changelog group");
  const bases = rows().map((row) => row.dataset.base);
  check(bases[0] === "0.3.9" && !bases.includes("0.3.10"), "Versions newer than the running one are left out");
  check(rows().length === 5 && host.querySelector(".version-history__more")?.textContent?.startsWith("显示更早的"), "Five recent versions show first with a button for older ones");
  const first = rows()[0];
  check(first.querySelector(".version-history__tag--current")?.textContent === zh.current && first.querySelector(".version-history__tag--beta")?.textContent === zh.beta,
    "The running beta is marked current and as a beta while its release is not out");
  check(rows().every((row) => /^2026-10-\d{2}$/.test(row.querySelector("time")?.textContent ?? "")), "Each version shows its release date");
  check(rows()[1].querySelector(".version-history__meta")?.textContent === zh.betaCount(4), "A release says how many betas it folds in");

  check(rowButton("0.3.9").getAttribute("aria-expanded") === "true" && host.querySelectorAll(".version-history__item--open").length === 1, "The running version starts open, the rest closed");
  rowButton("0.3.8").click();
  await settle();
  check(rowButton("0.3.8").getAttribute("aria-expanded") === "true", "Clicking a version opens it");
  let body = await waitForNotes("0.3.8");
  check(body && /[一-龥]/.test(body.textContent ?? "") && !/About this release|关于这个版本|\.exe/.test(body.textContent ?? ""), "Its notes show in Chinese without the download section");
  const chips = [...host.querySelectorAll<HTMLButtonElement>(".version-history__chip")];
  check(chips.length === 5 && chips[0].textContent === zh.stableChip && chips[0].getAttribute("aria-pressed") === "true", "The release is picked first, with a chip per beta");
  chips[1].click();
  body = await waitForNotes("0.3.8-beta.4");
  check(body && chips[1].getAttribute("aria-pressed") === "true", "A beta chip shows that beta's notes");

  await act(async () => { switchLocale("en"); });
  body = await waitForNotes("0.3.8-beta.4");
  await settle();
  check(host.querySelector(".settings-group__title")?.textContent === en.title && !/[一-龥]/.test(notes()?.textContent ?? ""), "Switching to English shows the English half");

  host.querySelector<HTMLButtonElement>(".version-history__more")!.click();
  await settle();
  check(rows().length > 10 && rows()[rows().length - 1]?.dataset.base === "0.2.6", "Showing older versions goes back to the first notes");

  rowButton("0.3.8").click();
  await settle();
  check(!host.querySelector(".version-history__panel"), "Clicking an open version closes it");

  const narrow = document.getElementById("narrow")!;
  check(narrow.querySelector(".version-history__row")?.getAttribute("aria-expanded") === "true", "The narrow list also starts with the running version open");
  await settle(300);
  const overflow = [...narrow.querySelectorAll<HTMLElement>("*")].filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX !== "hidden" && element.clientWidth > 0);
  check(overflow.length === 0 && narrow.scrollWidth <= 340, "Nothing overflows in a narrow window");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
