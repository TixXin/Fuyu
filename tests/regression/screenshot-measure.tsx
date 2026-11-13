import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { ScreenshotOverlay } from "../../src/windows/screenshot/ScreenshotOverlay";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;
const box = { left: 100, top: 80, right: 300, bottom: 200 };
const frame = () => {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const inside = x >= box.left && x < box.right && y >= box.top && y < box.bottom;
      const index = (y * WIDTH + x) * 4;
      data.fill(inside ? 250 : 128, index, index + 3);
      data[index + 3] = 255;
    }
  }
  return data.buffer;
};
mockIPC((command) => {
  switch (command) {
    case "screenshot_session": return { id: 1, mode: "region", width: WIDTH, height: HEIGHT, underPointer: true };
    case "screenshot_frame": return frame();
    case "screenshot_targets": return [];
    default: return null;
  }
}, { shouldMockEvents: true });
mockWindows("screenshot-0");

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
const pointer = (type: string, x: number, y: number) =>
  act(async () => { overlay().dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true })); });
const key = (type: "keydown" | "keyup", value: string) => act(async () => { window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, key: value })); });
const label = () => document.querySelector(".screenshot-measure__label")?.textContent ?? null;

async function runChecks() {
  try {
    for (let tries = 0; tries < 50 && !document.querySelector(".screenshot-magnifier"); tries += 1) {
      await wait(20);
      if (document.querySelector(".screenshot-overlay")) await pointer("pointermove", 150, 120);
    }
    check(document.querySelector(".screenshot-magnifier")?.textContent?.includes("按住 M 测量距离"), "The magnifier says how to measure");
    check(!document.querySelector(".screenshot-measure"), "Nothing is measured until M is held");

    await key("keydown", "m");
    await pointer("pointermove", 150, 120);
    check(label() === "200 × 120", `Holding M measures the light block under the pointer to its edges (${label()})`);
    const across = document.querySelector<HTMLElement>(".screenshot-measure__line--h")!.getBoundingClientRect();
    check(Math.round(across.left) === box.left && Math.round(across.width) === box.right - box.left, "…with a line from its left edge to its right edge");

    await pointer("pointermove", 20, 120);
    check(label() === `${box.left} × ${HEIGHT}`, `Outside it, the grey runs to the block and the screen's edge (${label()})`);

    await pointer("pointerdown", 150, 120);
    await pointer("pointermove", 165, 140);
    await pointer("pointermove", 180, 160);
    check(label() === "50 px（横 30，竖 40）", `Dragging with M held measures between two points (${label()})`);
    await pointer("pointerup", 180, 160);
    check(label() === "50 px（横 30，竖 40）", "…and the ruler stays after the button is let go");
    check(!document.querySelector(".screenshot-overlay__selection"), "…without drawing a selection");

    await key("keyup", "m");
    check(!document.querySelector(".screenshot-measure"), "Letting go of M takes the measurement away");

    await pointer("pointerdown", 40, 40);
    await pointer("pointermove", 120, 120);
    await pointer("pointerup", 240, 200);
    check(document.querySelector(".screenshot-overlay__selection"), "Without M a drag selects a region again");
    await key("keydown", "m");
    await pointer("pointermove", 150, 120);
    check(label() === "200 × 120", "Measuring also works inside a chosen region");
    await key("keyup", "m");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
