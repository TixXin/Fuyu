import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandPages } from "../../src/windows/island/IslandPages";
import { useCustomPanelPages } from "../../src/windows/island/custom-panels/useCustomPanelPages";
import { useCollapsedGauges } from "../../src/windows/island/useCollapsedGauges";
import { useCollapsedWidth } from "../../src/windows/island/useCollapsedWidth";
import { pageForAltDigit, withPageLayout, type IslandFeatures } from "../../src/windows/island/features";
import { ISLAND_PAGES_KEY, saveIslandPages, type IslandPagesLayout } from "../../src/lib/settings/islandPages";
import type { IslandPage } from "../../src/windows/island/types";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import { updatePluginNames } from "../../src/features/plugin-kernel/pluginNames";
import { islandSpotlight, SPOTLIGHT_ANIMATION } from "../../src/features/plugin-kernel/islandSpotlight";
import { normalizeSettings } from "../../src/lib/settings/settings";
import { useFixtureLines } from "./islandLines";
import { checkHeaderMoreMenu, checkHeaderTabFit } from "./headerTabChecks";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => undefined, { shouldMockEvents: true });
localStorage.removeItem("fuyu-collapsed-items");

const registry = windowSlots("island");
const external = { external: true };
const GlobeIcon = ({ size = 16 }: { size?: number | string }) => (
  <svg className="test-globe" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg>
);
const BrokenIcon = () => {
  throw new Error("this icon is broken on purpose");
};
const ClockPage = () => <div className="test-clock-page">world clock page</div>;
const MonitorPage = () => <div className="test-monitor-page">monitor page</div>;
const IssuesPage = () => <div className="test-issues-page">issues page</div>;
const HiddenPage = () => <div className="test-hidden-page">hidden page</div>;
const ClockChip = () => (
  <span className="test-clock-chip" style={{ display: "inline-flex", gap: 4, whiteSpace: "nowrap", fontSize: 12 }}><b>TYO</b><span>21:08</span></span>
);

registry.add("island.page/v1", { id: "world-clock", component: ClockPage, icon: GlobeIcon, title: { "zh-CN": "世界时钟", en: "World Clock" } }, "@test/world-clock", external);
registry.add("island.page/v1", { id: "@test/system-monitor", component: MonitorPage, icon: BrokenIcon }, "@test/system-monitor", external);
registry.add("island.page/v1", { id: "@test/github-issues", component: IssuesPage }, "@test/github-issues", external);
registry.add("island.page/v1", { id: "hidden", component: HiddenPage, headerDot: false, title: "Hidden" }, "@test/hidden", external);
registry.add("island.collapsed/v1", { id: "world-clock-bar", width: 66, hideable: true, opens: "world-clock", component: ClockChip }, "@test/world-clock", external);
updatePluginNames([{ id: "@test/system-monitor", displayName: { "zh-CN": "系统监控", en: "System Monitor" } }]);

const FEATURES: IslandFeatures = { todo: true, music: false, clipboard: true, shelf: false, qq: false, wechat: false, qqMail: false, agents: true, translation: false, calendar: false, screenshots: false, timer: false };
const settings = normalizeSettings({ islandMotion: "none" });
const noop = () => {};

let goTo: (page: IslandPage) => void = noop;
let setHeaderIcons: (icons: { layout: IslandPagesLayout | null; legacy: boolean }) => void = noop;
const opened: IslandPage[] = [];
const openFromBar = (page: IslandPage) => {
  opened.push(page);
  goTo(page);
};
const warnings: string[] = [];
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  warnings.push(args.map(String).join(" "));
  warn(...args);
};

function CustomPanelPages() {
  useCustomPanelPages();
  return null;
}

function Expanded() {
  const [page, setPage] = useState<IslandPage>("todo");
  const [icons, setIcons] = useState<{ layout: IslandPagesLayout | null; legacy: boolean }>({ layout: null, legacy: false });
  goTo = setPage;
  setHeaderIcons = setIcons;
  const features = icons.layout ? withPageLayout(FEATURES, icons.layout) : FEATURES;
  return <div className="stage stage--expanded">
    <CustomPanelPages />
    <IslandShell
      mode="expanded" page={page} isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled" features={features} fuyuTabIcon={icons.legacy}
      onOpenPage={setPage} onPageChange={setPage} onWindowDragStart={noop} onCollapse={noop}
      onResetPosition={noop} minimizesToTray onMinimize={noop} onOpenSettings={noop} onOpenTranslator={noop} onTuck={noop} onReveal={noop}
      pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <IslandPages page={page} mode="expanded" settings={settings} features={FEATURES} />
    </IslandShell>
  </div>;
}

