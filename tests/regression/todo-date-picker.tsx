import "../../src/styles/tokens.css";
import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { TodoIslandPage } from "../../src/features/todos/island/TodoIslandPage";
import type { TodoPageProps } from "../../src/features/todos/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const TODAY = "2026-11-14";
const picked: Array<string | null> = [];
const noop = () => {};

function Page() {
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const props: TodoPageProps = {
    todos: [{ id: "a", title: "写周报", completed: false, createdAt: 0 }], dailyNote: "", draft: "", activeTodoId: null, currentDate: TODAY, pageMode: "today",
    archives: [], selectedArchive: null, saveState: "idle", enableTodoReorder: false, scrollStartRows: 5, draftDate, scheduledTodos: [],
    onDraftChange: noop, onDraftDateChange: (date) => { picked.push(date); setDraftDate(date); }, onAddTodo: noop, projects: [], canCreateProject: false,
    onCreateProject: () => undefined, onShowUpcoming: noop, onDeleteScheduledTodo: noop, onToggleTodo: noop, onUpdateTodo: noop, onStartTodo: noop,
    onDeleteTodo: noop, onReorderTodo: noop, onSaveToday: noop, onShowArchive: noop, onShowDaily: noop, onShowToday: noop, onDailyNoteChange: noop, onSelectArchive: noop,
  };
  return <div style={{ height: "100%" }}><TodoIslandPage {...props} /></div>;
}

const pages = document.getElementById("pages")!;
for (const light of [false, true]) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="caption">${light ? "浅色岛" : "深色岛"}</p>`;
  const stage = document.createElement("main");
  stage.className = `stage${light ? " island-light" : ""}`;
  stage.id = light ? "light" : "dark";
  const island = document.createElement("section");
  island.className = "island";
  island.style.setProperty("--island-ink-rgb", light ? "24, 24, 30" : "241, 240, 246");
  island.style.setProperty("--island-background-color", light ? "#f2f2f5" : "#000000");
  const host = document.createElement("div");
  island.append(host);
  stage.append(island);
  wrap.append(stage);
  pages.append(wrap);
  await act(async () => { createRoot(host).render(<StrictMode><I18nProvider><Page /></I18nProvider></StrictMode>); });
}

const results = document.getElementById("results")!;
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = (frame: string, selector: string) => document.querySelector<HTMLElement>(`#${frame} ${selector}`);
const button = (frame: string) => $(frame, ".todo-date-picker > .todo-date-picker__button")!;
const calendar = (frame: string) => $(frame, ".todo-date-calendar");
const day = (frame: string, date: string) => $(frame, `.todo-date-calendar__day[data-date="${date}"]`) as HTMLButtonElement;
const click = (element: HTMLElement | null) => act(async () => { element!.click(); });
const key = (name: string) => act(async () => {
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
});
const quick = (frame: string, label: string) => [...document.querySelectorAll<HTMLElement>(`#${frame} .todo-date-calendar__chip`)].find((chip) => chip.textContent === label) ?? null;
const inside = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;

try {
  check(!document.querySelector('input[type="date"]'), "不再用系统的日期控件");
  await click(button("dark"));
  const popover = calendar("dark");
  check(popover && popover.parentElement?.id === "dark", "月历画在岛的 stage 里，继承岛的主题");
  const pop = popover!.getBoundingClientRect();
  const anchor = button("dark").getBoundingClientRect();
  const island = $("dark", ".island")!.getBoundingClientRect();
  check(inside(pop, island), "月历不超出岛");
  check(pop.right <= anchor.left && anchor.left - pop.right <= 8 && pop.top <= anchor.bottom && pop.bottom >= anchor.top, "岛的高度放不下时贴在按钮左侧");
  check(getComputedStyle(popover!).backgroundColor === "rgb(0, 0, 0)", "深色岛：月历是岛的底色");
  check($("dark", ".todo-date-calendar__head strong")?.textContent === "2026年11月", "标题写年月");
  check($("dark", ".todo-date-calendar__weekdays")?.textContent === "一二三四五六日", "中文从周一开始");
  check((document.querySelector('[aria-label="上个月"]') as HTMLButtonElement).disabled, "本月时「上个月」不可用");

  const today = day("dark", TODAY);
  check(today.getAttribute("aria-current") === "date" && today.classList.contains("todo-date-calendar__day--selected"), "今天高亮，没选别的日子时今天是选中的");
  check(document.activeElement === today, "打开后焦点在选中的日子上");
  const past = day("dark", "2026-11-13");
  const outside = day("dark", "2026-12-01");
  check(past.disabled && getComputedStyle(past).textDecorationLine === "line-through", "过去的日子不能选，划掉");
  check(!outside.disabled && getComputedStyle(outside).color !== getComputedStyle(past).color && getComputedStyle(outside).color !== getComputedStyle(day("dark", "2026-11-20")).color, "非本月的日子能选，颜色和本月、过去的都不一样");

  await key("ArrowLeft");
  check(document.activeElement === today, "方向键不会移到过去的日子");
  await key("ArrowRight");
  check(document.activeElement === day("dark", "2026-11-15"), "方向键按天移动");
  await key("Enter");
  check(picked[picked.length - 1] === "2026-11-15" && !calendar("dark"), "回车选中并关闭");
  check(button("dark").textContent === "明天" && button("dark").classList.contains("todo-date-picker__button--later") && document.activeElement === button("dark"), "按钮写明天、变紫，焦点回到按钮");

  await click(button("dark"));
  check(day("dark", "2026-11-15").classList.contains("todo-date-calendar__day--selected") && !day("dark", TODAY).classList.contains("todo-date-calendar__day--selected"), "再打开时选中的是明天，今天仍有标记");
  await key("PageDown");
  check($("dark", ".todo-date-calendar__head strong")?.textContent === "2026年12月" && document.activeElement === day("dark", "2026-12-15"), "PageDown 换到下个月");
  await key("Escape");
  check(!calendar("dark") && picked.length === 1 && document.activeElement === button("dark"), "Esc 关闭，不改日期");

  await click(button("dark"));
  await click(document.querySelector<HTMLElement>('[aria-label="下个月"]'));
  check($("dark", ".todo-date-calendar__head strong")?.textContent === "2026年12月", "「下个月」翻页");
  await click(day("dark", "2026-12-24"));
  check(picked[picked.length - 1] === "2026-12-24" && button("dark").textContent === "12/24", "点日子选中，按钮写日期");
  await click(button("dark"));
  await click(quick("dark", "下周一"));
  check(picked[picked.length - 1] === "2026-11-16", "快捷项：下周一");
  await click(button("dark"));
  await click(quick("dark", "今天"));
  check(picked[picked.length - 1] === null && button("dark").textContent === "今天", "快捷项：今天，日期复位");
  await click(button("dark"));
  await act(async () => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  check(!calendar("dark"), "点别处关闭");

  await click(button("light"));
  const lightPop = calendar("light")!;
  check(lightPop.parentElement?.id === "light" && getComputedStyle(lightPop).backgroundColor === "rgb(242, 242, 245)", "浅色岛：月历是浅底");
  check(getComputedStyle(day("light", "2026-11-20")).color.startsWith("rgba(24, 24, 30"), "浅色岛：深色字");
  check(inside(lightPop.getBoundingClientRect(), $("light", ".island")!.getBoundingClientRect()), "浅色岛：月历不超出岛");

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
  if (location.search.includes("show=dark")) await click(button("dark"));
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  results.dataset.result = "failed";
}
