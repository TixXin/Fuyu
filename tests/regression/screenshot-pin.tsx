// pnpm dev, then open /tests/regression/screenshot-pin.html.
// A pin window (C41.4) with the Tauri boundary mocked: it waits hidden for a picture, shows only
// once the PNG is decoded, lifts in, zooms about the pointer, fades with Ctrl + wheel and fades
// out before it closes.
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

    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    check(pin().classList.contains("pin-window--closing") && called("screenshot_pin_close").length === 0, "Esc fades it out first");
    await wait(220);
    check(called("screenshot_pin_close").length === 1, "…then closes the window");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
