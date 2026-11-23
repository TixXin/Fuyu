import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { isSearchIndexLoaded } from "../../src/windows/settings/SettingsSidebar";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import "./settingsMocks";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
window.addEventListener("beforeunload", () => {
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) {
    if (!original.has(key)) localStorage.removeItem(key);
  }
  for (const [key, value] of original) localStorage.setItem(key, value);
});
for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) localStorage.removeItem(key);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
localStorage.setItem("fuyu-settings", JSON.stringify(DEFAULT_SETTINGS));

const root = createRoot(document.getElementById("root")!);
const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const items = () => [...document.querySelectorAll<HTMLButtonElement>(".settings-sidebar__item[data-category]")];
const tabs = () => [...document.querySelectorAll<HTMLButtonElement>(".settings-tabs__tab")];
const click = (button: HTMLButtonElement) => act(async () => { button.click(); });
const reveal = () => {
  const panel = document.querySelector<HTMLElement>(".editor-panel")!;
  return panel.getAnimations().flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes())
    .map((frame) => `${String(frame.maskSize ?? frame.webkitMaskSize ?? "")} @ ${String(frame.maskPosition ?? frame.webkitMaskPosition ?? "")}`)
    .filter((frame) => frame !== " @ ");
};
const hitsPanel = () => {
  const panel = document.querySelector<HTMLElement>(".editor-panel")!;
  const box = panel.getBoundingClientRect();
  return panel.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
};
const finishAll = () => act(async () => {
  for (const animation of document.getAnimations()) animation.finish();
  await new Promise((resolve) => setTimeout(resolve, 30));
});

try {
  await act(async () => { root.render(<StrictMode><I18nProvider><SettingsWindow /></I18nProvider></StrictMode>); });
  await wait(80);
  const others = items().filter((item) => !item.classList.contains("settings-sidebar__item--active"));
  await click(others[0]);
  await finishAll();
  const first = document.querySelector<HTMLElement>(".settings-sidebar__item--active")!;
  const later = items().find((item) => item.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_PRECEDING && item !== first);
  check(later, "侧栏下面还有别的页");
  await click(later!);
  check(document.querySelector(".settings-sidebar__ghost"), "点侧栏后高亮块从原来那一项挪过去");
  check(later!.classList.contains("settings-switch-arriving"), "挪的时候新那一项先不画自己的高亮");
  check(/^\d+px 0px @ 0px [1-9]\d*px$/.test(reveal()[0] ?? ""), `往下点的页从下面拉开（${reveal()[0]}）`);
  check(hitsPanel(), "拉开的过程中还没露出来的地方也点得到");
  await click(first);
  check(/^\d+px 0px @ 0px 0px$/.test(reveal()[0] ?? ""), `连着往上点，上一段立刻收尾，新页从上面拉开（${reveal()[0]}）`);
  check(document.querySelectorAll(".settings-sidebar__ghost").length === 1, "连着点只留一个高亮块");
  await finishAll();
  check(!document.querySelector(".settings-sidebar__ghost") && !document.querySelector(".settings-switch-arriving"), "播完高亮块删掉，新那一项画回自己的高亮");
  check(!document.querySelector("[data-page-switch-overlay]"), "播完幕布边上的亮线也删掉");

  const behavior = items().find((item) => item.dataset.category === "behavior");
  check(behavior, "侧栏里有行为");
  await click(behavior!);
  await finishAll();
  check(tabs().length >= 2, "行为页有几个标签");
  await click(tabs()[1]);
  check(document.querySelector(".settings-tabs__ghost"), "点标签后下划线挪过去");
  check(/^0px \d+px @ [1-9]\d*px 0px$/.test(reveal()[0] ?? ""), `往右的标签从右边拉开（${reveal()[0]}）`);
  await finishAll();
  await click(tabs()[0]);
  await finishAll();

  const jump = [...document.querySelectorAll<HTMLButtonElement>(".editor-panel .settings-choice__option")].find((button) => button.textContent === "直接跳");
  check(jump, "展开页里有「标签和侧栏的高亮」");
  await click(jump!);
  await click(tabs()[1]);
  check(!document.querySelector(".settings-tabs__ghost"), "选「直接跳」后下划线不再挪");
  await finishAll();

  const input = document.querySelector<HTMLInputElement>(".settings-sidebar__search input")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    input.focus();
    setter.call(input, "开机");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  for (let spent = 0; !isSearchIndexLoaded() && spent < 2000; spent += 20) await wait(20);
  await wait(60);
  const hit = document.querySelector<HTMLButtonElement>(".settings-sidebar__hit[data-page]:not([data-page='behavior'])");
  check(hit, "搜「开机」有结果");
  await click(hit!);
  check(reveal().length === 0, "从搜索结果跳过去不播换页动效");
  for (let spent = 0; !document.querySelector(".settings-row--found") && spent < 2000; spent += 50) await wait(50);
  check(document.querySelector(".settings-row--found"), "跳过去照样高亮找到的那一行");
  for (let spent = 0; document.querySelector(".settings-row--found") && spent < 8000; spent += 50) await wait(50);

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
}
