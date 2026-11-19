import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { registerTranslationEngine } from "../../src/features/translation/providers";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "../../src/features/translation/storage";
import data from "./shot-data.json";

type Report = { state: "pending" } | { state: "failed"; error: string } | { state: "ready"; rect: { x: number; y: number; width: number; height: number } };
const report = (value: Report) => Object.assign(window, { __shot: value });
report({ state: "pending" });

const LOCALE = "zh-CN";
const { ecdict } = data;
const lookups = new Map(Object.entries(ecdict.lookups));
const word = new URLSearchParams(location.search).get("word") ?? [...lookups.keys()][0];

localStorage.setItem(LOCALE_STORAGE_KEY, LOCALE);
localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, provider: ecdict.engine }));
Object.assign(globalThis, { isTauri: true });
mockWindows("translation");
mockIPC(
  (command, payload) => {
    if (command === "plugin:window|is_visible") return true;
    if (command === "read_translation_clipboard") return word;
    if (command === "set_translation_shortcut") return (payload as { shortcut: string }).shortcut;
    if (command === "has_translation_secret") return false;
    return null;
  },
  { shouldMockEvents: true },
);

registerTranslationEngine({
  engine: ecdict.engine,
  label: ecdict.label,
  defaultModel: ecdict.defaultModel,
  hasSecret: ecdict.hasSecret,
  translate({ text }) {
    const result = lookups.get(text);
    if (result === undefined) throw new Error(`no lookup was prepared for ${text}`);
    return { text: result };
  },
});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function until(ready: () => boolean, what: string) {
  const deadline = performance.now() + 10_000;
  while (!ready()) {
    if (performance.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(50);
  }
}

async function main() {
  const { TranslationWindow } = await import("../../src/windows/translation/TranslationWindow");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <TranslationWindow />
      </I18nProvider>
    </StrictMode>,
  );
  const input = () => document.querySelector<HTMLTextAreaElement>("#translation-input");
  await until(() => input()?.value === word, "the clipboard text to land in the source box");
  await until(() => document.querySelector(".translation-window__provider")?.textContent?.startsWith(ecdict.label[LOCALE]) === true, "the offline dictionary to be the chosen service");
  document.querySelector<HTMLButtonElement>(".translation-window__translate")!.click();
  await until(() => Boolean(document.querySelector(".translation-window__result--filled")), "the lookup result");
  const failure = document.querySelector(".translation-window__error")?.textContent;
  if (failure) throw new Error(`the window shows an error: ${failure}`);
  if (document.querySelector(".translation-window__result")?.textContent !== lookups.get(word)) throw new Error("the result is not the prepared lookup");
  (document.activeElement as HTMLElement | null)?.blur();
  await document.fonts.ready;
  await sleep(400);
  const box = document.querySelector<HTMLElement>(".translation-window")!.getBoundingClientRect();
  report({ state: "ready", rect: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

main().catch((error: unknown) => report({ state: "failed", error: error instanceof Error ? error.message : String(error) }));
