import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { PinWindow } from "../../src/windows/screenshot/PinWindow";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const WIDTH = 120;
const HEIGHT = 80;
const source = document.createElement("canvas");
source.width = WIDTH;
source.height = HEIGHT;
const paint = source.getContext("2d")!;
paint.fillStyle = "#3366cc";
paint.fillRect(0, 0, WIDTH, HEIGHT);
const png = await new Promise<ArrayBuffer>((resolve) => source.toBlob((blob) => void blob!.arrayBuffer().then(resolve), "image/png"));

const calls: { command: string; payload: unknown }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, payload });
  switch (command) {
    case "screenshot_pin_info": return null;
    case "screenshot_pin_image": return png;
    case "screenshot_pin_text": return "";
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("pin-1");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <PinWindow />
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
const called = (command: string) => calls.filter((call) => call.command === command);
const pin = () => document.querySelector<HTMLElement>(".pin-window")!;
const frame = () => document.querySelector<HTMLElement>(".pin-window__frame");
const key = (init: KeyboardEventInit) => act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); });
const press = (target: Element, type: string, x: number, y: number, extra: PointerEventInit = {}) =>
  act(async () => { target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, pointerId: 1, isPrimary: true, ...extra })); });
const wheel = (init: WheelEventInit) => act(async () => { frame()!.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init })); });

async function runChecks() {
  try {
    await wait(100);
    check(!frame() && called("screenshot_pin_ready").length === 0, "A ready pin window with no picture yet shows nothing and stays hidden");

    await act(async () => { await emit("screenshot-pin-assigned", { width: WIDTH, height: HEIGHT }); });
    for (let tries = 0; tries < 50 && called("screenshot_pin_ready").length === 0; tries += 1) await wait(20);
    const image = document.querySelector<HTMLImageElement>(".pin-window__picture");
    check(image?.complete && image.naturalWidth === WIDTH, "Given a picture, it fetches the PNG and decodes it");
    check(called("screenshot_pin_ready").length === 1, "…and only then asks to be shown");
    await wait(20);
    check(pin().classList.contains("pin-window--shown"), "Once shown it lifts: the class that grows its shadow is on");

    const box = frame()!.getBoundingClientRect();
    await wheel({ deltaY: 100, clientX: box.left + box.width / 4, clientY: box.top + box.height / 2 });
    const zoom = called("screenshot_pin_zoom").slice(-1)[0]?.payload as { scale: number; anchorX: number; anchorY: number } | undefined;
    check(zoom && Math.abs(zoom.scale - 1 / 1.1) < 1e-6 && Math.abs(zoom.anchorX - 0.25) < 0.01 && Math.abs(zoom.anchorY - 0.5) < 0.01, "The wheel zooms out about the pointer, measured on the picture, not the shadow margin");

    await wheel({ deltaY: 100, ctrlKey: true });
    check(frame()!.style.opacity === "0.9", "Ctrl + wheel fades it");
    check((called("screenshot_pin_opacity").slice(-1)[0]?.payload as { opacity: number } | undefined)?.opacity === 0.9, "…and tells the native side, so a restart brings the pin back as faint");

    await key({ key: "2" });
    check((called("screenshot_pin_turn").slice(-1)[0]?.payload as { turn: string } | undefined)?.turn === "right", "2 turns it right");
    await key({ key: "3" });
    check((called("screenshot_pin_turn").slice(-1)[0]?.payload as { turn: string } | undefined)?.turn === "flipX", "3 flips it left to right");
    await key({ key: "o" });
    for (let tries = 0; tries < 20 && !document.querySelector(".pin-window__notice")?.textContent?.includes("没有识别到文字"); tries += 1) await wait(20);
    check(called("screenshot_pin_text").length === 1 && document.querySelector(".pin-window__notice")?.textContent?.includes("没有识别到文字"), "O reads the text, and says so when there is none");

    await key({ key: " " });
    const reserved = called("screenshot_pin_reserve").slice(-1)[0]?.payload as { width: number; height: number } | undefined;
    check(reserved && reserved.width > 0 && reserved.height > 0 && pin().classList.contains("pin-window--editing"), "Space opens the annotation bar and asks for room under the picture");
    check(document.querySelectorAll(".pin-annotate__row:first-child .pin-annotate__tool").length === 11, "…with the same eleven tools as a screenshot");
    await key({ key: "r" });
    check(document.querySelector('.pin-annotate__tool[aria-label="矩形（R）"]')?.getAttribute("aria-pressed") === "true", "R picks the rectangle there too");
    const area = document.querySelector<HTMLElement>(".pin-window__annotator")!;
    const spot = area.getBoundingClientRect();
    await press(area, "pointerdown", spot.left + spot.width * 0.1, spot.top + spot.height * 0.1);
    await press(area, "pointermove", spot.left + spot.width * 0.6, spot.top + spot.height * 0.6);
    await press(area, "pointerup", spot.left + spot.width * 0.6, spot.top + spot.height * 0.6);
    const layer = document.querySelector<HTMLCanvasElement>(".pin-window__layer")!;
    const drawn = layer.getContext("2d")!.getImageData(0, 0, layer.width, layer.height).data;
    let inked = 0;
    for (let i = 3; i < drawn.length; i += 4) if (drawn[i] > 0) inked += 1;
    check(inked > 0, "Dragging on the pin draws a rectangle on it");
    check(called("plugin:window|start_dragging").length === 0, "…without moving the window");
    await key({ key: "Enter" });
    const replaced = called("screenshot_pin_replace").slice(-1)[0]?.payload as Uint8Array | undefined;
    check(replaced instanceof Uint8Array && replaced.byteLength === WIDTH * HEIGHT * 4, "Enter burns the annotations into the pin's own pixels");
    check(!pin().classList.contains("pin-window--editing") && (called("screenshot_pin_reserve").slice(-1)[0]?.payload as { width: number }).width === 0, "…and gives the room back");

    await key({ key: " " });
    await key({ key: "Escape" });
    check(!pin().classList.contains("pin-window--editing") && !pin().classList.contains("pin-window--closing"), "Esc while annotating only drops the bar, not the pin");

    const target = frame()!;
    await press(target, "pointerdown", 30, 30);
    await press(target, "pointerdown", 31, 30);
    await wait(20);
    check((called("screenshot_pin_collapse").slice(-1)[0]?.payload as { collapsed: boolean } | undefined)?.collapsed === true && pin().classList.contains("pin-window--collapsed"), "A double click shrinks it to an icon");
    await key({ key: "m" });
    await wait(20);
    check((called("screenshot_pin_collapse").slice(-1)[0]?.payload as { collapsed: boolean } | undefined)?.collapsed === false && !pin().classList.contains("pin-window--collapsed"), "M opens it again");

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    check(pin().classList.contains("pin-window--closing") && called("screenshot_pin_close").length === 0, "Esc fades it out first");
    await wait(220);
    check(called("screenshot_pin_close").length === 1, "…then closes the window");

    for (let tries = 0; tries < 60 && document.querySelector(".pin-window__notice"); tries += 1) await wait(50);
    check(!document.querySelector(".pin-window__notice"), "The notice goes away on its own");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
