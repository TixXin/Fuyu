import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { I18nProvider } from "../../src/i18n";
import { ClipboardPopup } from "../../src/features/clipboard/ClipboardPopup";
import type { ClipboardHistoryItem, ClipboardPeek } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;

const peeks: (ClipboardPeek | null)[] = [];
export const pointer = { inside: false };

export async function renderStayFrame(container: HTMLElement, items: ClipboardHistoryItem[]) {
  const root = createRoot(container);
  await act(async () => root.render(
    <StrictMode>
      <I18nProvider>
        <ClipboardPopup
          items={items}
          snippets={[]}
          openCount={0}
          wide={false}
          onPaste={() => {}}
          onPasteSnippet={() => {}}
          onPasteSequence={() => {}}
          onClose={() => {}}
          onToggleFavorite={() => {}}
          onPeek={(peek) => peeks.push(peek)}
        />
      </I18nProvider>
    </StrictMode>,
  ));
}

const input = () => document.querySelector<HTMLInputElement>("#popup input")!;
const press = (type: "keydown" | "keyup", init: KeyboardEventInit) => act(async () => {
  input().dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
});
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const report = (payload: unknown) => act(async () => { await emit("clipboard-preview-report", payload); });
const open = () => peeks[peeks.length - 1] != null;

async function hold(during: () => Promise<void> = async () => {}) {
  await press("keydown", { key: " " });
  await wait(420);
  await during();
  await press("keyup", { key: " " });
  await wait(20);
}

export async function checkStay(check: Check, calls: string[]) {
  await hold();
  check(!open(), "按住空格、鼠标没进过预览：松开就关");

  await hold(() => report({ type: "pointer", inside: true }));
  check(open() && peeks[peeks.length - 1]?.stay === true, "按住期间鼠标进过预览：松开后留住");
  await press("keydown", { key: " " });
  check(!open(), "留住之后再按空格关上");

  pointer.inside = true;
  await hold();
  pointer.inside = false;
  check(open() && calls.some((call) => call.startsWith("clipboard_preview_has_pointer")), "松开时指针停在预览上（按 Rust 的指针位置）：也留住");
  await press("keydown", { key: "Escape" });
  check(!open(), "Esc 关上");

  await press("keydown", { key: " " });
  await press("keyup", { key: " " });
  await report({ type: "pinned", pinned: true });
  await press("keydown", { key: " " });
  check(open(), "钉住后空格不关");
  const before = calls.length;
  await press("keydown", { key: "f" });
  await press("keydown", { key: "+" });
  const sent = calls.slice(before);
  check(sent.some((call) => call === `set_clipboard_preview_size:${JSON.stringify({ size: "next" })}`), "预览开着时按 F 循环档位");
  check(sent.some((call) => call.startsWith("plugin:event|emit_to") && call.includes("clipboard-preview-command") && call.includes('"zoom":"in"')), "按 + 经预览命令事件发给预览窗口");
  check(input().value === "", "F、+ 不会打进搜索框");
  await report({ type: "close" });
  check(!open(), "预览上的 × 关上");
}
