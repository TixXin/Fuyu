import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/features/clipboard/ClipboardPopup.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { ClipboardPopupPreview } from "../../src/features/clipboard/ClipboardPopupPreview";
import type { ClipboardHistoryItem } from "../../src/features/clipboard/api";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
mockIPC(() => null, { shouldMockEvents: true });
mockConvertFileSrc("windows");

const now = Date.now();
const thumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%232a3350'/%3E%3Ccircle cx='80' cy='45' r='30' fill='%237aa8f5'/%3E%3C/svg%3E";
const image = (id: string): ClipboardHistoryItem => ({
  id, hash: id, kind: "image", createdAt: now, copiedAt: now - 60_000, favorite: false, preview: "1600 x 900 image",
  image: { width: 1600, height: 900, byteSize: 512_000, originalPath: "", thumbnailPath: "", thumbnailDataUrl: thumb },
});

function mount(id: string) {
  const root = createRoot(document.getElementById(id)!);
  return (item: ClipboardHistoryItem, imageZoom: boolean) => root.render(
    <StrictMode><I18nProvider><section className="clipboard-popup"><ClipboardPopupPreview entry={item} imageZoom={imageZoom} /></section></I18nProvider></StrictMode>,
  );
}
const viewer = mount("viewer");
const pane = mount("pane");
const show = (render: typeof viewer, item: ClipboardHistoryItem, imageZoom: boolean) => (automated ? act(async () => render(item, imageZoom)) : Promise.resolve(render(item, imageZoom)));
await show(viewer, image("i1"), true);
await show(pane, image("p1"), false);

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const picture = (frame: string) => document.querySelector<HTMLElement>(`#${frame} .clipboard-picture`)!;
const level = () => document.querySelector("#viewer .clipboard-zoom__level")?.textContent ?? "";
const bar = () => [...document.querySelectorAll<HTMLButtonElement>("#viewer .clipboard-zoom__button")];
const layer = (frame: string) => document.querySelector<HTMLImageElement>(`#${frame} .clipboard-picture__full`)!.style.transform;
const frames = () => act(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 20));
});
const fitPercent = (frame: string) => {
  const rect = picture(frame).getBoundingClientRect();
  return Math.round(Math.min(rect.width / 1600, rect.height / 900) * devicePixelRatio * 100);
};
const at = (frame: string, fx: number, fy: number) => {
  const rect = picture(frame).getBoundingClientRect();
  return { clientX: rect.left + rect.width * fx, clientY: rect.top + rect.height * fy, bubbles: true, cancelable: true };
};
const fire = (frame: string, event: Event) => act(async () => { picture(frame).dispatchEvent(event); });
const command = (zoom: "in" | "out" | "reset") => act(async () => { await emit("clipboard-preview-command", { type: "zoom", zoom }); });

async function checkBar() {
  check(bar().length === 4 && document.querySelector("#viewer .clipboard-zoom")?.getAttribute("aria-label") === "图片缩放", "预览窗口里图片底部有缩放条：缩小、比例、放大、适应、1:1");
  check(level() === `${fitPercent("viewer")}%` && bar()[2].getAttribute("aria-pressed") === "true", "一打开是「适应」，比例按整张图放进框里算");
  check(!picture("viewer").className.includes("--zoomed") && !layer("viewer"), "适应时不加变换，和没有缩放时的样子一样");
  await act(async () => { bar()[3].click(); });
  check(level() === "100%" && picture("viewer").className.includes("--zoomed") && layer("viewer").includes("scale"), "点 1:1 换成原始大小");
  check(picture("viewer").className.includes("--pannable"), "原始大小比框大，可以拖着看");
  await act(async () => { bar()[1].click(); });
  check(Number.parseInt(level(), 10) === 125, "点放大一档是 1.25 倍");
  await act(async () => { bar()[0].click(); });
  check(level() === "100%", "点缩小回到上一档");
  await act(async () => { bar()[2].click(); });
  check(level() === `${fitPercent("viewer")}%` && !layer("viewer"), "点适应回到整张图");
}

