import { act } from "react";
import { emit } from "@tauri-apps/api/event";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

type Check = (condition: unknown, label: string) => void;
type Point = { x: number; y: number };

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
const editor = () => $("#frame .clipboard-image-editor");
const stage = () => $<HTMLDivElement>("#frame .clipboard-image-editor__stage");
const tools = () => [...document.querySelectorAll<HTMLButtonElement>("#frame .clipboard-image-editor__tool")];
const tool = (label: string) => tools().find((button) => button.getAttribute("aria-label")?.startsWith(label)) ?? null;
const size = () => `${stage()?.style.width} x ${stage()?.style.height}`;
const click = (element: HTMLElement | null) => act(async () => { element!.click(); });
const editInPreview = () => act(async () => { await emit("clipboard-preview-command", { type: "edit" }); });
const key = (init: KeyboardEventInit) => act(async () => {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
});

async function picture() {
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 30;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#d33";
  context.fillRect(0, 0, 20, 30);
  context.fillStyle = "#36c";
  context.fillRect(20, 0, 20, 30);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((made) => resolve(made!), "image/png"));
  return blob.arrayBuffer();
}

export function imageEditInvoke(command: string, args: unknown, options: unknown, calls: string[]): Promise<unknown> | undefined {
  if (command === "read_clipboard_history_image") {
    calls.push(`${command}:${JSON.stringify(args)}`);
    return picture();
  }
  if (command === "save_clipboard_history_image") {
    const headers = (options as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    calls.push(`${command}:${JSON.stringify({ ...headers, bytes: (args as Uint8Array).byteLength })}`);
    return Promise.resolve(null);
  }
  return undefined;
}

async function ready() {
  for (let tries = 0; tries < 50 && !stage(); tries += 1) await settle();
}

function drag(from: Point, to: Point) {
  const element = stage()!;
  const rect = element.getBoundingClientRect();
  const width = parseFloat(element.style.width);
  const height = parseFloat(element.style.height);
  const client = (point: Point) => ({ clientX: rect.left + (point.x * rect.width) / width, clientY: rect.top + (point.y * rect.height) / height });
  const fire = (type: string, point: Point) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 7, ...client(point) }));
  return act(async () => {
    fire("pointerdown", from);
    fire("pointermove", { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
    fire("pointermove", to);
    fire("pointerup", to);
  });
}

export async function checkImageEdit(check: Check, calls: string[], image: ClipboardHistoryItem, send: (item: ClipboardHistoryItem) => Promise<void>) {
  const since = (mark: number) => calls.slice(mark);
  const editing = (on: boolean) => `set_clipboard_preview_editing:${JSON.stringify({ editing: on, then: "refocus" })}`;
  const saved = (mark: number) => since(mark).filter((call) => call.startsWith("save_clipboard_history_image"));
  const edited = (mark: number) => since(mark).some((call) => call.includes("clipboard-preview-report") && call.includes('"edited"'));

  await send(image);
  let mark = calls.length;
  await click($("#frame .clipboard-preview__icon[aria-label='编辑图片']"));
  check(editor() && since(mark).includes(editing(true)) && since(mark).includes(`read_clipboard_history_image:${JSON.stringify({ id: image.id })}`), "点「编辑图片」：换成图片编辑器，向 Rust 要键盘和原图");
  await ready();
  check(size() === "40px x 30px" && $("#frame .clipboard-image-editor__picture canvas"), "原图按自己的像素画进编辑区");
  check(tool("裁剪") && tool("向左转") && tool("向右转") && tools().length === 13, "工具栏有裁剪、左右旋转、截图的八种标注和撤销重做");
  const buttons = [...document.querySelectorAll("#frame .clipboard-image-editor .clipboard-editor__buttons kbd")].map((kbd) => kbd.textContent).join("|");
  check(buttons.match(/S\|.*⇧ S\|Esc/), "底部和编辑文字一样：改这条、另存一条、取消，写着各自的键");
  check($("#frame .clipboard-preview__hint")?.textContent?.includes("Esc"), "编辑时顶栏提示 Esc 退出");

  mark = calls.length;
  await key({ key: "s", ctrlKey: true });
  await settle();
  check(!editor() && saved(mark).length === 0 && since(mark).includes(editing(false)), "什么都没改时 Ctrl+S 只退出，不存");

  await editInPreview();
  await ready();
  await click(tool("向右转"));
  check(size() === "30px x 40px", "向右转：宽高对调");
  await key({ key: "z", ctrlKey: true });
  check(size() === "40px x 30px", "Ctrl+Z 撤销旋转");

  await click(tools()[3]);
  check(document.querySelectorAll("#frame .clipboard-image-editor__swatch").length === 8, "选了标注工具后出现粗细和八种颜色");
  await drag({ x: 5, y: 5 }, { x: 30, y: 20 });
  mark = calls.length;
  await key({ key: "s", ctrlKey: true });
  await settle();
  check(saved(mark)[0]?.endsWith(JSON.stringify({ "x-id": image.id, "x-width": "40", "x-height": "30", "x-mode": "replace", bytes: 40 * 30 * 4 })), "画了框再 Ctrl+S：整张图的像素交给 Rust 改这条");
  check(edited(mark) && !editor(), "改好后告诉剪贴板窗口显示撤销，退出编辑");

  await editInPreview();
  await ready();
  await click(tool("裁剪"));
  check($("#frame .clipboard-image-editor__hint") && tool("裁剪")?.getAttribute("aria-pressed") === "true", "点裁剪：提示拖出要留下的部分");
  await drag({ x: 4, y: 4 }, { x: 24, y: 19 });
  check($("#frame .clipboard-image-editor__crop"), "拖出的范围外面变暗");
  await key({ key: "Enter" });
  check(size() === "20px x 15px", "回车应用裁剪");
  mark = calls.length;
  await key({ key: "S", ctrlKey: true, shiftKey: true });
  await settle();
  check(saved(mark)[0]?.endsWith(JSON.stringify({ "x-id": image.id, "x-width": "20", "x-height": "15", "x-mode": "new", bytes: 20 * 15 * 4 })) && !edited(mark), "Ctrl+Shift+S 另存一条，原来的不动、不显示撤销");

  await editInPreview();
  await ready();
  await click(tool("向左转"));
  mark = calls.length;
  await key({ key: "Escape" });
  check(!editor() && saved(mark).length === 0 && since(mark).includes(editing(false)), "Esc 放弃改动、退出编辑");
}
