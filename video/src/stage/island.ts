import type { IslandFrame } from "../app/boot";
import type { World } from "../app/world";
import { sound } from "./sound";
import { ISLAND_FRAME_WIDTH, STAGE_WIDTH, stage } from "./stageState";

const FRAME_LEFT = (STAGE_WIDTH - ISLAND_FRAME_WIDTH) / 2;
const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function frame(): IslandFrame {
  const element = document.querySelector<HTMLIFrameElement>("#island-frame");
  if (!element?.contentWindow) throw new Error("island frame is not mounted");
  return element.contentWindow as unknown as IslandFrame;
}

function find(selector: string, index = 0): HTMLElement {
  const element = frame().document.querySelectorAll<HTMLElement>(selector)[index];
  if (!element) throw new Error(`island element not found: ${selector}[${index}]`);
  return element;
}

function center(element: HTMLElement) {
  const box = element.getBoundingClientRect();
  return { x: FRAME_LEFT + box.left + box.width / 2, y: box.top + box.height / 2 };
}

export const island = {
  world: (): World => frame().__world,
  emit: (event: string, payload: unknown) => frame().__emit(event, payload),
  has: (selector: string) => frame().document.querySelector(selector) !== null,
  find,
  async pointAt(selector: string, index = 0, ms = 520) {
    const target = center(find(selector, index));
    stage.set((current) => ({ cursor: { ...current.cursor, ...target, ms, visible: true } }));
    await sleep(ms);
  },
  async click(selector: string, index = 0, ms = 520) {
    await island.pointAt(selector, index, ms);
    stage.set((current) => ({ cursor: { ...current.cursor, pressed: true } }));
    sound("click");
    await sleep(90);
    const element = find(selector, index);
    const view = frame() as unknown as typeof globalThis;
    const options = { bubbles: true, cancelable: true, view: frame() as unknown as Window, button: 0 };
    element.dispatchEvent(new view.PointerEvent("pointerdown", { ...options, pointerId: 1 }));
    element.dispatchEvent(new view.MouseEvent("mousedown", options));
    element.dispatchEvent(new view.PointerEvent("pointerup", { ...options, pointerId: 1 }));
    element.dispatchEvent(new view.MouseEvent("mouseup", options));
    element.click();
    await sleep(110);
    stage.set((current) => ({ cursor: { ...current.cursor, pressed: false } }));
  },
  async type(selector: string, text: string, perChar = 55) {
    const element = find(selector) as HTMLInputElement | HTMLTextAreaElement;
    const view = frame() as unknown as typeof globalThis;
    const proto = element.tagName === "TEXTAREA" ? view.HTMLTextAreaElement.prototype : view.HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    element.focus();
    for (let length = 1; length <= [...text].length; length++) {
      setValue.call(element, [...text].slice(0, length).join(""));
      element.dispatchEvent(new view.Event("input", { bubbles: true }));
      await sleep(perChar);
    }
  },
  hideCursor() {
    stage.set((current) => ({ cursor: { ...current.cursor, visible: false } }));
  },
};

export { sleep };