async function checkPointer() {
  await fire("viewer", new MouseEvent("dblclick", at("viewer", 0.25, 0.5)));
  check(level() === "100%", "双击：从适应切到原始大小");
  const before = layer("viewer");
  await fire("viewer", new PointerEvent("pointerdown", { ...at("viewer", 0.5, 0.5), pointerId: 1, button: 0, isPrimary: true }));
  await fire("viewer", new PointerEvent("pointermove", { ...at("viewer", 0.3, 0.4), pointerId: 1, isPrimary: true }));
  await fire("viewer", new PointerEvent("pointerup", { ...at("viewer", 0.3, 0.4), pointerId: 1, isPrimary: true }));
  check(layer("viewer") !== before && level() === "100%", "放大后按住拖动是平移，比例不变");
  await fire("viewer", new MouseEvent("dblclick", at("viewer", 0.5, 0.5)));
  check(level() === `${fitPercent("viewer")}%` && !layer("viewer"), "再双击回到适应");

  await fire("viewer", new WheelEvent("wheel", { ...at("viewer", 0.8, 0.2), deltaY: -120, deltaMode: 0 }));
  const zoomed = Number.parseInt(level(), 10);
  check(zoomed > fitPercent("viewer") && picture("viewer").className.includes("--zoomed"), "滚轮向上放大");
  const wheel = new WheelEvent("wheel", { ...at("viewer", 0.8, 0.2), deltaY: 120, deltaMode: 0 });
  await fire("viewer", wheel);
  check(wheel.defaultPrevented && Number.parseInt(level(), 10) < zoomed, "滚轮向下缩小，不让页面跟着滚");
  await fire("viewer", new WheelEvent("wheel", { ...at("viewer", 0.5, 0.5), deltaY: -10, deltaMode: 0, ctrlKey: true }));
  check(Number.parseInt(level(), 10) > fitPercent("viewer"), "触控板捏合（带 Ctrl 的滚轮）也缩放");
}

async function checkCommands() {
  await command("reset");
  const fit = level();
  await command("in");
  check(Number.parseInt(level(), 10) > Number.parseInt(fit, 10), "剪贴板窗口转来的 + 放大");
  await command("out");
  check(level() === fit, "转来的 - 缩小");
  await command("in");
  await command("reset");
  check(level() === fit && !layer("viewer"), "转来的 0 回到适应");
  await command("in");
  await show(viewer, image("i2"), true);
  check(level() === `${fitPercent("viewer")}%` && !layer("viewer"), "换一条记录时回到适应");
}

async function checkPane() {
  check(!document.querySelector("#pane .clipboard-zoom"), "宽版右栏不出缩放条");
  const wheel = new WheelEvent("wheel", { ...at("pane", 0.5, 0.5), deltaY: -120, deltaMode: 0 });
  await fire("pane", wheel);
  check(!wheel.defaultPrevented && !layer("pane"), "右栏的滚轮不缩放");
  await fire("pane", new MouseEvent("dblclick", at("pane", 0.5, 0.5)));
  check(picture("pane").className.includes("--zoomed") && layer("pane").includes("scale"), "右栏双击也能看原始大小");
  await fire("pane", new MouseEvent("dblclick", at("pane", 0.5, 0.5)));
  check(!layer("pane"), "右栏再双击回到适应");
  await command("in");
  check(!layer("pane"), "右栏不接预览窗口的缩放命令");
}

async function runChecks() {
  try {
    await frames();
    await checkBar();
    await checkPointer();
    await checkCommands();
    await checkPane();
    await command("reset");
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

const results = document.getElementById("results")!;
if (automated) void runChecks();
else results.textContent = "演示：左边是预览窗口里的图片（滚轮、拖动、双击、缩放条），右边是宽版右栏（只有双击）。加 ?test=1 运行检查。";
