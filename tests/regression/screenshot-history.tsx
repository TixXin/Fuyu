import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { ScreenshotHistoryPanel } from "../../src/features/screenshot/ScreenshotHistoryPanel";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const DIR = "C:\\Users\\me\\.fuyu\\screenshots\\";
let shots = [
  { path: `${DIR}b.png`, takenAt: Date.now() - 60_000 * 3, thumbnail: THUMB },
  { path: `${DIR}a.png`, takenAt: Date.now() - 86_400_000 * 3, thumbnail: null },
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <div style={{ width: 520, height: 320, padding: 12, background: "var(--island-background-color, #000)" }}>
        <ScreenshotHistoryPanel />
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
const tiles = () => [...document.querySelectorAll<HTMLElement>(".screenshot-history__item")];

async function runChecks() {
  try {
    await wait(80);
    check(tiles().length === 2 && tiles()[0].querySelector("img") && tiles()[1].querySelector("svg"), "Both screenshots show, newest first; one without a thumbnail gets an icon");
    check(document.querySelector(".island-list-count")?.textContent === "2", "The bar counts them");
    check(tiles()[0].querySelector(".screenshot-history__time")?.textContent?.includes("3"), "Each says when it was taken");

    await act(async () => { tiles()[0].querySelector<HTMLButtonElement>(".screenshot-history__shot")!.click(); });
    await wait(10);
    check(JSON.stringify(called("screenshot_history_copy")[0]?.payload) === JSON.stringify({ path: `${DIR}b.png` }) && document.querySelector(".island-list-notice")?.textContent === "已复制", "A click copies it and says so");

    await act(async () => { tiles()[1].querySelector<HTMLButtonElement>('button[aria-label="贴到屏幕上"]')!.click(); });
    await wait(10);
    check(JSON.stringify(called("screenshot_history_pin")[0]?.payload) === JSON.stringify({ path: `${DIR}a.png` }), "The pin button pins that one");

    await act(async () => { tiles()[0].querySelector<HTMLButtonElement>('button[aria-label="删除"]')!.click(); });
    await wait(10);
    check(called("screenshot_history_delete").length === 1 && tiles().length === 1, "Delete removes it at once");

    await act(async () => { tiles()[0].querySelector<HTMLButtonElement>('button[aria-label="删除"]')!.click(); });
    await wait(10);
    check(document.querySelector(".island-list-empty")?.textContent?.includes("还没有截图"), "With nothing left, it says how screenshots get here");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
