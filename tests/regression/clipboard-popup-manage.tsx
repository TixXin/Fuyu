import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { ClipboardManager } from "../../src/features/clipboard/ClipboardManager";
import { ClipboardPopup } from "../../src/features/clipboard/ClipboardPopup";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;

const MANY = 500;

function manyItems(templates: readonly ClipboardHistoryItem[]): ClipboardHistoryItem[] {
  return Array.from({ length: MANY }, (_, index) => {
    const template = templates[index % templates.length];
    return { ...template, id: `m${index}`, copiedAt: template.copiedAt - index * 60_000, favorite: index === 3, preview: `${template.preview} ${index}` };
  });
}

function frame(host: HTMLElement, id: string, caption: string, className: string) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="caption">${caption}</p>`;
  const box = document.createElement("div");
  box.className = `frame ${className}`;
  box.id = `frame-${id}`;
  wrap.append(box);
  host.append(wrap);
  return createRoot(box);
}

export async function renderManageFrames(host: HTMLElement, templates: readonly ClipboardHistoryItem[], calls: string[], automated: boolean) {
  const items = manyItems(templates);
  const manager = frame(host, "manage", `管理视图（${MANY} 条）`, "frame--manage");
  const popup = frame(host, "many", `标准窗口（${MANY} 条）`, "frame--standard");
  const render = () => {
    manager.render(
      <StrictMode><I18nProvider>
        <ClipboardManager items={items} onToggleFavorite={(id) => calls.push(`star:${id}`)} onCollapse={() => calls.push("collapse")} />
      </I18nProvider></StrictMode>,
    );
    popup.render(
      <StrictMode><I18nProvider>
        <ClipboardPopup items={items} snippets={[]} openCount={0} wide={false} onPaste={() => {}} onPasteSnippet={() => {}} onPasteSequence={() => {}} onClose={() => {}} onToggleFavorite={() => {}} />
      </I18nProvider></StrictMode>,
    );
  };
  if (automated) await act(async () => render());
  else render();
}

export async function checkManager(check: Check, calls: string[]) {
  const $ = <T extends HTMLElement = HTMLElement>(frameId: string, selector: string) => document.querySelector<T>(`#frame-${frameId} ${selector}`);
  const $$ = (frameId: string, selector: string) => [...document.querySelectorAll<HTMLElement>(`#frame-${frameId} ${selector}`)];
  const rows = () => $$("manage", ".clipboard-manage__row");
  const row = (index: number) => $("manage", `.clipboard-manage__row[data-index="${index}"]`)!;
  const count = () => $("manage", ".clipboard-manage__count")?.textContent ?? "";
  const clickRow = (index: number, init: MouseEventInit = {}) => act(async () => {
    row(index).querySelector<HTMLElement>(".clipboard-manage__main")!.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
  });
  const key = (frameId: string, init: KeyboardEventInit) => act(async () => {
    $(frameId, "input")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
  const typeTimed = async (frameId: string, value: string) => {
    const input = $<HTMLInputElement>(frameId, "input")!;
    const started = performance.now();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return performance.now() - started;
  };
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

  check(rows().length > 0 && rows().length < 60 && count() === `${MANY} 条`, `管理视图：${MANY} 条只渲染看得见的 ${rows().length} 行，条数写在上面`);
  check($("manage", ".clipboard-popup__pane-body")?.textContent?.startsWith("主题从此不包含"), "右边是选中这条的完整内容");

  await clickRow(1);
  await clickRow(4, { shiftKey: true });
  check(count().startsWith("已选 4 条") && count().includes("含 1 条收藏") && rows().filter((element) => element.getAttribute("aria-selected") === "true").length === 4, "点第 2 条、Shift+点第 5 条：选中一段 4 条，提示其中有 1 条收藏");
  await clickRow(2, { ctrlKey: true, metaKey: true });
  check(count().startsWith("已选 3 条") && row(2).getAttribute("aria-selected") === "false", "Ctrl/⌘+点击去掉其中一条");
  await act(async () => { row(7).querySelector<HTMLElement>(".clipboard-manage__check")!.click(); });
  check(count().startsWith("已选 4 条") && row(7).getAttribute("aria-selected") === "true", "点勾选框加选，不清掉已选的");

  const before = calls.length;
  await key("manage", { key: "Delete" });
  const deleted = calls.slice(before).find((call) => call.startsWith("ipc:delete_clipboard_history_items:"));
  check(deleted === `ipc:delete_clipboard_history_items:${JSON.stringify({ ids: ["m1", "m3", "m4", "m7"] })}`, "Del 一次删掉选中的 4 条（按列表顺序）");
  check(count() === `${MANY - 4} 条` && $("manage", ".clipboard-popup__toast-text")?.textContent === "已删除 4 条" && !$$("manage", ".clipboard-manage__row").some((element) => element.dataset.index && ["m1", "m3"].includes(element.textContent ?? "")), "删掉的从列表消失，底栏「已删除 4 条」可以撤销");
  await key("manage", { key: "z", ctrlKey: true, metaKey: true });
  check(calls.some((call) => call === `ipc:restore_clipboard_history_items:${JSON.stringify({ ids: ["m1", "m3", "m4", "m7"] })}`) && count() === `${MANY} 条`, "Ctrl/⌘+Z 撤销，4 条一起放回");

  await key("manage", { key: "a", ctrlKey: true, metaKey: true });
  check(count().startsWith(`已选 ${MANY} 条`) && $("manage", '.clipboard-manage__bar .clipboard-manage__check[aria-checked="true"]'), "Ctrl/⌘+A 全选当前筛选结果");
  await key("manage", { key: "Escape" });
  check(count() === `${MANY} 条` && !calls.includes("collapse"), "Esc 先取消选择，不收起");

  await key("manage", { key: "ArrowDown" });
  await key("manage", { key: "ArrowDown", shiftKey: true });
  await key("manage", { key: "ArrowDown", shiftKey: true });
  check(count().startsWith("已选 3 条"), "Shift+↓ 从当前这条往下扩选");
  await key("manage", { key: "Escape" });

  const managerSearch = await typeTimed("manage", "会议");
  await settle();
  check(count() !== `${MANY} 条` && rows().length > 0 && rows().every((element) => element.textContent?.includes("会议")), `管理视图搜索「会议」只剩匹配的（输入到列表更新 ${managerSearch.toFixed(0)} ms）`);
  await key("manage", { key: "a", ctrlKey: true, metaKey: true });
  const matched = Number(/\d+/.exec(count())?.[0]);
  check(matched === MANY / 10, `搜索后 Ctrl/⌘+A 只选搜到的 ${matched} 条`);
  await key("manage", { key: "Escape" });
  await typeTimed("manage", "");
  await settle();

  await act(async () => { const list = $("manage", ".clipboard-manage__list")!; list.scrollTop = 46 * 300; list.dispatchEvent(new Event("scroll")); });
  check(row(300) && !row(0), "滚到中间：渲染的行跟着换，开头的行不在页面上");

  const popupSearch = await typeTimed("many", "会议");
  const popupClear = await typeTimed("many", "");
  check(popupSearch < 400 && popupClear < 800, `标准窗口 ${MANY} 条：搜索 ${popupSearch.toFixed(0)} ms、清空后全部重画 ${popupClear.toFixed(0)} ms`);

  await key("manage", { key: "Escape" });
  check(calls.includes("collapse"), "没选中、没搜索时 Esc 收起管理视图");
}
