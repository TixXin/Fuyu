// pnpm dev, then open /tests/regression/screenshot-card.html.
// The island's screenshot card (C41.5) with the Tauri boundary mocked: it appears for a copied
// screenshot, puts it on the file shelf, sends it to the one agent session (focus, then paste),
// is disabled without a session, and closes.
import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { ScreenshotCard } from "../../src/features/screenshot/ScreenshotCard";
import { useScreenshotCard } from "../../src/features/screenshot/useScreenshotCard";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const calls: { command: string; payload: unknown }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, payload });
  switch (command) {
    case "focus_agent_window": return true;
    case "add_file_shelf_paths": return { items: [] };
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

const SESSION = { provider: "claude", sessionId: "s1", cwd: "E:\\Projects\\demo", title: "demo", phase: "running" } as unknown as AgentSessionSummary;
let setSessions: (sessions: AgentSessionSummary[]) => void = () => {};

function Harness() {
  const card = useScreenshotCard();
  const [sessions, set] = useState<AgentSessionSummary[]>([SESSION]);
  setSessions = set;
  return (
    <div style={{ position: "relative", width: 360, height: 38, borderRadius: 19, overflow: "hidden" }}>
      <ScreenshotCard key={card.current?.path} card={card} sessions={sessions} />
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
const called = (command: string) => calls.filter((call) => call.command === command);
const card = () => document.querySelector<HTMLElement>(".screenshot-card");
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.screenshot-card button[aria-label="${label}"]`);
const PATH = "C:\\Users\\me\\AppData\\Roaming\\com.tixxin.fuyu\\screenshots\\Fuyu_2026-11-12_10-30-15.png";
const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runChecks() {
  try {
    await wait(50);
    check(!card(), "Nothing shows before a screenshot");

    await act(async () => { await emit("screenshot-taken", { path: PATH, thumbnail: THUMB, saved: false }); });
    check(card()?.textContent?.includes("截图已复制") && document.querySelector(".screenshot-card__thumb"), "A copied screenshot shows the card with its thumbnail");

    await act(async () => { button("放进文件中转")!.click(); });
    await wait(10);
    check(JSON.stringify(called("add_file_shelf_paths")[0]?.payload) === JSON.stringify({ paths: [PATH] }) && card()?.textContent?.includes("已放进文件中转"), "The shelf button puts the file on the file shelf and says so");

    await act(async () => { button("发给 Agent")!.click(); });
    await wait(20);
    const focus = called("focus_agent_window")[0]?.payload as { sessionId?: string } | undefined;
    check(focus?.sessionId === "s1", "With one agent session, Send to an agent brings that session forward");
    check(JSON.stringify(called("screenshot_paste_to_front")[0]?.payload) === JSON.stringify({ path: PATH }) && !card(), "…pastes the file into it and closes the card");

    await act(async () => { setSessions([]); });
    await act(async () => { await emit("screenshot-taken", { path: `${PATH}2`, thumbnail: null, saved: true }); });
    check(card()?.textContent?.includes("截图已保存") && button("发给 Agent")?.disabled, "A saved one says so; without a session, sending is off");

    await act(async () => { button("关闭")!.click(); });
    check(!card(), "Close takes the card away");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
