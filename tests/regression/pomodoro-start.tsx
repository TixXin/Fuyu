import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/components/island-widget/IslandWidget.css";
import "../../src/features/daily-widgets/dailyWidgets.css";
import { I18nProvider } from "../../src/i18n";
import { DAILY_WIDGETS_KEY } from "../../src/features/daily-widgets/storage";
import { PomodoroWidget } from "../../src/features/daily-widgets/FocusWidgets";

localStorage.removeItem(DAILY_WIDGETS_KEY);

const STEP_MS = 50;
const host = document.getElementById("widget")!;
const results = document.getElementById("results")!;
const messages: string[] = [];

function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
async function until<T>(ready: () => T, timeoutMs = 3000): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  let value = ready();
  while (!value && performance.now() < deadline) {
    await wait(STEP_MS);
    value = ready();
  }
  return value;
}

const widget = () => host.querySelector<HTMLElement>(".daily-pomodoro");
const time = () => host.querySelector(".daily-pomodoro__time")?.textContent ?? "";
const running = () => widget()?.dataset.running === "true";
const playButton = () => host.querySelector<HTMLButtonElement>(".daily-pomodoro__buttons .daily-button:not(.daily-button--plain)")!;
const resetButton = () => host.querySelector<HTMLButtonElement>(".daily-pomodoro__buttons .daily-button--plain");

function watchTimes() {
  const seen: { text: string; at: number }[] = [{ text: time(), at: performance.now() }];
  const observer = new MutationObserver(() => {
    const text = time();
    if (text !== seen[seen.length - 1].text) seen.push({ text, at: performance.now() });
  });
  observer.observe(host, { subtree: true, childList: true, characterData: true });
  return { seen, stop: () => observer.disconnect() };
}

async function runChecks(mountedAt: number) {
  check(await until(() => time() === "25:00" && !running()), "新的番茄钟显示 25:00，没在跑");
  await wait(650 - (performance.now() - mountedAt));

  const watch = watchTimes();
  const clickedAt = performance.now();
  playButton().click();
  await nextFrame();
  check(running(), "点开始后番茄钟在跑");
  check(time() === "25:00", `点开始后的第一帧是 25:00（实际 ${time()}）`);

  const tick = await until(() => watch.seen.find((entry) => entry.text === "24:59"), 2500);
  watch.stop();
  check(tick, `开始后会走到 24:59（看到 ${watch.seen.map((entry) => entry.text).join(" → ")}）`);
  const elapsed = Math.round(tick!.at - clickedAt);
  check(elapsed >= 900 && elapsed <= 1200, `从点开始到 24:59 是一秒左右（${elapsed}ms）`);
  check(watch.seen.every((entry) => entry.text === "25:00" || entry.text === "24:59"), `开始后只出现过 25:00 和 24:59（${watch.seen.map((entry) => entry.text).join(" → ")}）`);

  const beforePause = time();
  playButton().click();
  await nextFrame();
  check(!running() && resetButton(), "点暂停后停下，出现重置按钮");
  check(time() === beforePause, `暂停后停在暂停前的那一秒，不往回跳（${beforePause} → ${time()}）`);

  await wait(650);
  const beforeResume = time();
  playButton().click();
  await nextFrame();
  check(running(), "再点开始接着跑");
  check(time() === beforeResume, `接着跑的第一帧还是暂停时的那一秒，不多出一秒（${beforeResume} → ${time()}）`);

  playButton().click();
  await nextFrame();
  check(!running(), "再暂停一次");
  resetButton()!.click();
  check(await until(() => time() === "25:00" && !running() && !resetButton()), "重置后回到 25:00，重置按钮收起");
}

try {
  const mountedAt = performance.now();
  createRoot(host).render(<StrictMode><I18nProvider><PomodoroWidget /></I18nProvider></StrictMode>);
  await runChecks(mountedAt);
  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
