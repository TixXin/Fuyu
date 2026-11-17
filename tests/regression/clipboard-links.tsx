import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/components/list/IslandList.css";
import { I18nProvider } from "../../src/i18n";
import type { ClipboardHistoryItem, ClipboardLinks } from "../../src/features/clipboard/api";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../../src/features/clipboard/ClipboardCopyNotice";
import { ClipboardLinksPanel } from "../../src/features/clipboard/ClipboardLinksPanel";
import { useClipboardCopyCard } from "../../src/features/clipboard/useClipboardCopyCard";
import { useClipboardLinks } from "../../src/features/clipboard/useClipboardLinks";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

let store: ClipboardLinks = {
  version: 1,
  settings: { notice: true, matching: "any", blockedSites: ["blocked.com"], onlySites: [] },
  links: [
    { id: "a", url: "https://a.com/", title: "Site A", addedAt: 1 },
    { id: "b", url: "https://b.com/docs", title: "", addedAt: 2 },
    { id: "c", url: "https://c.com/", title: "Site C", addedAt: 3 },
  ],
};
const calls: { command: string; payload: Record<string, unknown> }[] = [];
const changed = () => { void emit("clipboard-links-changed", store); return store; };
mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  calls.push({ command, payload: args });
  switch (command) {
    case "get_clipboard_links": return store;
    case "add_clipboard_link": {
      store = { ...store, links: [{ id: "n", url: String(args.url), title: "", addedAt: 4 }, ...store.links] };
      return changed();
    }
    case "remove_clipboard_link": {
      store = { ...store, links: store.links.filter((link) => link.id !== args.id) };
      return changed();
    }
    case "move_clipboard_link": {
      const links = store.links.filter((link) => link.id !== args.id);
      links.splice(Number(args.to), 0, store.links.find((link) => link.id === args.id)!);
      store = { ...store, links };
      return changed();
    }
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("main");

function Harness() {
  const card = useClipboardCopyCard(true);
  const links = useClipboardLinks();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: 360, height: 38, padding: "0 18px", background: "var(--island-fill, #000)", borderRadius: 19 }}>
        {card.current && <ClipboardCopyNotice key={card.current.key} card={card} />}
        <ClipboardCopyNoticeActions card={card} />
      </div>
      <div className="island-list-page" style={{ width: 520, marginTop: 16, background: "var(--island-fill, #000)" }}>
        <ClipboardLinksPanel state={links} icons={false} />
      </div>
    </>
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
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.clipboard-copy-notice__actions button[aria-label="${label}"]`);
const rows = () => [...document.querySelectorAll<HTMLElement>(".clipboard-link-row .island-list-row__main")].map((row) => row.textContent);
const base = { hash: "h", createdAt: 1, copiedAt: 1 };
const text = (id: string, value: string): ClipboardHistoryItem => ({ ...base, id, kind: "text", preview: value, text: value });
const captured = (item: ClipboardHistoryItem) => act(async () => { await emit("clipboard-item-copied", { item, seconds: 0, origin: "capture" }); });

async function runChecks() {
  try {
    await wait(80);
    check(rows().join("|") === "Site A|b.com › docs|Site C", "Bookmarks list in their saved order, untitled ones by host › path");

    await captured(text("t1", "hello there"));
    check(!card(), "Copying plain text elsewhere shows nothing");

    await captured(text("l0", "https://www.blocked.com/x"));
    check(!card(), "A blocked site is not offered");

    await captured(text("l1", "https://news.example.org/story/1"));
    check(card()?.textContent?.includes("复制了链接 · news.example.org › story/1") && button("加入书签"), "A copied link elsewhere offers a bookmark");

    await act(async () => { button("加入书签")!.click(); });
    await wait(20);
    check(calls.some((call) => call.command === "add_clipboard_link" && call.payload.url === "https://news.example.org/story/1"), "The bookmark button saves the address");
    check(button("已加入书签")?.disabled && rows()[0] === "news.example.org › story/1", "…the card says it's saved and the list shows it first");

    await act(async () => { document.querySelector<HTMLButtonElement>('.clipboard-copy-notice__actions button[aria-label="关闭"]')!.click(); });
    await act(async () => { await emit("clipboard-item-copied", { item: text("l2", "https://a.com/"), seconds: 3, origin: "history" }); });
    check(card()?.textContent?.startsWith("已复制") && button("已加入书签"), "Copying a saved link from history shows it as already bookmarked");
    await act(async () => { document.querySelector<HTMLButtonElement>('.clipboard-copy-notice__actions button[aria-label="关闭"]')!.click(); });

    const grip = document.querySelectorAll<HTMLButtonElement>(".clipboard-link-row__grip")[1];
    await act(async () => { grip.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    await wait(20);
    check(rows().join("|") === "news.example.org › story/1|b.com › docs|Site A|Site C", "↓ on the grip moves a bookmark down");

    await act(async () => { document.querySelectorAll<HTMLButtonElement>('.clipboard-link-row button[aria-label="删除书签"]')[0].click(); });
    await wait(20);
    check(rows().length === 3 && !rows().includes("news.example.org › story/1"), "The delete button removes a bookmark");

    await act(async () => { store = { ...store, settings: { ...store.settings, notice: false } }; await emit("clipboard-links-changed", store); });
    await captured(text("l3", "https://another.example.com/"));
    check(!card()?.textContent?.includes("another.example.com"), "With the notice off, copied links are not offered");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
