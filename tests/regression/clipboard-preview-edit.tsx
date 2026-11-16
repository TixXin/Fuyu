import { act } from "react";
import { emit } from "@tauri-apps/api/event";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const textarea = () => $<HTMLTextAreaElement>("#frame .clipboard-preview__editor textarea");
const popupInput = () => $<HTMLInputElement>("#popup input")!;
const key = (target: HTMLElement, init: KeyboardEventInit) => act(async () => {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
});
const editInPreview = () => act(async () => { await emit("clipboard-preview-command", { type: "edit" }); });
const editButton = () => $<HTMLButtonElement>("#frame .clipboard-preview__icon[aria-label='编辑文字']");

function type(value: string) {
  const area = textarea()!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  return act(async () => {
    setter.call(area, value);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export async function checkEdit(check: Check, calls: string[], text: ClipboardHistoryItem, image: ClipboardHistoryItem, send: (item: ClipboardHistoryItem) => Promise<void>) {
  const since = (mark: number) => calls.slice(mark);
  const editing = (on: boolean, then = "refocus") => `set_clipboard_preview_editing:${JSON.stringify({ editing: on, then })}`;

  await send(image);
  check(!editButton() && $("#frame .clipboard-preview__icon[aria-label='编辑图片']"), "图片的编辑按钮写「编辑图片」，不是编辑文字");

  await send(text);
  let mark = calls.length;
  await editInPreview();
  check(textarea()?.value === text.text && since(mark).includes(editing(true)), "收到编辑命令：预览换成编辑框，向 Rust 要键盘");
  check($("#frame .clipboard-preview__hint")?.textContent?.includes("Esc"), "编辑时顶栏提示 Esc 退出");
  check(editButton()?.getAttribute("aria-pressed") === "true", "编辑按钮是按下的");
  check([...document.querySelectorAll("#frame .clipboard-editor__buttons kbd")].map((kbd) => kbd.textContent).join("|").match(/S\|.*⇧ S\|.*↵\|Esc/), "按钮上写着改这条、另存、只粘贴这次、取消的键");

  await type("下午四点的会议\n地点不变");
  mark = calls.length;
  await key(textarea()!, { key: "s", ctrlKey: true });
  await settle();
  const saved = since(mark);
  check(saved.includes(`edit_clipboard_history_text:${JSON.stringify({ id: text.id, text: "下午四点的会议\n地点不变" })}`), "Ctrl+S 改这条");
  check(saved.some((call) => call.includes("clipboard-preview-report") && call.includes('"edited"')), "改好后告诉剪贴板窗口，由它显示撤销");
  check(saved.includes(editing(false)) && !textarea() && $("#frame .clipboard-popup__pane-body"), "改完退出编辑、焦点还给剪贴板窗口");

  await act(async () => { editButton()!.click(); });
  mark = calls.length;
  await key(textarea()!, { key: "S", ctrlKey: true, shiftKey: true });
  await settle();
  check(since(mark).some((call) => call.startsWith("add_clipboard_history_text")) && !since(mark).some((call) => call.startsWith("edit_clipboard_history_text")), "Ctrl+Shift+S 另存一条，不改原来的");

  await editInPreview();
  for (const pressed of ["f", "+", "0", " "]) await key(textarea()!, { key: pressed });
  check(textarea(), "编辑时 F、+、0、空格照常打字，不关预览");
  mark = calls.length;
  await key(textarea()!, { key: "Escape" });
  check(!textarea() && since(mark).includes(editing(false)) && !since(mark).some((call) => call.startsWith("edit_clipboard")), "Esc 只退出编辑，不保存也不关预览");

  await editInPreview();
  mark = calls.length;
  await key(textarea()!, { key: "Enter", ctrlKey: true });
  await settle();
  const pasted = since(mark);
  const left = pasted.indexOf(editing(false, "leave"));
  check(left >= 0 && pasted.findIndex((call) => call.startsWith("paste_clipboard_text")) > left, "Ctrl+Enter 先交还键盘（不抢回剪贴板窗口），再只粘贴这次");

  await editInPreview();
  await type("还没写完");
  mark = calls.length;
  await act(async () => { await emit("tauri://blur"); });
  await settle();
  check(!textarea() && since(mark).includes(editing(false, "blur")), "编辑时预览失焦：退出编辑，交给 Rust 判断剪贴板窗口要不要关");
  await editInPreview();
  check(textarea()?.value === "还没写完", "再进编辑时接着刚才没写完的");
  await key(textarea()!, { key: "Escape" });

  mark = calls.length;
  await key(popupInput(), { key: " " });
  await key(popupInput(), { key: "e", ctrlKey: true });
  check(since(mark).some((call) => call.includes("clipboard-preview-command") && call.includes('"edit"')), "剪贴板窗口看预览时按 Ctrl+E：让预览进编辑");
  await act(async () => { await emit("clipboard-preview-report", { type: "edited", id: text.id }); });
  check($("#popup .clipboard-popup__toast-text")?.textContent === "已改这条", "剪贴板窗口底栏显示「已改这条」和撤销");
  mark = calls.length;
  await key(popupInput(), { key: "z", ctrlKey: true });
  check(since(mark).includes(`undo_clipboard_history_edit:${JSON.stringify({ id: text.id })}`) && !$("#popup .clipboard-popup__toast-text"), "Ctrl+Z 撤销刚才的改动");
  await key(popupInput(), { key: "Escape" });
  await send(image);
}