function Collapsed() {
  useFixtureLines({ todoTitle: "整理下周的发布说明" });
  const slots = useCollapsedGauges(false);
  const width = useCollapsedWidth({ barText: true, noticeText: null, showTitle: false, widthExtra: 0, peeking: false, slots });
  return <div className="stage stage--collapsed" style={{ "--collapsed-island-width": `${width}px` } as CSSProperties}>
    <IslandShell
      mode="collapsed" page="todo" isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled" features={FEATURES} collapsedSlots={slots}
      onOpenPage={openFromBar} onPageChange={noop} onWindowDragStart={noop} onCollapse={noop}
      onResetPosition={noop} minimizesToTray onMinimize={noop} onOpenSettings={noop} onOpenTranslator={noop} onTuck={noop} onReveal={noop}
      pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span />
    </IslandShell>
  </div>;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const results = document.getElementById("results")!;
const expandedRoot = document.getElementById("expanded")!;
const collapsedRoot = document.getElementById("collapsed")!;

async function settle(condition: () => unknown, timeout = 3000) {
  const start = performance.now();
  while (!condition() && performance.now() - start < timeout) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  return condition();
}

async function frame() {
  await act(async () => { await new Promise(requestAnimationFrame); });
}

const setPanels = async (value: unknown) => {
  await act(async () => {
    if (value === null) localStorage.removeItem("fuyu-custom-panels");
    else localStorage.setItem("fuyu-custom-panels", JSON.stringify(value));
    window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-custom-panels" }));
  });
  await frame();
};

const storedItems = () => (JSON.parse(localStorage.getItem("fuyu-custom-panels") ?? "null") as { panels: { mode: string; items: { widget: string; size: string }[] }[] } | null)?.panels[0];
const pointer = (type: string, target: EventTarget, x = 20, y = 20) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 7, clientX: x, clientY: y }));

async function checkPanelEditing() {
  const panel = () => expandedRoot.querySelector<HTMLElement>(".custom-panel");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__edit")!.click());
  check(panel()?.classList.contains("custom-panel--editing") && panel()?.dataset.windowDrag === "false" && expandedRoot.querySelectorAll(".custom-panel__remove").length === 3
    && expandedRoot.querySelectorAll(".custom-panel__strip").length === 3 && expandedRoot.querySelector(".custom-panel__edit")?.getAttribute("aria-pressed") === "true"
    && expandedRoot.querySelector(".custom-panel__dock .custom-panel__picker"), "点布局按钮进入编辑模式：面板不再拖岛，每个组件有 × 和标签条，底部常驻组件栏");
  const shield = expandedRoot.querySelector<HTMLElement>(".custom-panel__cell[data-widget='next-meeting'] .custom-panel__shield")!;
  await act(async () => { pointer("pointerdown", shield); pointer("pointerup", window); });
  check(storedItems()?.items.find((item) => item.widget === "next-meeting")?.size === "l", "网格面板里点一下组件，换到它的下一档大小");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__cell[data-widget='gone'] .custom-panel__remove")!.click());
  check(storedItems()?.items.map((item) => item.widget).join() === "todos,next-meeting", "点 × 拿掉组件");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__undo button")!.click());
  check(storedItems()?.items.length === 3 && !expandedRoot.querySelector(".custom-panel__undo"), "点「撤销」把拿掉的组件放回去");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__cell[data-widget='gone'] .custom-panel__remove")!.click());
  check(expandedRoot.querySelector(".custom-panel__picker [data-widget]") && !expandedRoot.querySelector(".custom-panel__picker [data-widget='todos']"), "组件栏列出还没加的组件");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__modes [role='radio']:not([aria-checked='true'])")!.click());
  check(storedItems()?.mode === "free" && expandedRoot.querySelectorAll(".custom-panel__stretch").length === 2, "切到「自己摆」，组件右下角有拉伸角");
  const free = expandedRoot.querySelector<HTMLElement>(".custom-panel__cell[data-widget='todos'] .custom-panel__shield")!;
  const zoom = Number(expandedRoot.querySelector<HTMLElement>(".custom-panel__zoom")?.style.zoom) || 1;
  await act(async () => { pointer("pointerdown", free, 20, 20); pointer("pointermove", window, 20 + 40 * zoom, 20 + 24 * zoom); pointer("pointerup", window, 20 + 40 * zoom, 20 + 24 * zoom); });
  const moved = (JSON.parse(localStorage.getItem("fuyu-custom-panels")!) as { panels: { items: { widget: string; x: number; y: number }[] }[] }).panels[0].items.find((item) => item.widget === "todos");
  check(moved && moved.x === 6 && moved.y === 0, `自由面板里拖动吸附到 16px 点阵、不出两行（${moved?.x},${moved?.y}）`);
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__reset")!.click());
  check(storedItems()?.mode === "grid" && storedItems()?.items[0]?.widget === "today" && expandedRoot.querySelector(".custom-panel__undo"),
    `点「恢复默认」换回默认的网格布局，并给出撤销（${storedItems()?.mode}: ${storedItems()?.items.map((item) => item.widget).join()}）`);
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__undo button")!.click());
  check(storedItems()?.mode === "free" && (storedItems()?.items.find((item) => item.widget === "todos") as { x?: number } | undefined)?.x === 6, "恢复默认后点「撤销」回到刚才自己摆的样子");
  await act(async () => expandedRoot.querySelector<HTMLButtonElement>(".custom-panel__edit")!.click());
  check(!panel()?.classList.contains("custom-panel--editing") && !expandedRoot.querySelector(".custom-panel__remove") && !expandedRoot.querySelector(".custom-panel__dock"), "再点布局按钮（✓）退出编辑模式");
  check(JSON.parse(localStorage.getItem("fuyu-custom-panels")!).panels.map((item: { id: string }) => item.id).join() === "fuyu", "编辑后存成唯一的 fuyu 面板");
  await setPanels({ version: 1, panels: [{ id: "fuyu", name: "", icon: "star", mode: "grid", items: [] }] });
  const workbench = expandedRoot.querySelector<HTMLButtonElement>(".panel-templates__button[data-template='workbench']");
  check(workbench && expandedRoot.querySelector(".panel-templates__button[data-template='fun']"), "空面板里有「工作台」「娱乐」两个模板按钮");
  await act(async () => workbench!.click());
  check(storedItems()?.items.map((item) => `${item.widget}:${item.size}`).slice(0, 2).join() === "todos:l,next-meeting:m", `点「工作台」按模板加组件（${storedItems()?.items.map((item) => item.widget).join()}）`);
}

