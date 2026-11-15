import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { ClipboardPopup } from "../../src/features/clipboard/ClipboardPopup";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;

const FRAME = "pins";

export async function renderPinFrame(host: HTMLElement, templates: readonly ClipboardHistoryItem[], calls: string[], automated: boolean) {
  const items = templates.map((item) => (item.id === "m1" ? { ...item, favorite: true, pinKey: "K", pinOrder: 0 } : item));
  const wrap = document.createElement("div");
  wrap.innerHTML = "<p class=\"caption\">收藏置顶和固定键</p>";
  const box = document.createElement("div");
  box.className = "frame frame--standard";
  box.id = `frame-${FRAME}`;
  wrap.append(box);
  host.append(wrap);
  const root = createRoot(box);
  const render = () => root.render(
    <StrictMode><I18nProvider>
      <ClipboardPopup
        items={items}
        snippets={[]}
        openCount={0}
        wide={false}
        pinFavorites
        onPaste={(id, plain) => calls.push(`paste:${id}${plain ? ":plain" : ""}`)}
        onPasteSnippet={() => {}}
        onPasteSequence={() => {}}
        onClose={() => {}}
        onToggleFavorite={() => {}}
      />
    </I18nProvider></StrictMode>,
  );
  if (automated) await act(async () => render());
  else render();
}

export async function checkPins(check: Check, calls: string[]) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(`#frame-${FRAME} ${selector}`);
  const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(`#frame-${FRAME} ${selector}`)];
  const previews = () => $$(".clipboard-popup__item").map((row) => row.querySelector(".clipboard-popup__preview")?.textContent ?? "");
  const index = (row: number) => $$(".clipboard-popup__item")[row].querySelector(".clipboard-popup__index")?.textContent;
  const press = (target: EventTarget, init: KeyboardEventInit) => act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
  const input = () => $<HTMLInputElement>("input")!;
  const last = () => calls[calls.length - 1] ?? "";

  check(previews()[0] === "下午三点的会议改到四点" && previews()[1].startsWith("pnpm test") && previews()[2].startsWith("主题从此"), "「全部」里收藏的条目排在最上面：排过序的在前，旧数据没有顺序的按复制时间跟在后面");
  check($(".clipboard-popup__section")?.textContent === "固定" && $$(".clipboard-popup__divider").length === 1, "固定区有标题，和其余条目之间一条分隔线");
  check(index(0) === "K" && index(1) === "" && index(2) === "1", "固定的行首显示字母键，数字从第一条不固定的开始");
  check($$(".clipboard-popup__item")[2].classList.contains("clipboard-popup__item--selected"), "打开时选中最近复制的那条，不是固定区第一条：打开就按 Enter 仍是粘贴上一次复制的");
  await press(input(), { key: "1" });
  check(last() === "paste:t1", "数字键 1 粘贴最近复制的那条，跳过固定区");
  await press(input(), { key: "˚", code: "KeyK", altKey: true });
  check(last() === "paste:m1", "Alt/⌥ + 固定键直接粘贴，⌥ 打出的字符不影响");
  const before = calls.length;
  await press(input(), { key: "∫", code: "KeyB", altKey: true });
  check(calls.length === before, "没设的字母不做事");
  await press(input(), { key: "Home" });
  await press(input(), { key: "ArrowDown", altKey: true });
  check(last() === "ipc:set_clipboard_pin_order:{\"ids\":[\"t2\",\"m1\"]}", "Alt + ↓ 把选中的固定条目往下移一位，存下整个顺序");
  await press(input(), { key: "k", ctrlKey: true, metaKey: true });
  const action = $$(".clipboard-panel__action").find((button) => button.dataset.action === "pinKey");
  check(action?.textContent?.includes("设固定键"), "动作面板里有「设固定键…」");
  await act(async () => action!.click());
  const keys = $$(".clipboard-pinkey__key").map((key) => key.textContent ?? "");
  check(keys.length === 22 && !keys.some((key) => ["E", "I", "N", "U"].includes(key)), "设固定键页列出 22 个字母，没有 E、I、N、U");
  await press($(".clipboard-panel input")!, { key: "b", code: "KeyB" });
  check(last().startsWith("ipc:set_clipboard_pin_key:") && last().includes("\"key\":\"B\"") && !$(".clipboard-panel"), "按一个字母就设好，面板关上");
  const rowCount = $$(".clipboard-popup__item").length;
  await press(input(), { key: "k", ctrlKey: true, metaKey: true });
  const recent = $$(".clipboard-panel__action").find((button) => button.dataset.action === "delete-15m");
  check(recent?.textContent?.includes("删除最近 15 分钟的记录") && recent.textContent.includes("3 条，收藏的不删") && $$(".clipboard-panel__action").some((button) => button.dataset.action === "delete-today"), "动作面板「记录」里有删除最近 15 分钟 / 1 小时 / 今天，写着会删几条");
  await act(async () => recent!.click());
  check(last() === "ipc:delete_clipboard_history_items:{\"ids\":[\"t1\",\"i1\",\"t3\"]}" && $$(".clipboard-popup__item").length === rowCount - 3, "删除最近 15 分钟：一次删掉这段时间复制的，收藏的不动");
  check($(".clipboard-popup__undo"), "底栏可以撤销");
  await press(input(), { key: "z", ctrlKey: true, metaKey: true });
  check(last() === "ipc:restore_clipboard_history_items:{\"ids\":[\"t1\",\"i1\",\"t3\"]}" && $$(".clipboard-popup__item").length === rowCount, "Ctrl/⌘+Z 撤销，整批放回");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), "会议");
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  check(!$(".clipboard-popup__section") && !$(".clipboard-popup__divider"), "搜索时不分固定区");
}
