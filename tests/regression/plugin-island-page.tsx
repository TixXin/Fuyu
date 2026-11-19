import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandPages } from "../../src/windows/island/IslandPages";
import { useCollapsedGauges } from "../../src/windows/island/useCollapsedGauges";
import { useCollapsedWidth } from "../../src/windows/island/useCollapsedWidth";
import { pageForAltDigit, type IslandFeatures } from "../../src/windows/island/features";
import type { IslandPage } from "../../src/windows/island/types";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import { updatePluginNames } from "../../src/features/plugin-kernel/pluginNames";
import { normalizeSettings } from "../../src/lib/settings/settings";
import { useFixtureLines } from "./islandLines";

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
registry.add("island.collapsed/v1", { id: "world-clock-bar", width: 66, hideable: true, component: ClockChip }, "@test/world-clock", external);
updatePluginNames([{ id: "@test/system-monitor", displayName: { "zh-CN": "系统监控", en: "System Monitor" } }]);

const FEATURES: IslandFeatures = { todo: true, music: false, clipboard: true, shelf: false, qq: false, wechat: false, qqMail: false, agents: true, translation: false, calendar: false, screenshots: false, timer: false };
const settings = normalizeSettings({ islandMotion: "none" });
const noop = () => {};

let goTo: (page: IslandPage) => void = noop;

function Expanded() {
  const [page, setPage] = useState<IslandPage>("todo");
  goTo = setPage;
  return <div className="stage stage--expanded">
    <IslandShell
      mode="expanded" page={page} isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled" features={FEATURES}
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
      onOpenPage={noop} onPageChange={noop} onWindowDragStart={noop} onCollapse={noop}
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

async function frame() {
  await act(async () => { await new Promise(requestAnimationFrame); });
}

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
  const row = expandedRoot.querySelector<HTMLElement>(".editor-dots")!;
  const [rowBox, actionsBox] = [row.getBoundingClientRect(), expandedRoot.querySelector<HTMLElement>(".window-actions")!.getBoundingClientRect()];
  check(dots().length >= 14 && rowBox.right <= actionsBox.left + 0.5 && header.scrollWidth <= header.clientWidth + 0.5, `装了很多插件（${dots().length} 个页面按钮）时页头也不溢出，不压住右边的操作按钮`);
  const last = expandedRoot.querySelector<HTMLElement>('.dot-button[data-page="more-9"]')!.getBoundingClientRect();
  check(row.scrollWidth > row.clientWidth && last.left >= rowBox.left - 0.5 && last.right <= rowBox.right + 0.5, "放不下的按钮在一行里横向滚动，打开的那页的按钮滚到看得见的地方");
  await act(async () => {
    for (const remove of extra) remove();
    goTo("todo");
  });

  const bar = () => collapsedRoot.querySelector<HTMLElement>(".island__collapsed")!;
  const fits = (selector: string) => {
    const chip = bar().querySelector<HTMLElement>(selector)!;
    const [box, shell] = [chip.getBoundingClientRect(), bar().getBoundingClientRect()];
    return box.left >= shell.left - 0.5 && box.right <= shell.right + 0.5 && chip.scrollWidth <= chip.clientWidth + 0.5 && box.height <= 24;
  };
  check(fits(".test-clock-chip") && !bar().querySelector(".island__active-task")?.matches(":empty"), "收起条上插件的收起项完整显示，不被挤掉，待办摘要也还在");
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