async function checkCustomPanel() {
  const dotOf = () => expandedRoot.querySelector<HTMLButtonElement>('.dot-button[data-page="panel:fuyu"]');
  const first = () => expandedRoot.querySelector<HTMLElement>(".island__header-start button");
  check(dotOf() && first() === dotOf() && dotOf()?.querySelector("svg.lucide-house") && !dotOf()?.querySelector(".panel-text-icon"), "没有 fuyu-custom-panels 时页头最左边（Agent 按钮前面）也是 Fuyu 页面，默认是 Home 图标");
  await setPanels({ version: 1, panels: [{ id: "desk", name: "工作台", icon: "star", mode: "grid", items: [
    { widget: "todos", size: "l", x: 0, y: 0, w: 31, h: 31 },
    { widget: "next-meeting", size: "m", x: 32, y: 0, w: 31, h: 15 },
    { widget: "gone", size: "s", x: 32, y: 16, w: 15, h: 15 },
  ] }] });
  const dot = dotOf();
  const allDots = [...expandedRoot.querySelectorAll<HTMLElement>(".island__header-start .dot-button")];
  const firstPlugin = allDots.findIndex((button) => button.classList.contains("dot-button--plugin"));
  check(dot && /^首页/.test(dot.getAttribute("aria-label") ?? "") && allDots.indexOf(dot) === 0 && allDots.indexOf(dot) < firstPlugin, `Fuyu 页面排在页头第一个，名字是「首页」（${dot?.getAttribute("aria-label")}）`);
  await act(async () => dot!.click());
  await frame();
  const cells = [...expandedRoot.querySelectorAll<HTMLElement>(".custom-panel__cell")];
  const todos = cells.find((cell) => cell.dataset.widget === "todos");
  check(cells.length === 3 && todos && todos.offsetWidth === 248 && todos.offsetHeight === 248 && todos.querySelector(".island-widget__empty")?.textContent === "今天没有待办",
    "打开面板按网格画出组件：大尺寸 248×248，内置的待办组件在没有数据时显示空状态");
  check(cells.find((cell) => cell.dataset.widget === "gone")?.childElementCount === 0, "找不到的组件留一个空格子，不报错");
  check(cells.length === 3, "存过的旧面板（id 不是 fuyu）照样显示在 Fuyu 页面里");
  await checkPanelEditing();
  await setPanels(null);
  check(dotOf(), "清空 fuyu-custom-panels 后 Fuyu 页面还在");
  await act(async () => goTo("todo"));
}

