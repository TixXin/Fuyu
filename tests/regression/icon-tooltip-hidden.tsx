import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { IconButtonTooltip } from "../../src/components/IconButtonTooltip";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const page = document.getElementById("page")!;
const root = createRoot(page);
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const settle = async (done: () => boolean, ms = 1500) => { for (let spent = 0; !done() && spent < ms; spent += 50) await wait(50); };
const tooltip = () => document.querySelector<HTMLElement>("[role='tooltip']");
const panel = () => page.querySelector<HTMLElement>(".island")!;
const button = (label: string) => page.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)!;
const hover = async (target: HTMLElement) => {
  await act(async () => { target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 40, clientY: 40 })); });
};
const leave = async (target: HTMLElement) => {
  await act(async () => { target.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });
};
const collapse = (collapsed: boolean) => {
  panel().style.opacity = collapsed ? "0" : "";
  panel().style.pointerEvents = collapsed ? "none" : "";
};

try {
  await act(async () => {
    root.render(
      <StrictMode>
        <div className="island">
          <button type="button" aria-label="Settings" data-tooltip="设置">⚙</button>
          <button type="button" aria-label="Pin" data-tooltip="固定">📌</button>
        </div>
        <IconButtonTooltip delay={60} />
      </StrictMode>,
    );
  });

  await hover(button("Settings"));
  await settle(() => tooltip() !== null);
  check(tooltip()?.textContent === "设置", "Hovering a button shows its tooltip");

  collapse(true);
  await wait(400);
  check(tooltip() === null, "The tooltip goes away within 400ms once the panel collapses (opacity 0, pointer-events none)");

  collapse(false);
  await leave(button("Settings"));
  await hover(button("Pin"));
  collapse(true);
  await wait(200);
  check(tooltip() === null, "A tooltip that is still waiting does not open once the panel has collapsed");

  collapse(false);
  await leave(button("Pin"));
  await hover(button("Settings"));
  await settle(() => tooltip() !== null);
  check(tooltip()?.textContent === "设置", "The tooltip shows again after the panel expands");

  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  delete (document as { visibilityState?: string }).visibilityState;
  check(tooltip() === null, "The tooltip closes when the page becomes hidden");

  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  document.getElementById("results")!.textContent = messages.join("\n");
}
