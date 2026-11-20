import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { ScreenshotHistoryPanel } from "../../src/features/screenshot/ScreenshotHistoryPanel";
import { ClipboardHistoryPanel } from "../../src/features/clipboard/ClipboardHistoryPanel";
import type { ClipboardHistorySnapshot } from "../../src/features/clipboard/api";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const DIR = "C:\Users\me\.fuyu\screenshots\\";
const today = new Date();
today.setHours(0, 0, 0, 0);
const recent = Math.max(today.getTime() + 60_000, Date.now() - 60_000 * 3);
const word = (text: string, x: number, y: number) => ({ text, x, y, width: 0.2, height: 0.08 });
let shots = [
  { path: `${DIR}c.png`, takenAt: recent, thumbnail: THUMB, width: 1600, height: 1000, words: [[word("Build", 0.1, 0.2), word("failed", 0.32, 0.2)]] },
  { path: `${DIR}b.png`, takenAt: recent - 30_000, thumbnail: THUMB, width: 3200, height: 1000, words: [[word("会议", 0.5, 0.5), word("纪要", 0.7, 0.5)]] },
  { path: `${DIR}a.png`, takenAt: today.getTime() - 86_400_000 * 3 + 3_600_000 * 9, thumbnail: null, width: 0, height: 0, words: null },
];
const calls: { command: string; payload: unknown }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, payload });
  switch (command) {
    case "screenshot_history": return shots;
    case "screenshot_history_delete":
      shots = shots.filter((shot) => shot.path !== (payload as { path: string }).path);
      return null;
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

const clipboard: ClipboardHistorySnapshot = {
  settings: { shortcutEnabled: true, shortcut: "Ctrl+Shift+W" } as ClipboardHistorySnapshot["settings"],
  items: [],
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <div style={{ width: 520, height: 320, padding: 12, background: "var(--island-background-color, #000)" }}>
        <ScreenshotHistoryPanel />
      </div>
    </I18nProvider>
  </StrictMode>,
);
createRoot(document.getElementById("clip")!).render(
  <StrictMode>
    <I18nProvider>
      <div style={{ width: 520, height: 320, padding: 12, background: "var(--island-background-color, #000)" }}>
        <ClipboardHistoryPanel snapshot={clipboard} onCopyItem={() => true} onToggleFavorite={() => {}} onUpdateNote={() => true} onDeleteItem={() => {}} onClear={() => {}}
          extraView={{ label: "截图", content: <ScreenshotHistoryPanel embedded /> }} />
      </div>
    </I18nProvider>
  </StrictMode>,
);

const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const called = (command: string) => calls.filter((call) => call.command === command);
const page = document.getElementById("root")!;
const clip = document.getElementById("clip")!;
const tiles = () => [...page.querySelectorAll<HTMLElement>(".screenshot-history__item")];
const days = () => [...page.querySelectorAll<HTMLElement>(".screenshot-history__day-title")].map((title) => title.textContent);
const clock = (time: number) => `${String(new Date(time).getHours()).padStart(2, "0")}:${String(new Date(time).getMinutes()).padStart(2, "0")}`;

async function runChecks() {
  try {
    await wait(80);
    check(tiles().length === 3 && tiles()[0].querySelector("img") && tiles()[2].querySelector("svg"), "All screenshots show, newest first; one without a thumbnail gets an icon");
    check(days()[0] === "今天2 张" && days().length === 2, "They are grouped by day, each group saying how many");
    check(page.querySelector(".island-list-count")?.textContent === "3" && page.querySelector(".screenshot-history__hint"), "The bar counts them and says what a click does");
    check(tiles()[0].querySelector(".screenshot-history__time")?.textContent === clock(shots[0].takenAt), "Each says the time it was taken");

    await act(async () => { tiles()[0].querySelector<HTMLButtonElement>(".screenshot-history__shot")!.click(); });
    await wait(10);
    check(JSON.stringify(called("screenshot_history_copy")[0]?.payload) === JSON.stringify({ path: `${DIR}c.png` }) && tiles()[0].querySelector(".screenshot-history__copied")?.textContent === "已复制", "A click copies it and the tile says so");

    await act(async () => { tiles()[2].querySelector<HTMLButtonElement>('button[aria-label="贴到屏幕上"]')!.click(); });
    await wait(10);
    check(JSON.stringify(called("screenshot_history_pin")[0]?.payload) === JSON.stringify({ path: `${DIR}a.png` }), "The pin button pins that one");

    await act(async () => { tiles()[1].querySelector<HTMLButtonElement>('button[aria-label="复制"]')!.click(); });
    await wait(10);
    check(JSON.stringify(called("screenshot_history_copy").slice(-1)[0]?.payload) === JSON.stringify({ path: `${DIR}b.png` }), "The copy button copies that one");

    const search = page.querySelector<HTMLInputElement>(".screenshot-history__search input")!;
    const type = async (text: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, text);
        search.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await wait(10);
    };
    check(search && search.placeholder === "搜图里的文字", "There is a box to search the text in the screenshots");
    await type("FAILED");
    check(tiles().length === 1 && tiles()[0].querySelectorAll(".screenshot-history__mark").length === 1, "Searching keeps only the screenshot with that text, ignoring case, and marks the word");
    await type("会 议纪");
    const marks = tiles()[0]?.querySelector<HTMLElement>(".screenshot-history__marks");
    check(tiles().length === 1 && tiles()[0].querySelectorAll(".screenshot-history__mark").length === 2 && marks?.style.width === "200%" && marks.style.left === "-50%", "Chinese text matches across words, and the marks follow the cropped thumbnail");
    await type("没有这个词");
    check(tiles().length === 0 && page.querySelector(".screenshot-history__no-match")?.textContent?.includes("没有截图里有「没有这个词」"), "With no match, it says so");
    await act(async () => { page.querySelector<HTMLButtonElement>('.screenshot-history__search button[aria-label="清除搜索"]')!.click(); });
    await wait(10);
    check(tiles().length === 3 && !page.querySelector(".screenshot-history__mark") && search.value === "", "Clearing the search brings every screenshot back without marks");

    const chips = () => [...clip.querySelectorAll<HTMLButtonElement>(".island-list-chip")];
    const shotChip = () => chips().find((chip) => chip.textContent === "截图")!;
    check(shotChip() && shotChip().getAttribute("aria-pressed") === "false" && clip.querySelector(".island-list-search"), "The clipboard page has a 截图 filter next to the others");
    await act(async () => { shotChip().click(); });
    await wait(80);
    check(shotChip().getAttribute("aria-pressed") === "true" && chips()[0].getAttribute("aria-pressed") === "false", "Choosing it presses only that filter");
    check(clip.querySelectorAll(".screenshot-history__item").length === shots.length && !clip.querySelector(".island-list-search") && !clip.querySelector(".island-list-count"), "It shows the screenshot grid in place of the search and the list");
    await act(async () => { chips()[0].click(); });
    await wait(10);
    check(!clip.querySelector(".screenshot-history") && clip.querySelector(".island-list-search"), "Going back to 全部 brings the clipboard list back");

    for (let left = tiles().length; left > 0; left -= 1) {
      await act(async () => { tiles()[0].querySelector<HTMLButtonElement>('button[aria-label="删除"]')!.click(); });
      await wait(10);
      check(tiles().length === left - 1, `Delete removes it at once (${left - 1} left)`);
    }
    check(page.querySelector(".island-list-empty")?.textContent?.includes("还没有截图"), "With nothing left, it says how screenshots get here");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