async function checkPageIcons() {
  const dot = (page: string) => expandedRoot.querySelector<HTMLElement>(`.dot-button[data-page="${page}"]`) ?? expandedRoot.querySelector<HTMLElement>(`.dot-button--${CSS.escape(page)}`);
  const agents = () => expandedRoot.querySelector<HTMLElement>(".island__agent-button svg");
  const plain = { order: [], hidden: [] };
  await act(async () => setHeaderIcons({ layout: null, legacy: true }));
  check(dot("panel:fuyu")?.querySelector(".center-jelly") && !dot("panel:fuyu")?.querySelector(".panel-text-icon"), "旧设置 fuyuTabIcon 开着、没选过图标时，Fuyu 页照旧显示水母");
  await act(async () => setHeaderIcons({ layout: { ...plain, icons: { "panel:fuyu": "text" } }, legacy: true }));
  check(dot("panel:fuyu")?.querySelector(".panel-text-icon")?.textContent === "首页", "在岛屿布局里选了「文字」就显示文字，不管旧开关");
  await act(async () => setHeaderIcons({ layout: { ...plain, icons: { "panel:fuyu": "rocket", todo: "star", agents: "cat", "world-clock": "globe" } }, legacy: false }));
  check(dot("panel:fuyu")?.querySelector("svg.lucide-rocket") && dot("todo")?.querySelector("svg.lucide-star") && agents()?.classList.contains("lucide-cat")
    && agents()?.classList.contains("island__agent-status-icon") && dot("world-clock")?.querySelector("svg.lucide-globe") && !dot("world-clock")?.querySelector(".test-globe"),
    "fuyu-island-pages 的 icons 换掉页头对应页面的图标：Fuyu、内置页、Agent 按钮（保留状态颜色）和插件页");
  await act(async () => setHeaderIcons({ layout: { ...plain, icons: { todo: "no-such-icon" } }, legacy: false }));
  check(await settle(() => dot("todo")?.querySelector("svg.lucide-list-todo") && !dot("todo")?.querySelector("svg.lucide-star") && dot("panel:fuyu")?.querySelector("svg.lucide-house")), "不认识的图标名等图标目录加载完后按默认图标画");
  await act(async () => setHeaderIcons({ layout: { ...plain, icons: { "panel:fuyu": "text" } }, legacy: false }));
  await act(async () => storePageLayout({ ...plain, names: { "panel:fuyu": "工作台", todo: "清单" } }));
  check(dot("panel:fuyu")?.querySelector(".panel-text-icon")?.textContent === "工作台" && /^清单/.test(dot("todo")?.getAttribute("aria-label") ?? ""),
    "fuyu-island-pages 的 names 改掉页签名：首页的文字图标显示自定义名，内置页的名字跟着换");
  await act(async () => storePageLayout(plain));
  await act(async () => setHeaderIcons({ layout: null, legacy: false }));
}

function storePageLayout(layout: IslandPagesLayout) {
  saveIslandPages(layout);
  window.dispatchEvent(new StorageEvent("storage", { key: ISLAND_PAGES_KEY }));
}

const headerHelpers = (header: HTMLElement) => ({
  root: expandedRoot, header, check, settle, frame,
  textTab: (on: boolean) => act(async () => setHeaderIcons({ layout: on ? { order: [], hidden: [], icons: { "panel:fuyu": "text" } } : null, legacy: false })),
});

