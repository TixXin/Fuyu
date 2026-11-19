import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { WindowCrashBoundary, type WindowCrashStep } from "../../src/components/window-crash/WindowCrashBoundary";
import { I18nProvider } from "../../src/i18n/runtime";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const page = document.getElementById("page")!;
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const settle = async (done: () => boolean, ms = 2000) => { for (let spent = 0; !done() && spent < ms; spent += 50) await wait(50); };

type Calls = { crashes: { error: unknown; stack: string | null }[]; reloads: number; closes: number };
type Mount = { variant: "island" | "window" | "silent"; step: WindowCrashStep; label: string; retryAfterMs?: number; initialStep?: WindowCrashStep; children: ReactNode };

function Broken(): ReactNode {
  throw new TypeError("the shell lost its settings");
}

async function mount({ variant, step, label, retryAfterMs, initialStep, children }: Mount) {
  const host = document.createElement("div");
  host.className = `host host--${variant}`;
  const slot = document.createElement("div");
  const caption = document.createElement("span");
  caption.className = "host__label";
  caption.textContent = label;
  host.append(slot, caption);
  page.append(host);
  const calls: Calls = { crashes: [], reloads: 0, closes: 0 };
  const root = createRoot(slot, { onCaughtError: () => undefined });
  await act(async () => {
    root.render(
      <StrictMode>
        <I18nProvider>
          <WindowCrashBoundary
            variant={variant}
            initialStep={initialStep}
            retryAfterMs={retryAfterMs}
            onCrash={(error, stack) => {
              calls.crashes.push({ error, stack });
              return step;
            }}
            onReload={() => { calls.reloads += 1; }}
            onClose={() => { calls.closes += 1; }}
          >
            {children}
          </WindowCrashBoundary>
        </I18nProvider>
      </StrictMode>,
    );
  });
  return { slot, calls };
}

const click = async (target: Element | null | undefined) => {
  if (!(target instanceof HTMLElement)) throw new Error("The button to click is missing");
  await act(async () => { target.click(); });
};
const buttons = (slot: HTMLElement) => [...slot.querySelectorAll("button")];

try {
  const healthy = await mount({ variant: "island", step: "fallback", label: "没出错", children: <span className="healthy">岛屿内容</span> });
  check(healthy.slot.textContent === "岛屿内容" && healthy.calls.crashes.length === 0, "A window that renders fine shows its content and reports nothing");

  const reloading = await mount({ variant: "island", step: "reload", label: "第一次出错：等重载", children: <Broken /> });
  check(reloading.calls.crashes.length === 1, "A crash in the window is handed to onCrash once");
  check(reloading.calls.crashes[0]?.error instanceof TypeError && (reloading.calls.crashes[0]?.stack ?? "").includes("Broken"), "onCrash gets the error and the component stack that names the broken component");
  check(reloading.slot.querySelector("[role='alert']") === null && reloading.slot.textContent === "", "While the window is about to reload nothing is drawn");
  check(reloading.calls.reloads === 0, "The boundary does not reload by itself, the caller decides");

  const island = await mount({ variant: "island", step: "fallback", label: "岛：再次出错", children: <Broken /> });
  const pill = island.slot.querySelector("[role='alert']");
  check(pill?.textContent?.includes("浮屿出了点问题"), "After a second crash the island shows a pill that says something went wrong");
  check(buttons(island.slot).length === 1 && buttons(island.slot)[0]?.textContent === "重新加载", "The island pill has one button, Reload");
  await click(buttons(island.slot)[0]);
  check(island.calls.reloads === 1 && island.calls.closes === 0, "Clicking Reload on the pill asks for a reload");
  await wait(300);
  check(island.calls.reloads === 1, "Without a retry time the pill does not reload by itself");

  const retrying = await mount({ variant: "island", step: "fallback", label: "岛：到时间自动再试", retryAfterMs: 200, children: <Broken /> });
  check(retrying.calls.reloads === 0, "The pill with a retry time does not reload at once");
  await settle(() => retrying.calls.reloads > 0);
  check(retrying.calls.reloads === 1, "The island pill reloads by itself once the retry time passes");

  const card = await mount({ variant: "window", step: "fallback", label: "普通窗口：再次出错", retryAfterMs: 200, children: <Broken /> });
  const alert = card.slot.querySelector("[role='alert']");
  check(alert?.textContent?.includes("这个窗口出了点问题") && alert.textContent.includes("frontend-errors.log"), "Other windows show a card that names the problem and the log file");
  check(buttons(card.slot).map((button) => button.textContent).join("|") === "关闭|重新加载", "The card has Close and Reload");
  await click(buttons(card.slot)[0]);
  check(card.calls.closes === 1 && card.calls.reloads === 0, "Close on the card asks to close the window");
  await click(buttons(card.slot)[1]);
  check(card.calls.reloads === 1, "Reload on the card asks for a reload");
  await wait(400);
  check(card.calls.reloads === 1, "A card never reloads by itself, the user is looking at it");

  const silent = await mount({ variant: "silent", step: "fallback", label: "拖岛辅助线：不显示", children: <Broken /> });
  check(silent.calls.crashes.length === 1 && silent.slot.textContent === "", "The click-through window reports the crash and draws nothing");

  const startup = await mount({ variant: "window", step: "reload", label: "启动失败", initialStep: "fallback", children: null });
  check(startup.slot.querySelector("[role='alert']") !== null && startup.calls.crashes.length === 0, "A window that failed before it could render shows the card straight away");

  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  document.getElementById("results")!.textContent = messages.join("\n");
}
