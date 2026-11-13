import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { ScreenshotOverlay } from "../../src/windows/screenshot/ScreenshotOverlay";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const calls: { command: string; headers: Record<string, string> }[] = [];
mockIPC((command) => {
  switch (command) {
    case "screenshot_session": return { id: 1, mode: "record", width: WIDTH, height: HEIGHT, underPointer: true };
    case "screenshot_frame": return new Uint8Array(WIDTH * HEIGHT * 4).map((_, index) => (index % 4 === 3 ? 255 : 128)).buffer;
    case "screenshot_targets": return [];
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("screenshot-0");
type Internals = { invoke: (command: string, payload: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown> };
const internals = (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
const mockedInvoke = internals.invoke;
internals.invoke = (command, payload, options) => {
  calls.push({ command, headers: options?.headers ?? {} });
  return mockedInvoke(command, payload, options);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ScreenshotOverlay />
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
const key = (value: string) => act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: value })); });
const finishes = () => calls.filter((call) => call.command === "screenshot_finish");

async function runChecks() {
  try {
    for (let tries = 0; tries < 50 && !calls.some((call) => call.command === "screenshot_overlay_ready"); tries += 1) await wait(20);
    await wait(50);
    check(document.querySelector(".screenshot-overlay__hint")?.textContent?.includes("按 F 录整个屏幕"), "Record mode says how to pick the area and that F takes the whole screen");
    const hint = () => document.querySelector(".screenshot-overlay__hint")?.textContent ?? "";
    await key("g");
    check(hint().startsWith("录成 GIF"), "G switches record mode to GIF and the hint says so");
    await key("g");
    check(hint().includes("按 G 改录 GIF"), "…and G again switches back to MP4");
    await key("g");
    await key("f");
    await wait(20);
    const finish = finishes()[0];
    check(finishes().length === 1 && finish.headers["x-action"] === "record", "F picks the whole screen and starts recording at once, without a toolbar");
    check(finish.headers["x-left"] === "0" && finish.headers["x-top"] === "0" && finish.headers["x-width"] === String(WIDTH) && finish.headers["x-height"] === String(HEIGHT), "…covering the whole monitor");
    check(decodeURIComponent(finish.headers["x-folder-name"]) === "浮屿录屏", "…into the recordings folder named in the current language");
    check(!document.querySelector(".screenshot-overlay__toolbar"), "No toolbar shows in record mode");
    check(finish.headers["x-format"] === "gif", "…as a GIF, since G was on");
    check(finish.headers["x-fps"] === "30" && finish.headers["x-quality"] === "standard" && finish.headers["x-system-audio"] === "true" && finish.headers["x-microphone"] === "false", "…with the recording settings (default 30 fps, standard quality, system sound, no microphone)");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
