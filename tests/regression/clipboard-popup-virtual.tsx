import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { ClipboardPopup } from "../../src/features/clipboard/ClipboardPopup";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;

const FRAME = "virtual";
const COUNT = 300;
const PINNED = 3;
const DAY = 86_400_000;

export async function renderVirtualFrame(host: HTMLElement, calls: string[], automated: boolean) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const noon = now.getTime();
  const items: ClipboardHistoryItem[] = Array.from({ length: COUNT }, (_, index) => ({
    id: `v${index}`,
    kind: "text",
    hash: "",
    createdAt: noon,
    copiedAt: noon - (index < 100 ? index * 60_000 : index < 200 ? DAY + index * 60_000 : 3 * DAY + index * 60_000),
    preview: `第 ${index + 1} 条`,
    text: `第 ${index + 1} 条`,
    favorite: index >= 10 && index < 10 + PINNED,
    pinOrder: index >= 10 && index < 10 + PINNED ? index - 10 : undefined,
  }));
  const wrap = document.createElement("div");
  wrap.innerHTML = "<p class=\"caption\">300 条：只渲染看得见的行</p>";
  const box = document.createElement("div");
  box.className = "frame frame--wide";
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
        wide
        pinFavorites
        onPaste={(id) => calls.push(`paste:${id}`)}
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

export async function checkVirtual(check: Check, calls: string[]) {
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(`#frame-${FRAME} ${selector}`);
  const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(`#frame-${FRAME} ${selector}`)];
  const list = $(".clipboard-popup__list")!;
  const rows = () => $$(".clipboard-popup__item");
  const selected = () => $(".clipboard-popup__item--selected");
  const settle = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });
  const press = (init: KeyboardEventInit) => act(async () => {
    $("input")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
  const inView = (row: HTMLElement | null) => {
    if (!row) return false;
    const box = list.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
  };

  await settle();
  check(rows().length < 60 && $$("[data-pinned]").length === PINNED, `300 条只渲染看得见的几十行（${rows().length} 行），置顶的 3 条都在`);
  const sections = $$(".clipboard-popup__section").map((section) => section.textContent).join("|");
  check(sections === "固定|今天" && $(".clipboard-popup__divider"), `「固定」标题、分隔线和「今天」照常显示（${sections}）`);

  await press({ key: "End" });
  await settle();
  check(selected()?.dataset.index === String(COUNT - 1) && inView(selected()), "End 选到最后一条，它被滚进来");
  list.scrollTop = list.scrollHeight;
  await act(async () => { list.dispatchEvent(new Event("scroll")); });
  await settle();
  const box = list.getBoundingClientRect();
  const last = rows()[rows().length - 1].getBoundingClientRect();
  check(rows()[rows().length - 1].dataset.index === String(COUNT - 1) && Math.abs(box.bottom - last.bottom - 6) <= 2,`滚到底时最后一行贴着底边（差 ${(box.bottom - last.bottom).toFixed(1)}px），占位高度和真实行高一致`);
  for (let step = 0; step < COUNT - 201; step += 1) await press({ key: "ArrowUp" });
  await settle();
  const heading = selected()?.previousElementSibling;
  check(selected()?.dataset.index === "200" && heading?.textContent === "更早" && inView(selected()), "↑ 回到第 201 条，它上面是「更早」分段");

  await press({ key: "Home" });
  await settle();
  check(selected()?.dataset.index === "0" && inView(selected()) && list.scrollTop <= 1, "Home 回到第一条，列表回到顶上");

  for (let step = 0; step < 40; step += 1) await press({ key: "ArrowDown" });
  await settle();
  check(selected()?.dataset.index === "40" && inView(selected()), "连按 ↓ 40 次，选中的行一直在视野里");

  list.scrollTop = list.scrollHeight / 2;
  await act(async () => { list.dispatchEvent(new Event("scroll")); });
  await settle();
  const middle = rows().find((row) => inView(row) && !row.dataset.pinned);
  check(middle && Number(middle.dataset.index) > 100, `滚轮滚到中间，看得见的行跟着换（第 ${middle?.dataset.index} 行）`);
  await act(async () => { middle!.querySelector<HTMLElement>(".clipboard-popup__row")!.click(); });
  const picked = Number(middle!.querySelector(".clipboard-popup__preview")!.textContent!.replace(/\D/g, "")) - 1;
  check(calls[calls.length - 1] === `paste:v${picked}`, `点中间的行粘贴的就是那一条（v${picked}）`);
}
