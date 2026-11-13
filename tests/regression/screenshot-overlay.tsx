import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { ScreenshotOverlay } from "../../src/windows/screenshot/ScreenshotOverlay";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const calls: { command: string; payload: unknown; headers: Record<string, string> }[] = [];
mockIPC((command) => {
  switch (command) {
    case "screenshot_session": return { id: 1, mode: "region", width: WIDTH, height: HEIGHT, underPointer: true };
    case "screenshot_frame": return new Uint8Array(WIDTH * HEIGHT * 4).map((_, index) => (index % 4 === 3 ? 255 : 128)).buffer;
    case "screenshot_targets": return [];
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("screenshot-0");
type Internals = { invoke: (command: string, payload: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown> };
const internals = (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
const mockedInvoke = internals.invoke;
internals.invoke = (command, payload, options) => {
  calls.push({ command, payload, headers: options?.headers ?? {} });
  return mockedInvoke(command, payload, options);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ScreenshotOverlay />
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
const overlay = () => document.querySelector<HTMLElement>(".screenshot-overlay")!;
const pointer = (type: string, x: number, y: number, button = 0) =>
  act(async () => { overlay().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button, pointerId: 1, isPrimary: true })); });
const drag = async (from: [number, number], to: [number, number]) => {
  await pointer("pointerdown", ...from);
  await pointer("pointermove", (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  await pointer("pointermove", ...to);
  await pointer("pointerup", ...to);
};
const key = (init: KeyboardEventInit, target: EventTarget = window) => act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); });
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.screenshot-overlay__toolbar button[aria-label="${label}"]`);
const click = (label: string) => act(async () => { button(label)!.click(); });
const layerPixel = (x: number, y: number) => {
  const data = document.querySelector<HTMLCanvasElement>(".screenshot-overlay__annotations")!.getContext("2d")!.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
};
const isRed = ([r, g, b, a]: number[]) => a > 200 && r > 200 && g < 90 && b < 90;
const last = (command: string) => [...calls].reverse().find((call) => call.command === command);
const typeInto = (box: HTMLTextAreaElement, text: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
});

async function runChecks() {
  try {
    for (let tries = 0; tries < 50 && !calls.some((call) => call.command === "screenshot_overlay_ready"); tries += 1) await wait(20);
    check(document.querySelector<HTMLCanvasElement>(".screenshot-overlay__picture")?.width === WIDTH, "The frozen picture is drawn at the monitor's size, then the overlay says it is ready");

    await drag([40, 40], [240, 200]);
    check(document.querySelectorAll(".screenshot-overlay__toolbar button[aria-pressed]").length === 8, "A chosen region gets the toolbar with the eight annotation tools");
    check(button("撤销（Ctrl+Z）")?.disabled && button("重做（Ctrl+Y）")?.disabled, "Undo and redo start disabled");
    await key({ key: "Enter" });
    const plain = last("screenshot_finish");
    check(plain?.headers["x-action"] === "copy" && plain.headers["x-left"] === "40" && plain.headers["x-width"] === "200" && plain.headers["x-height"] === "160", "Enter copies the region");
    check((plain?.payload as Uint8Array).byteLength === 0, "…without sending its pixels: the native side cuts them from the frozen picture");
    await key({ key: "s", ctrlKey: true });
    const saved = last("screenshot_finish");
    check(saved?.headers["x-action"] === "save" && decodeURIComponent(saved.headers["x-folder-name"]) === "浮屿截图", "Ctrl+S saves it, to the Pictures subfolder named in the current language");
    check(button("贴到屏幕上（T）") && button("保存（Ctrl+S）"), "The toolbar has pin and save buttons");
    await click("识别文字");
    check(last("screenshot_finish")?.headers["x-action"] === "text", "Read text sends the region to OCR");

    await click("矩形");
    check(button("矩形")?.getAttribute("aria-pressed") === "true" && document.querySelectorAll(".screenshot-overlay__swatch").length === 8, "Choosing the rectangle shows the colours and thicknesses");
    const bar = document.querySelector<HTMLElement>(".screenshot-overlay__toolbar")!.getBoundingClientRect();
    check(bar.left >= 0 && bar.right <= WIDTH, "The toolbar, wider than this small selection, stays on the monitor");
    await drag([60, 60], [120, 120]);
    check(isRed(layerPixel(60, 90)), "A drag inside the selection draws a red rectangle");
    check(document.querySelector(".screenshot-overlay__selection")?.getAttribute("style")?.includes("left: 40px"), "…without moving the selection");
    check(!isRed(layerPixel(20, 20)), "Nothing is drawn outside the selection");

    await key({ key: "z", ctrlKey: true });
    check(layerPixel(60, 90)[3] === 0, "Ctrl+Z takes the rectangle away");
    await key({ key: "y", ctrlKey: true });
    check(isRed(layerPixel(60, 90)), "Ctrl+Y brings it back");

    await click("文字");
    await pointer("pointerdown", 100, 150);
    await pointer("pointerup", 100, 150);
    await wait(10);
    const box = document.querySelector<HTMLTextAreaElement>(".screenshot-overlay__text-input");
    check(box, "A click with the text tool opens a text box there");
    await typeInto(box!, "截图");
    await key({ key: "Enter" }, box!);
    check(!document.querySelector(".screenshot-overlay__text-input"), "Enter keeps the text and closes the box");
    let drawn = false;
    for (let x = 100; x < 140 && !drawn; x += 1) drawn = isRed(layerPixel(x, 160));
    check(drawn, "…and the text is drawn where the box was");

    await pointer("pointerdown", 150, 175);
    await pointer("pointerup", 150, 175);
    await wait(10);
    const second = document.querySelector<HTMLTextAreaElement>(".screenshot-overlay__text-input");
    await key({ key: "Escape" }, second!);
    check(!document.querySelector(".screenshot-overlay__text-input") && !last("screenshot_cancel"), "Esc in a text box drops it without leaving the screenshot");

    await click("序号");
    await pointer("pointerdown", 210, 70);
    await pointer("pointerup", 210, 70);
    check(isRed(layerPixel(205, 70)), "A click with the number tool places a badge");

    await act(async () => { overlay().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 150, clientY: 150 })); });
    check(!document.querySelector('.screenshot-overlay__toolbar button[aria-pressed="true"]') && document.querySelector(".screenshot-overlay__selection"), "A right click turns the tool off and keeps the selection");

    await key({ key: "Enter" });
    const annotated = last("screenshot_finish");
    const composed = annotated?.payload as Uint8Array | undefined;
    const patch = ["x-patch-left", "x-patch-top", "x-patch-width", "x-patch-height"].map((name) => Number(annotated?.headers[name]));
    const [patchLeft, patchTop, patchWidth, patchHeight] = patch;
    check(composed instanceof Uint8Array && composed.byteLength === patchWidth * patchHeight * 4 && patchWidth * patchHeight < 200 * 160, `With annotations Enter sends only the part they cover, as raw pixels (${patch.join(", ")})`);
    check(annotated?.headers["x-width"] === "200" && patchLeft + patchWidth <= 200 && patchTop + patchHeight <= 160, "…inside the selection, which the native side cuts itself");
    const at = (x: number, y: number) => {
      const index = ((y - 40 - patchTop) * patchWidth + (x - 40 - patchLeft)) * 4;
      return Array.from(composed!.slice(index, index + 4));
    };
    check(isRed(at(60, 90)) && at(80, 90).join() === "128,128,128,255", `…the rectangle drawn on the frozen picture (${at(60, 90).join()} / ${at(80, 90).join()})`);

    await key({ key: "t" });
    const pinned = last("screenshot_finish");
    check(pinned?.headers["x-action"] === "pin" && pinned.headers["x-left"] === "40" && pinned.headers["x-top"] === "40", "T pins it where the selection is");
    check(!document.querySelector(".screenshot-overlay__toolbar") && !document.querySelector(".screenshot-overlay__handle"), "…and while the pin takes over, only the picture stays: no toolbar, no handles");

    const before = calls.filter((call) => call.command === "screenshot_finish").length;
    await act(async () => { await emit("screenshot-ended"); });
    await act(async () => { await emit("screenshot-session", { id: 2, mode: "copy", width: WIDTH, height: HEIGHT, underPointer: true }); });
    for (let tries = 0; tries < 50 && calls.filter((call) => call.command === "screenshot_overlay_ready").length < 2; tries += 1) await wait(20);
    check(document.querySelector(".screenshot-overlay__hint")?.textContent?.includes("选好就复制"), "Ctrl+Shift+2 says the region is copied once chosen");
    await drag([300, 100], [400, 180]);
    const quick = calls.filter((call) => call.command === "screenshot_finish");
    check(quick.length === before + 1 && quick[quick.length - 1].headers["x-action"] === "copy", "…copies it as the drag ends");
    check(!document.querySelector(".screenshot-overlay__toolbar"), "…without the toolbar");

    await act(async () => { await emit("screenshot-ended"); });
    await act(async () => { await emit("screenshot-session", { id: 3, mode: "region", width: WIDTH, height: HEIGHT, underPointer: true }); });
    for (let tries = 0; tries < 50 && calls.filter((call) => call.command === "screenshot_overlay_ready").length < 3; tries += 1) await wait(20);
    await drag([60, 60], [260, 300]);
    await click("长截图（自动往下滚动拼接，也可以自己滚）");
    const longStart = last("screenshot_finish");
    check(longStart?.headers["x-action"] === "long" && longStart.headers["x-width"] === "200", "The long-screenshot button sends the selection off to be scrolled");
    check(document.querySelector(".screenshot-overlay__toolbar"), "…and nothing goes away until the native side starts");
    await act(async () => { await emit("screenshot-long", "screenshot-0"); });
    await wait(30);
    const ready = document.querySelector<HTMLElement>(".long-shot-bar");
    check(ready?.classList.contains("long-shot-bar--ready") && ready.querySelector('button[aria-label="开始自动滚动（空格）"]') && !calls.some((call) => call.command === "screenshot_long_pause"), "The long screenshot waits for Space or ▶ instead of scrolling by itself");
    await act(async () => { await emit("screenshot-long-progress", { state: "scrolling", height: 1240, frames: 3, preview: null }); });
    await wait(30);
    const longBar = document.querySelector<HTMLElement>(".long-shot-bar");
    check(longBar && overlay().classList.contains("screenshot-overlay--long") && document.querySelector(".screenshot-overlay__selection--long"), "Once it starts, the frame stays on screen with its own control bar");
    check(!document.querySelector(".screenshot-overlay__toolbar") && !document.querySelector(".screenshot-overlay__handle"), "…in place of the toolbar and the handles");
    check(getComputedStyle(document.querySelector(".screenshot-overlay__picture")!).visibility === "hidden", "…and the frozen picture steps aside so the live page shows through");
    check(longBar!.textContent?.includes("1,240") && longBar!.textContent?.includes("3 屏"), "The bar shows the height so far and how many screens");
    check(calls.some((call) => call.command === "screenshot_long_bar"), "…and tells the native side where it is, so it can be clicked");
    await act(async () => { longBar!.querySelector<HTMLButtonElement>('button[aria-label="暂停自动滚动（空格）"]')!.click(); });
    check(calls.some((call) => call.command === "screenshot_long_pause"), "Pause asks the native side to stop scrolling");
    await act(async () => { await emit("screenshot-long-progress", { state: "end", height: 2400, frames: 5, preview: null }); });
    check(longBar!.classList.contains("long-shot-bar--end") && longBar!.querySelector('button[aria-label="继续自动滚动（空格）"]'), "At the end it says so and offers to resume");
    const finishes = calls.filter((call) => call.command === "screenshot_finish").length;
    await key({ key: "Enter" });
    const ended = calls.filter((call) => call.command === "screenshot_long_end");
    check(ended.length === 1 && JSON.stringify(ended[0].payload).includes('"action":"copy"'), "Enter finishes and copies the long picture");
    check(calls.filter((call) => call.command === "screenshot_finish").length === finishes, "…without the overlay's own Enter copying the frozen selection");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
