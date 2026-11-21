import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandPages } from "../../src/windows/island/IslandPages";
import { useCustomPanelPages } from "../../src/windows/island/custom-panels/useCustomPanelPages";
import type { IslandFeatures } from "../../src/windows/island/features";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import { FUYU_PAGE_ID } from "../../src/lib/settings/customPanels";
import { normalizeSettings } from "../../src/lib/settings/settings";
import type { IslandSettings, WidgetEntrance } from "../../src/lib/settings/types";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => undefined, { shouldMockEvents: true });
const query = new URLSearchParams(location.search);
const fixed = query.get("effect") as WidgetEntrance | null;

const TOTAL = "128";
const Gauge = () => (
  <div className="island-widget test-gauge">
    <span className="test-total" data-enter="count">{TOTAL}</span>
    <svg viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
      <circle data-enter="sweep" cx="21" cy="21" r="16" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="60 100.5" />
    </svg>
  </div>
);
const Plain = () => <div className="island-widget test-plain">plain widget</div>;
if (query.has("real")) {
  localStorage.removeItem("fuyu-custom-panels");
  await Promise.all([import("../../src/features/system-widgets/plugin/widget"), import("../../src/features/daily-widgets/plugin/widget")]);
} else {
  const registry = windowSlots("island");
  registry.add("island.widget/v1", { id: "test-gauge", sizes: ["s"], label: "Gauge", component: Gauge }, "@test/gauge", { external: true });
  registry.add("island.widget/v1", { id: "test-plain", sizes: ["s"], label: "Plain", component: Plain }, "@test/plain", { external: true });
  registry.add("island.widget/v1", { id: "test-other", sizes: ["s"], label: "Other", component: Plain }, "@test/other", { external: true });
  localStorage.setItem("fuyu-custom-panels", JSON.stringify({ version: 1, panels: [{ id: "fuyu", name: "", icon: "star", mode: "grid", items: [
    { widget: "test-gauge", size: "s", x: 0, y: 0, w: 15, h: 15 },
    { widget: "test-plain", size: "s", x: 16, y: 0, w: 15, h: 15 },
    { widget: "test-other", size: "s", x: 32, y: 0, w: 15, h: 15 },
  ] }] }));
}

const FEATURES: IslandFeatures = { todo: true, music: false, clipboard: false, shelf: false, qq: false, wechat: false, qqMail: false, agents: false, translation: false, calendar: false, screenshots: false, timer: false };
const noop = () => {};
type Mode = "collapsed" | "expanded";
let setMode: (mode: Mode) => void = noop;
let setSettings: (settings: IslandSettings) => void = noop;

function CustomPanelPages() {
  useCustomPanelPages();
  return null;
}

function Island() {
  const [mode, changeMode] = useState<Mode>("collapsed");
  const [settings, changeSettings] = useState(() => normalizeSettings({ widgetEntrance: fixed ?? "trace" }));
  setMode = changeMode;
  setSettings = changeSettings;
  return <div className={`stage stage--${mode}`}>
    <CustomPanelPages />
    <IslandShell
      mode={mode} page={FUYU_PAGE_ID} isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled" features={FEATURES}
      onOpenPage={noop} onPageChange={noop} onWindowDragStart={noop} onCollapse={noop}
      onResetPosition={noop} minimizesToTray onMinimize={noop} onOpenSettings={noop} onOpenTranslator={noop} onTuck={noop} onReveal={noop}
      pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <IslandPages page={FUYU_PAGE_ID} mode={mode} settings={settings} features={FEATURES} />
    </IslandShell>
  </div>;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const results = document.getElementById("results")!;
const root = document.getElementById("island")!;
const frame = () => act(async () => { await new Promise(requestAnimationFrame); });
const grid = () => root.querySelector<HTMLElement>(".custom-panel__grid");
const playing = () => grid()?.dataset.entrance ?? null;
const overlay = () => root.querySelector(".custom-panel__entrance");
const total = () => root.querySelector(".test-total")?.textContent ?? "";
const cell = () => root.querySelector<HTMLElement>(".custom-panel__cell[data-widget='test-gauge']");
const clear = (element: HTMLElement | null) => !element || getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)";

async function until(done: () => unknown, frames = 240) {
  for (let waited = 0; waited < frames && !done(); waited += 1) await frame();
  return Boolean(done());
}

async function open(settings: Partial<IslandSettings>) {
  await act(async () => setSettings(normalizeSettings(settings)));
  await act(async () => setMode("expanded"));
}

async function close() {
  await act(async () => setMode("collapsed"));
  await frame();
}

async function runChecks() {
  await open({ widgetEntrance: "trace" });
  check(await until(() => playing() === "trace", 12), `展开后小组件开始出场，用的是设置里选的那一种（${playing()}）`);
  check(root.querySelectorAll(".custom-panel__ghost").length === 3 && root.querySelectorAll(".custom-panel__ghost-trace rect").length === 3 && clear(cell()), "出场期间每张卡片有一块替身底板和一圈描边，真卡片的底色让给替身");
  const seen = new Set<string>();
  check(await until(() => (seen.add(total()), playing() === null)), "出场动效自己结束");
  check([...seen].every((text) => text.length === TOTAL.length) && seen.size > 1, `数字原地跳到位，位数一直不变（${[...seen].slice(0, 4).join(" ")} …）`);
  check(!overlay() && total() === TOTAL && !clear(cell()) && cell()?.getAnimations().length === 0, `结束后替身撤掉，卡片底色回来，数字是真实值（${total()}）`);

  await close();
  const effects: string[] = [];
  for (let round = 0; round < 5; round += 1) {
    await open({ widgetEntrance: "shuffle" });
    check(await until(() => playing() !== null || overlay(), 12), `轮播第 ${round + 1} 次展开有出场动效`);
    effects.push(playing() ?? "curtain");
    await close();
    check(!overlay() && total() === TOTAL, `出场到一半收起，替身马上撤掉，数字回到真实值（${total()}）`);
  }
  check(effects.every((effect, at) => at === 0 || effect !== effects[at - 1]) && !effects.includes("fade"), `轮播每次展开换一种，不连着重复（${effects.join(" → ")}）`);

  await open({ widgetEntrance: "trace", islandMotion: "none" });
  for (let waited = 0; waited < 8; waited += 1) await frame();
  check(!overlay() && playing() === null, "开合动画选「无动画」时不出场");
  await close();

  await open({ widgetEntrance: "fade", widgetDataMotion: true });
  check(await until(() => overlay(), 12) && playing() === null && root.querySelectorAll(".custom-panel__ghost").length === 0, "选「整体淡入」时没有替身，数据动效照常");
  check(await until(() => !overlay()) && total() === TOTAL, "数据动效结束后数字是真实值");
  await close();

  await open({ widgetEntrance: "fade", widgetDataMotion: false });
  for (let waited = 0; waited < 8; waited += 1) await frame();
  check(!overlay() && playing() === null && total() === TOTAL && !clear(cell()), "「整体淡入」加关掉数据动效，就是原来的样子");
  results.textContent = `${messages.join("\n")}\n\nALL PASS (${messages.length})`;
  results.dataset.result = "passed";
}

try {
  await act(async () => {
    createRoot(root).render(<StrictMode><Island /></StrictMode>);
  });
  await frame();
  if (fixed) {
    results.textContent = `手动预览：${fixed}（点页面任意位置开合）`;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
    let expanded = false;
    document.addEventListener("click", () => {
      expanded = !expanded;
      setMode(expanded ? "expanded" : "collapsed");
    });
  } else await runChecks();
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
