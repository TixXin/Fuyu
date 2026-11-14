import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { configureTimers, TIMERS_KEY, useTimers } from "../../src/features/timer/store";
import { TimerPanel } from "../../src/features/timer/TimerPanel";
import { TimerChip } from "../../src/features/timer/TimerChip";
import { TimerNotice, TimerNoticeActions } from "../../src/features/timer/TimerNotice";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => null, { shouldMockEvents: true });
mockWindows("main");

function Harness() {
  const ringing = useTimers().timers.filter((timer) => timer.alerted);
  return (
    <div style={{ width: 380, display: "grid", gap: 10, background: "var(--island-background-color, #000)", padding: 12 }}>
      <div className="bar" style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 18px" }}>
        {ringing.length > 0 && <><TimerNotice ringing={ringing} /><TimerNoticeActions /></>}
        <TimerChip paused={false} />
      </div>
      <div style={{ height: 260, display: "flex" }}>
        <TimerPanel isOpen />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <Harness />
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
const input = () => document.querySelector<HTMLInputElement>(".timer-panel__input")!;
const button = (label: string, scope = document.body) => scope.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
const click = (target: HTMLElement | null) => act(async () => { target!.click(); });
const rows = () => [...document.querySelectorAll<HTMLElement>(".timer-panel__row")];
const text = (selector: string) => document.querySelector(selector)?.textContent ?? "";
const typeAndStart = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { input().form!.requestSubmit(); });
};

async function runChecks() {
  try {
    for (let tries = 0; tries < 50 && !input(); tries += 1) await wait(20);
    check(text(".timer-panel__empty").includes("输入时长"), "With no timers the page says how to start one");
    check(!document.querySelector(".timer-chip"), "…and the collapsed bar shows nothing");

    await typeAndStart("abc");
    check(text(".timer-panel__problem").includes("看不懂") && rows().length === 0, "A length it cannot read is refused with a hint");

    await typeAndStart("10m");
    check(rows().length === 1 && rows()[0].textContent?.includes("倒计时 · 10:00") && text(".timer-panel__time") === "10:00", `10m starts a ten minute countdown (${text(".timer-panel__time")})`);
    check(input().value === "", "…and clears the box");
    check(text(".timer-chip__time") === "10:00", "The collapsed bar shows the time left");

    await click(button("开始秒表"));
    check(rows().length === 2 && rows()[1].textContent?.includes("秒表"), "The stopwatch button adds a stopwatch");
    check(text(".timer-chip__time") === "10:00", "…while the bar keeps showing the countdown");

    await click(button("暂停", rows()[0]));
    check(button("继续", rows()[0]) && rows()[0].classList.contains("timer-panel__row--paused"), "A countdown can be paused");
    await wait(600);
    check(text(".timer-chip__time").startsWith("00:0"), `With the countdown paused, the bar shows the running stopwatch (${text(".timer-chip__time")})`);
    await click(button("继续", rows()[0]));
    check(button("暂停", rows()[0]), "…and resumed");

    const saved = JSON.parse(localStorage.getItem(TIMERS_KEY) ?? "[]") as { kind: string }[];
    check(saved.map((timer) => timer.kind).join() === "countdown,stopwatch", "Timers are kept in fuyu-timers so they survive a restart");

    await click(button("取消", rows()[1]));
    check(rows().length === 1, "Cancel removes a timer");

    configureTimers(true, false);
    await typeAndStart("1s");
    await wait(1400);
    check(text(".timer-notice").includes("00:01 的计时到了"), `When a countdown ends, the island says so (${text(".timer-notice")})`);
    check(document.querySelector(".timer-panel__row--done")?.textContent?.includes("到点了"), "…and its row says time is up");
    check(document.querySelector(".timer-chip--done"), "…and the bar marks it");
    await click(button("再加 5 分钟", document.querySelector<HTMLElement>(".bar")!));
    check(!document.querySelector(".timer-notice") && rows().some((row) => row.textContent?.includes("05:00")), "Five more minutes takes the alert away and starts it again");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
