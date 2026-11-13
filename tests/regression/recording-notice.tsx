import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { RecordingNotice, RecordingNoticeActions } from "../../src/features/screenshot/RecordingNotice";
import { useRecording } from "../../src/features/screenshot/useRecording";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const IDLE = { phase: "idle", countdown: 0, paused: false, elapsedMs: 0, sinceMs: 0 };
const calls: { command: string; payload: unknown }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, payload });
  switch (command) {
    case "screen_recording_status": return { ...IDLE, phase: "countdown", countdown: 3 };
    case "add_file_shelf_paths": return { items: [] };
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

function Harness() {
  const recording = useRecording();
  return (
    <div style={{ position: "relative", width: 360, height: 38, borderRadius: 19, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 18px", background: "var(--island-background-color, #000)" }}>
        <RecordingNotice recording={recording} />
        <RecordingNoticeActions recording={recording} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <Harness />
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
const text = () => document.querySelector(".recording-notice__text")?.textContent ?? null;
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.screenshot-notice__actions button[aria-label="${label}"]`);
const click = (label: string) => act(async () => { button(label)!.click(); });
const send = (event: string, payload: unknown) => act(async () => { await emit(event, payload); });
const last = (command: string) => [...calls].reverse().find((call) => call.command === command);

async function runChecks() {
  try {
    for (let tries = 0; tries < 50 && !text(); tries += 1) await wait(20);
    check(text() === "3 秒后开始录屏", `A countdown already running when the island loads is shown (${text()})`);
    check(button("取消"), "…with a cancel button");
    await send("recording-state", { ...IDLE, phase: "countdown", countdown: 1 });
    check(text() === "1 秒后开始录屏", "The countdown follows the native side");

    await send("recording-state", { ...IDLE, phase: "recording", elapsedMs: 0, sinceMs: Date.now() - 2_500 });
    check(text() === "录屏中 00:02", `Recording shows the time since it started (${text()})`);
    check(document.querySelector(".recording-notice__dot--live"), "…with a pulsing red dot");
    await click("暂停");
    check((last("screen_recording_pause")?.payload as { paused: boolean }).paused === true, "Pause asks the native side to pause");
    await send("recording-state", { ...IDLE, phase: "recording", paused: true, elapsedMs: 65_000, sinceMs: 0 });
    check(text() === "已暂停 01:05" && button("继续"), `Paused shows the time so far and a resume button (${text()})`);
    await wait(600);
    check(text() === "已暂停 01:05", "…and the time stands still while paused");

    await click("停止并保存（Ctrl+Shift+6）");
    check(last("screen_recording_stop"), "Stop asks the native side to stop");
    await send("recording-state", IDLE);
    await send("recording-finished", { summary: { path: "C:\\Videos\\浮屿录屏\\Fuyu_1.mp4", width: 1920, height: 1080, seconds: 12.4, frames: 300, repeats: 70, dropped: 0, hardware: true, systemAudio: true, microphone: false }, error: null });
    check(text() === "录屏已保存 · 00:12", `When it is saved, the card says so with its length (${text()})`);
    check(button("在文件夹中显示") && button("放进文件中转") && button("关闭"), "…with show in folder, file shelf and close");
    await click("放进文件中转");
    check((last("add_file_shelf_paths")?.payload as { paths: string[] }).paths[0].endsWith("Fuyu_1.mp4"), "The file shelf button shelves the video");
    await wait(10);
    check(text() === "已放进文件中转", "…and says so");
    await click("关闭");
    check(!text(), "Close takes the card away");

    await send("recording-finished", { summary: null, error: { code: "recording.failed", message: "The recording failed.", args: {}, detail: "no graphics card" } });
    check(text()?.includes("录屏失败"), `A failed recording shows the error (${text()})`);
    check(!button("在文件夹中显示") && button("关闭"), "…with only a close button");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
