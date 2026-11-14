import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { ClipboardPreviewWindow } from "../../src/windows/clipboard/ClipboardPreviewWindow";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";
import type { ClipboardPreviewPayload } from "../../src/features/clipboard/api";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
const calls: string[] = [];
mockIPC((command, args) => {
  calls.push(`${command}:${JSON.stringify(args ?? {})}`);
  return null;
}, { shouldMockEvents: true });
mockConvertFileSrc("windows");

const now = Date.now();
const thumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%232a3350'/%3E%3C/svg%3E";
const base = { hash: "", createdAt: now, favorite: false } as const;
const TEXT: ClipboardHistoryItem = { ...base, id: "t1", kind: "text", copiedAt: now - 20_000, preview: "下午三点的会议改到四点", text: "下午三点的会议改到四点\n地点不变", source: { path: "C:\\weixin.exe", name: "微信" } };
const IMAGE: ClipboardHistoryItem = {
  ...base, id: "i1", kind: "image", copiedAt: now - 60_000, preview: "1348 x 1139 image", ocrText: "外观 主题 浅色和深色",
  image: { width: 1348, height: 1139, byteSize: 384_000, originalPath: "", thumbnailPath: "", thumbnailDataUrl: thumb },
};

const root = createRoot(document.getElementById("frame")!);
const render = () => root.render(<StrictMode><I18nProvider><ClipboardPreviewWindow /></I18nProvider></StrictMode>);
if (automated) await act(async () => render());
else render();

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const frames = () => act(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 20));
});
const send = (item: ClipboardHistoryItem, extra: Partial<ClipboardPreviewPayload> = {}) =>
  act(async () => { await emit("clipboard-preview-item", { item, holding: false, linkPreview: false, prefetch: [], ...extra }); });
const open = (side: "left" | "right") => act(async () => { await emit("clipboard-preview-opened", side); });
const windowClass = () => $(".clipboard-preview-window")?.className ?? "";

async function runChecks() {
  try {
    await frames();
    check(windowClass().includes("--away") && getComputedStyle($(".clipboard-preview")!).opacity === "0", "没打开时面板是透明的，等着滑进来");

    await send(TEXT);
    await open("right");
    check(windowClass().includes("--right"), "放在剪贴板窗口右边：从左往右滑进来");
    await frames();
    check(windowClass().includes("--in") && $(".clipboard-popup__pane-body")?.textContent === TEXT.text, "显示出来后才开始进场动画，内容是这条的全文");
    check($(".clipboard-preview__close")?.textContent?.includes("关闭"), "右上角写「空格 关闭」");

    await send(IMAGE, { holding: true });
    const full = $<HTMLImageElement>(".clipboard-picture__full");
    check(full?.src === "http://fuyu-clip.localhost/i1" && full.decoding === "async" && $(".clipboard-picture__thumb"), "图片：先显示缩略图，原图按记录 id 直接读、后台解码");
    check($(".clipboard-preview__close")?.textContent?.includes("松开关闭"), "按住空格时提示「松开关闭」");
    await act(async () => { full!.dispatchEvent(new Event("load")); });
    check($(".clipboard-picture--ready") && !$(".clipboard-picture__thumb"), "原图解码好后淡入，缩略图拿掉");

    await open("left");
    check(windowClass().includes("--left") && windowClass().includes("--away"), "右边放不下时放在左边，重新打开从头播放进场");
    await frames();
    check(windowClass().includes("--in"), "左边也会滑进来");

    await act(async () => { await emit("clipboard-preview-closing"); });
    check(windowClass().includes("--out"), "关闭时先播放退场动画");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

const results = document.getElementById("results")!;
if (automated) void runChecks();
else {
  results.textContent = "演示：剪贴板预览窗口。加 ?test=1 运行检查。";
  await new Promise((resolve) => setTimeout(resolve, 300));
  await send(IMAGE);
  await open("right");
}
