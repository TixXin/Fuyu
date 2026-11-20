import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../../src/features/clipboard/ClipboardCopyNotice";
import { useClipboardCopyCard } from "../../src/features/clipboard/useClipboardCopyCard";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const invoked: { cmd: string; args: unknown }[] = [];
mockIPC((cmd, args) => { invoked.push({ cmd, args }); return null; }, { shouldMockEvents: true });
mockWindows("main");

function Harness() {
  const card = useClipboardCopyCard(true);
  return (
    <div style={{ position: "relative", width: 360, height: 38, borderRadius: 19, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 18px", background: "#000" }}>
        {card.current && <ClipboardCopyNotice key={card.current.key} card={card} />}
        <ClipboardCopyNoticeActions card={card} />
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
const card = () => document.querySelector<HTMLElement>(".clipboard-copy-notice");
const THUMB = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const base = { hash: "h", createdAt: 1, copiedAt: 1 };
const TEXT: ClipboardHistoryItem = { ...base, id: "t1", kind: "text", preview: "pnpm   test:regression\nclipboard", text: "pnpm   test:regression\nclipboard" };
const LINK: ClipboardHistoryItem = { ...base, id: "l1", kind: "text", preview: "https://github.com/TixXin/fuyu/issues/321", text: "https://github.com/TixXin/fuyu/issues/321" };
const SECRET: ClipboardHistoryItem = { ...base, id: "s1", kind: "text", preview: "sk-a••••••", masked: true };
const IMAGE: ClipboardHistoryItem = { ...base, id: "i1", kind: "image", preview: "", image: { width: 10, height: 10, byteSize: 100, originalPath: "a.png", thumbnailPath: "a-t.png", thumbnailDataUrl: THUMB } };
const FILES: ClipboardHistoryItem = { ...base, id: "f1", kind: "files", preview: "report.pdf", files: ["C:\\Users\\me\\report.pdf", "C:\\Users\\me\\notes.txt"] };
const copied = (item: ClipboardHistoryItem, seconds = 3) => act(async () => { await emit("clipboard-item-copied", { item, seconds }); });

async function runChecks() {
  try {
    await wait(50);
    check(!card(), "Nothing shows before a copy");

    await copied(TEXT);
    check(card()?.textContent === "已复制 · pnpm test:regression clipboard" && document.querySelector(".clipboard-copy-notice .clipboard-entry-icon"), "Copied text shows a one-line summary with the entry icon");

    await copied(LINK);
    check(card()?.textContent?.includes("github.com › TixXin/fuyu › issues/321"), "A link reads as host › path");

    await copied(SECRET);
    check(card()?.textContent === "已复制（已打码）", "A masked entry never shows its text");

    await copied(IMAGE);
    check(card()?.textContent === "已复制图片" && document.querySelector(".clipboard-copy-notice__thumb"), "A copied image shows its thumbnail");

    await copied(FILES);
    check(card()?.textContent === "已复制 report.pdf 等 2 个文件" && card()?.dataset.kind === "files", "Copied files show the first name and the count");

    await act(async () => { document.querySelector<HTMLButtonElement>('.clipboard-copy-notice__actions button[aria-label="关闭"]')!.click(); });
    check(!card(), "Close takes the card away");

    await copied(TEXT, 0);
    check(!card(), "Nothing shows when the card is turned off");

    await act(async () => { await emit("clipboard-item-copied", { item: TEXT, seconds: 8, pasteBlocked: "accessibility" }); });
    check(card()?.textContent === "已复制，没能粘贴：要在辅助功能里允许浮屿", "A paste blocked by Accessibility says so instead of the summary");
    await act(async () => { document.querySelector<HTMLButtonElement>('.clipboard-copy-notice__actions button[aria-label="打开辅助功能设置"]')!.click(); });
    check(invoked.some(({ cmd, args }) => cmd === "open_system_permission" && (args as { kind?: string }).kind === "accessibility") && !card(), "Its button opens Accessibility settings and closes the card");

    await copied(TEXT);
    check(!document.querySelector('.clipboard-copy-notice__actions button[aria-label="打开辅助功能设置"]'), "An ordinary copy has no settings button");

    await copied(TEXT, 1);
    await wait(1200);
    check(!card(), "The card goes away on its own after its time");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