async function runChecks() {
  const dots = () => [...expandedRoot.querySelectorAll<HTMLButtonElement>(".editor-dots .dot-button")];
  const labels = dots().map((dot) => dot.getAttribute("aria-label") ?? "");
  const pluginDots = dots().filter((dot) => dot.classList.contains("dot-button--plugin"));
  check(pluginDots.length === 3, `插件注册的三个岛页面都出现在页头（${labels.join(" / ")}）`);
  check(!expandedRoot.querySelector('.dot-button[data-page="hidden"]'), "写了 headerDot: false 的插件页面不进页头");
  const builtinCount = dots().length - pluginDots.length;
  check(dots().slice(builtinCount).every((dot) => dot.classList.contains("dot-button--plugin")), "插件页面排在内置页面后面");
  const clock = expandedRoot.querySelector<HTMLButtonElement>('.dot-button[data-page="world-clock"]')!;
  check(/^世界时钟 \((Alt\+|⌥)\d\)$/.test(clock.getAttribute("aria-label") ?? ""), `带标题的页面用插件给的标题，并标出 Alt+数字（${clock.getAttribute("aria-label")}）`);
  check(clock.querySelector(".test-globe"), "页头按钮画插件给的图标");
  const monitor = expandedRoot.querySelector<HTMLButtonElement>('.dot-button[data-page="@test/system-monitor"]')!;
  check(monitor.getAttribute("aria-label")?.startsWith("系统监控"), `没带标题的旧插件退回插件的显示名（${monitor.getAttribute("aria-label")}）`);
  check(monitor.querySelector(".plugin-icon__letter")?.textContent === "系", "插件的图标出错时换成标题的第一个字，页头照常显示");
  const issues = expandedRoot.querySelector<HTMLButtonElement>('.dot-button[data-page="@test/github-issues"]')!;
  check(issues.getAttribute("aria-label")?.startsWith("github-issues"), `连显示名也没有时退回包名（${issues.getAttribute("aria-label")}）`);
  check(issues.querySelector(".plugin-icon__letter")?.textContent === "G", "没给图标的页面显示标题的第一个字");

  await act(async () => clock.click());
  await frame();
  check(expandedRoot.querySelector(".test-clock-page") && clock.getAttribute("aria-pressed") === "true", "点页头按钮打开插件页面，按钮变成当前页");
  const headerBox = expandedRoot.querySelector<HTMLElement>(".island__header")!.getBoundingClientRect();
  const tab = clock.getBoundingClientRect();
  const pill = expandedRoot.querySelector<HTMLElement>(".island__page-pill")!;
  const near = (value: string, expected: number) => Math.abs(parseFloat(value) - expected) < 0.5;
  check(pill.dataset.shown === "true" && near(pill.style.left, tab.left - headerBox.left) && near(pill.style.right, headerBox.right - tab.right) && near(pill.style.height, tab.height),
    `页签胶囊盖在当前页的按钮上（胶囊 ${pill.style.left} / ${pill.style.right}，按钮 ${tab.left - headerBox.left} / ${headerBox.right - tab.right}）`);
  const digit = Number(/(?:Alt\+|⌥)(\d)\)/.exec(clock.getAttribute("aria-label") ?? "")?.[1]);
  check(pageForAltDigit(FEATURES, digit) === "world-clock", `Alt+${digit} 切到同一个插件页面`);
  await act(async () => goTo("todo"));
  const header = expandedRoot.querySelector<HTMLElement>(".island__header")!;
  const dotsBox = expandedRoot.querySelector<HTMLElement>(".editor-dots")!.getBoundingClientRect();
  const actions = expandedRoot.querySelector<HTMLElement>(".window-actions")!.getBoundingClientRect();
  check(dotsBox.right <= actions.left + 0.5 && header.scrollWidth <= header.clientWidth + 0.5, "多了插件页面，页头的按钮也不压住右边的操作按钮");

  const extra = await act(async () => Array.from({ length: 10 }, (_, index) =>
    registry.add("island.page/v1", { id: `more-${index}`, component: ClockPage, title: `More ${index}` }, `@test/more-${index}`, external)));
  await act(async () => goTo("more-9"));
  await frame();
  await checkHeaderMoreMenu(headerHelpers(header));
  await act(async () => {
    for (const remove of extra) remove();
    goTo("todo");
  });
  await checkHeaderTabFit(headerHelpers(header));

  const bar = () => collapsedRoot.querySelector<HTMLElement>(".island__collapsed")!;
  const fits = (selector: string) => {
    const chip = bar().querySelector<HTMLElement>(selector)!;
    const [box, shell] = [chip.getBoundingClientRect(), bar().getBoundingClientRect()];
    return box.left >= shell.left - 0.5 && box.right <= shell.right + 0.5 && chip.scrollWidth <= chip.clientWidth + 0.5 && box.height <= 24;
  };
  check(fits(".test-clock-chip") && !bar().querySelector(".island__active-task")?.matches(":empty"), "收起条上插件的收起项完整显示，不被挤掉，待办摘要也还在");

  const opener = bar().querySelector<HTMLElement>('.island__collapsed-opener[data-opens-page="world-clock"]')!;
  check(opener?.contains(bar().querySelector(".test-clock-chip")) && opener.getAttribute("role") === "button" && opener.tabIndex === 0, "写了 opens 的收起项整项是一个能聚焦的按钮");
  await act(async () => bar().querySelector<HTMLElement>(".test-clock-chip b")!.click());
  await frame();
  check(opened.join() === "world-clock" && expandedRoot.querySelector(".test-clock-page"), `点收起项打开自己的岛页面，只打开一次，收起条本身不再顺带打开别的页（${opened.join(" / ")}）`);
  for (const key of ["Enter", " "]) {
    await act(async () => goTo("todo"));
    await act(async () => {
      opener.focus();
      opener.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
    await frame();
    check(expandedRoot.querySelector(".test-clock-page") && opened[opened.length - 1] === "world-clock", `收起项有焦点时按${key === " " ? "空格" : " Enter "}也打开插件页`);
  }
  await act(async () => goTo("todo"));

  const MonitorChip = () => <span className="test-monitor-chip">M</span>;
  const TodoChip = () => <span className="test-todo-chip">T</span>;
  const strays = await act(async () => [
    registry.add("island.collapsed/v1", { id: "monitor-bar", opens: "world-clock", component: MonitorChip }, "@test/system-monitor", external),
    registry.add("island.collapsed/v1", { id: "hidden-bar", opens: "todo", component: TodoChip }, "@test/hidden", external),
  ]);
  await frame();
  const before = opened.length;
  for (const chip of [".test-monitor-chip", ".test-todo-chip"]) {
    const element = bar().querySelector<HTMLElement>(chip)!;
    check(element && !element.closest(".island__collapsed-opener"), `opens 指向别的插件或内置页的收起项照常显示，但不变成按钮（${chip}）`);
    await act(async () => element.click());
  }
  check(opened.length === before && !expandedRoot.querySelector(".test-clock-page"), "点它们什么都不打开");
  check(warnings.some((line) => line.includes("monitor-bar from @test/system-monitor opens world-clock")) && warnings.some((line) => line.includes("hidden-bar from @test/hidden opens todo")), "两条都在控制台记了告警");
  await act(async () => {
    for (const remove of strays) remove();
  });

  const cell = () => bar().querySelector<HTMLElement>('.island__collapsed-fit[data-fit-item="world-clock-bar"]')!;
  const clockDot = () => expandedRoot.querySelector<HTMLElement>('.dot-button[data-page="world-clock"]')!;
  const marked = () => [...document.querySelectorAll<HTMLElement>("[data-spotlight]")];
  const lit = () => marked().filter((element) => getComputedStyle(element).animationName === SPOTLIGHT_ANIMATION);
  const cellWidth = cell().offsetWidth;
  await act(async () => {
    localStorage.setItem("fuyu-collapsed-items", JSON.stringify({ version: 1, items: [{ id: "world-clock-bar", zone: "right" }] }));
    window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-collapsed-items" }));
  });
  check(marked().length === 0, "平时岛上没有哪一项被点亮");
  await act(async () => islandSpotlight.request("@test/system-monitor"));
  check(lit().length === 1 && lit()[0] === expandedRoot.querySelector('.dot-button[data-page="@test/system-monitor"]'), "刚装的插件只有岛页面时，亮的是页头上它的按钮");
  await act(async () => islandSpotlight.request("@test/world-clock"));
  await frame();
  check(lit().length === 2 && lit().includes(cell()) && lit().includes(clockDot()), `刚装的插件在岛上的位置亮一下：收起时是它那一格，展开时是页头上它的按钮（${lit().length}）`);
  check(marked().every((element) => element.matches('[data-fit-item="world-clock-bar"], [data-page="world-clock"]')), "别的插件和内置项不亮");
  check(cell().offsetWidth === cellWidth && getComputedStyle(cell()).outlineStyle === "solid", "亮的是一圈描边，那一格不变宽");
  for (let waited = 0; marked().length > 0 && waited < 180; waited += 1) await frame();
  check(marked().length === 0 && islandSpotlight.owner() === null, "亮完两下就结束，之后展开或收起都不再亮");
  await checkCustomPanel();
  await checkPageIcons();
  results.textContent = `${messages.join("\n")}\n\nALL PASS (${messages.length})`;
  results.dataset.result = "passed";
}

try {
  await act(async () => {
    createRoot(expandedRoot).render(<StrictMode><Expanded /></StrictMode>);
    createRoot(collapsedRoot).render(<StrictMode><Collapsed /></StrictMode>);
  });
  await frame();
  await runChecks();
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
