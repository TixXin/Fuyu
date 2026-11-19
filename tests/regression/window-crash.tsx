import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { WindowCrashBoundary, type WindowCrashOutcome } from "../../src/components/window-crash/WindowCrashBoundary";
import { clearCompileError, showCompileError } from "../../src/devCompileError";
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

type Outcome = WindowCrashOutcome;
type Calls = { crashes: { error: unknown; stack: string | null }[]; reloads: number; autoReloads: number; restarts: number; logs: number; closes: number };
type Mount = { variant: "island" | "window" | "silent"; outcome: Outcome; label: string; dev?: boolean; retryAfterMs?: number; initial?: Outcome & { message: string }; children: ReactNode };

function Broken(): ReactNode {
  throw new TypeError("the shell lost its settings");
}

async function mount({ variant, outcome, label, dev, retryAfterMs, initial, children }: Mount) {
  const host = document.createElement("div");
  host.className = `host host--${variant}`;
  const slot = document.createElement("div");
  const caption = document.createElement("span");
  caption.className = "host__label";
  caption.textContent = label;
  host.append(slot, caption);
  page.append(host);
  const calls: Calls = { crashes: [], reloads: 0, autoReloads: 0, restarts: 0, logs: 0, closes: 0 };
  const actions = {
    reload: () => { calls.reloads += 1; },
    autoReload: () => { calls.autoReloads += 1; },
    restart: () => { calls.restarts += 1; },
    openLog: () => { calls.logs += 1; },
    close: () => { calls.closes += 1; },
  };
  const root = createRoot(slot, { onCaughtError: () => undefined });
  await act(async () => {
    root.render(
      <StrictMode>
        <I18nProvider>
          <WindowCrashBoundary
            variant={variant}
            initial={initial}
            dev={dev}
            retryAfterMs={retryAfterMs}
            onCrash={(error, stack) => {
              calls.crashes.push({ error, stack });
              return outcome;
            }}
            actions={actions}
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
const named = (slot: HTMLElement, name: string) => buttons(slot).find((button) => button.textContent === name || button.getAttribute("aria-label") === name);
const names = (slot: HTMLElement) => buttons(slot).map((button) => button.textContent || button.getAttribute("aria-label")).join("|");
const first: Outcome = { step: "fallback", retried: false };
const again: Outcome = { step: "fallback", retried: true };

try {
  const healthy = await mount({ variant: "island", outcome: first, label: "没出错", children: <span className="healthy">岛屿内容</span> });
  check(healthy.slot.textContent === "岛屿内容" && healthy.calls.crashes.length === 0, "A window that renders fine shows its content and reports nothing");

  const reloading = await mount({ variant: "island", outcome: { step: "reload", retried: false }, label: "第一次出错：等重载", children: <Broken /> });
  check(reloading.calls.crashes.length === 1, "A crash in the window is handed to onCrash once");
  check(reloading.calls.crashes[0]?.error instanceof TypeError && (reloading.calls.crashes[0]?.stack ?? "").includes("Broken"), "onCrash gets the error and the component stack that names the broken component");
  check(reloading.slot.querySelector("[role='alert']") === null && reloading.slot.textContent === "", "While the window is about to reload nothing is drawn");
  check(reloading.calls.reloads === 0 && reloading.calls.autoReloads === 0, "The boundary does not reload by itself, the caller decides");

  const island = await mount({ variant: "island", outcome: first, label: "岛：再次出错", children: <Broken /> });
  check(island.slot.querySelector("[role='alert']")?.textContent?.includes("浮屿出了点问题"), "After a second crash the island shows a pill that says something went wrong");
  check(names(island.slot) === "重新加载|查看日志", "The island pill has Reload and a button that shows the log");
  check(island.slot.querySelector(".window-crash__pill")?.getAttribute("title") === "TypeError: the shell lost its settings", "Hovering the pill tells what the error was");
  await click(named(island.slot, "查看日志"));
  check(island.calls.logs === 1 && island.calls.reloads === 0, "The log button asks to show the log and nothing else");
  await click(named(island.slot, "重新加载"));
  check(island.calls.reloads === 1 && island.calls.restarts === 0, "Clicking Reload on the pill asks for a reload");
  const pending = named(island.slot, "正在重新加载…");
  check(pending instanceof HTMLButtonElement && pending.disabled, "After the click the button says it is reloading and cannot be clicked again");
  await wait(300);
  check(island.calls.autoReloads === 0, "Without a retry time the pill does not reload by itself");

  const retried = await mount({ variant: "island", outcome: again, label: "岛：重新加载后还是出错", children: <Broken /> });
  check(retried.slot.querySelector("[role='alert']")?.textContent?.includes("重新加载后仍然出错"), "When a reload did not help, the pill says so instead of looking untouched");
  check(names(retried.slot) === "重启浮屿|查看日志", "After a failed reload the pill offers to restart the app");
  await click(named(retried.slot, "重启浮屿"));
  check(retried.calls.restarts === 1 && retried.calls.reloads === 0, "Restart asks for an app restart, not another reload");
  check(named(retried.slot, "正在重启…")?.disabled === true, "After the click the button says it is restarting");

  const retrying = await mount({ variant: "island", outcome: first, label: "岛：到时间自动再试", retryAfterMs: 200, children: <Broken /> });
  check(retrying.calls.autoReloads === 0, "The pill with a retry time does not reload at once");
  await settle(() => retrying.calls.autoReloads > 0);
  check(retrying.calls.autoReloads === 1 && retrying.calls.reloads === 0, "The island pill reloads by itself once the retry time passes, and that does not count as the user's retry");

  const dev = await mount({ variant: "island", outcome: again, label: "岛：开发版", dev: true, children: <Broken /> });
  check(dev.slot.querySelector("[role='alert']")?.textContent?.includes("改好代码后自动恢复"), "The dev build says the window comes back once the code is fixed");
  check(names(dev.slot) === "重新加载|查看日志", "The dev build never offers a restart, the code would still be broken");

  const card = await mount({ variant: "window", outcome: first, label: "普通窗口：再次出错", retryAfterMs: 200, children: <Broken /> });
  const alert = card.slot.querySelector("[role='alert']");
  check(alert?.textContent?.includes("这个窗口出了点问题") && alert.textContent.includes("frontend-errors.log"), "Other windows show a card that names the problem and the log file");
  check(card.slot.querySelector(".window-crash__error")?.textContent === "TypeError: the shell lost its settings", "The card shows the error itself, so a screenshot of it is enough to report");
  check(names(card.slot) === "查看日志|关闭|重新加载", "The card has Show log, Close and Reload");
  await click(named(card.slot, "关闭"));
  check(card.calls.closes === 1 && card.calls.reloads === 0, "Close on the card asks to close the window");
  await click(named(card.slot, "查看日志"));
  check(card.calls.logs === 1, "Show log on the card asks to show the log");
  await click(named(card.slot, "重新加载"));
  check(card.calls.reloads === 1 && named(card.slot, "正在重新加载…")?.disabled === true, "Reload on the card asks for a reload and says it is reloading");
  await wait(400);
  check(card.calls.autoReloads === 0, "A card never reloads by itself, the user is looking at it");

  const cardRetried = await mount({ variant: "window", outcome: again, label: "普通窗口：重新加载后还是出错", children: <Broken /> });
  check(cardRetried.slot.querySelector("[role='alert']")?.textContent?.includes("重新加载后仍然出错"), "The card says when a reload did not help");
  check(names(cardRetried.slot) === "查看日志|关闭|重启浮屿", "After a failed reload the card offers to restart the app");

  const silent = await mount({ variant: "silent", outcome: first, label: "拖岛辅助线：不显示", children: <Broken /> });
  check(silent.calls.crashes.length === 1 && silent.slot.textContent === "", "The click-through window reports the crash and draws nothing");

  const startup = await mount({ variant: "window", outcome: first, label: "启动失败", initial: { ...first, message: "TypeError: Importing a module script failed." }, children: null });
  check(startup.slot.querySelector(".window-crash__error")?.textContent === "TypeError: Importing a module script failed." && startup.calls.crashes.length === 0, "A window that failed before it could render shows the card with the startup error straight away");

  const file = "/repo/src/i18n/sections/settings/collapsedItems.ts";
  showCompileError({ message: `Transform failed with 1 error:\n${file}:59:333: ERROR: Expected "}" but found "…"`, id: file, loc: { file, line: 59, column: 333 } });
  const compile = document.querySelector<HTMLElement>(".dev-compile-error");
  check(compile?.getAttribute("role") === "alert" && compile.textContent === 'collapsedItems.ts:59:333Expected "}" but found "…"', "A compile error in the dev build shows one small line with the file, the position and the message");
  check(compile !== null && compile.getBoundingClientRect().height < 80 && compile.getBoundingClientRect().width <= 640, "The compile error is a small strip, not a full-window overlay");
  check(getComputedStyle(card.slot.querySelector(".window-crash")!).display === "none", "While the code does not compile, the crash card steps aside for the compile error");
  showCompileError({ message: "Failed to resolve import" });
  check(document.querySelectorAll(".dev-compile-error").length === 1 && document.querySelector(".dev-compile-error")?.textContent === "Failed to resolve import", "A newer compile error replaces the old one");
  clearCompileError();
  check(document.querySelector(".dev-compile-error") === null && getComputedStyle(card.slot.querySelector(".window-crash")!).display !== "none", "Once the code compiles again the strip goes away and the card is back");

  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  document.getElementById("results")!.textContent = messages.join("\n");
}
