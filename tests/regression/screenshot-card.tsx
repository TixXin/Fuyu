import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { agentsV1, translatorV1, type AgentSessionEntry } from "@fuyu/plugin-services";
import { windowServices } from "../../src/features/plugin-kernel/services";
import "../../src/features/file-shelf/plugin/services.ts";
import { ScreenshotNotice, ScreenshotNoticeActions } from "../../src/features/screenshot/ScreenshotNotice";
import { useScreenshotNotice } from "../../src/features/screenshot/useScreenshotNotice";
import { useScreenshotCard } from "../../src/features/screenshot/useScreenshotCard";
import { useScreenshotText } from "../../src/features/screenshot/useScreenshotText";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const calls: { command: string; payload: unknown }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, payload });
  switch (command) {
    case "add_file_shelf_paths": return { items: [] };
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

const SESSION: AgentSessionEntry = { key: "claude:s1", provider: "claude", sessionId: "s1", cwd: "E:\\Projects\\demo", title: "demo", phase: "running", updatedAt: 0, remoteHost: null, listed: true, unseen: false };
const REMOTE: AgentSessionEntry = { ...SESSION, key: "claude:r1", sessionId: "r1", remoteHost: "box" };
let sessions: AgentSessionEntry[] = [SESSION, REMOTE];
const focused: unknown[] = [];
const agents = windowServices.provide(agentsV1, {
  sessions: async () => ({ sessions, others: [] }),
  usage: async () => ({ claude: null, codex: null }),
  focus: async (params) => {
    focused.push(params);
    return { found: true };
  },
  remoteHosts: async () => ({ hosts: [] }),
}, { owner: "agents" });
const setSessions = (next: AgentSessionEntry[]) => {
  sessions = next;
  agents.emit("changed", { count: next.length });
};

const translated: unknown[] = [];
let translatorOff = false;
windowServices.provide(translatorV1, {
  translate: async (params) => {
    translated.push(params);
    if (translatorOff) throw Object.assign(new Error("off"), { code: "not-ready" });
    return { text: "Hello\n  world", engine: "deepseek" as const };
  },
  rewrite: async () => ({ text: "", engine: "deepseek" as const }),
  engines: async () => ({ engines: [] }),
}, { owner: "translation" });

function Peek() {
  const peek = useScreenshotText();
  return <span className="peek">{peek ?? ""}</span>;
}

function Harness() {
  const card = useScreenshotCard(8);
  const notice = useScreenshotNotice(card);
  return (
    <div style={{ position: "relative", width: 360, height: 38, borderRadius: 19, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 18px", background: "#000" }}>
        {notice.taken && <ScreenshotNotice key={notice.taken.path} notice={notice} />}
        <ScreenshotNoticeActions notice={notice} />
      </div>
      <Peek />
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
const card = () => document.querySelector<HTMLElement>(".screenshot-notice");
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.screenshot-notice__actions button[aria-label="${label}"]`);
const PATH = "C:\\Users\\me\\AppData\\Roaming\\com.tixxin.fuyu\\screenshots\\Fuyu_2026-11-12_10-30-15.png";
const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function runChecks() {
  try {
    await wait(50);
    check(!card(), "Nothing shows before a screenshot");

    await act(async () => { await emit("screenshot-taken", { path: PATH, thumbnail: THUMB, saved: false }); });
    check(card()?.textContent?.includes("截图已复制") && document.querySelector(".screenshot-notice__thumb"), "A copied screenshot shows the notice with its thumbnail");

    await act(async () => { button("放进文件中转")!.click(); });
    await wait(10);
    check(JSON.stringify(called("add_file_shelf_paths")[0]?.payload) === JSON.stringify({ paths: [PATH] }) && card()?.textContent?.includes("已放进文件中转"), "The shelf button puts the file on the file shelf and says so");

    await act(async () => { button("发给 Agent")!.click(); });
    await wait(20);
    check(JSON.stringify(focused[0]) === JSON.stringify({ provider: "claude", sessionId: "s1", cwd: "E:\\Projects\\demo", title: "demo" }), "With one local agent session, Send to an agent brings that session forward through agents/v1");
    check(JSON.stringify(called("screenshot_paste_to_front")[0]?.payload) === JSON.stringify({ path: PATH }) && !card(), "…pastes the file into it and closes the card");

    await act(async () => { setSessions([]); });
    await wait(10);
    await act(async () => { await emit("screenshot-taken", { path: `${PATH}2`, thumbnail: null, saved: true }); });
    await wait(10);
    check(card()?.textContent?.includes("截图已保存") && button("发给 Agent")?.disabled, "A saved one says so; without a session, sending is off");

    await act(async () => { button("关闭")!.click(); });
    check(!card(), "Close takes the card away");

    const peek = () => document.querySelector(".peek")?.textContent;
    await act(async () => { await emit("screenshot-text", " abc\n def "); });
    check(peek() === "已复制识别的文字：abc def", "Recognized text shows on one line");
    await act(async () => { await emit("screenshot-translate", "你好"); });
    await wait(10);
    check(JSON.stringify(translated[0]) === JSON.stringify({ text: "你好" }) && peek() === "Hello world", "Translate sends the text to translator/v1 without a direction and shows the answer on one line");
    translatorOff = true;
    await act(async () => { await emit("screenshot-translate", "再见"); });
    await wait(10);
    check(peek() === "快捷翻译已关闭，打开后才能翻译截图", "With translation off, translating says so");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
