import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { useCollapsedGauges } from "../../src/windows/island/useCollapsedGauges";
import { useCollapsedWidth } from "../../src/windows/island/useCollapsedWidth";
import { MAX_FITTED_COLLAPSED_WIDTH } from "../../src/windows/island/layout";
import type { IslandFeatures } from "../../src/windows/island/features";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import { measureBarUsage } from "../../src/features/plugin-kernel/barMeasure";
import { useFixtureLines } from "./islandLines";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => undefined, { shouldMockEvents: true });
localStorage.removeItem("fuyu-collapsed-items");

const registry = windowSlots("island");
const external = { external: true };
const FEATURES: IslandFeatures = { todo: true, music: false, clipboard: true, shelf: false, qq: false, wechat: false, qqMail: false, agents: true, translation: false, calendar: false, screenshots: false, timer: false };
const noop = () => {};
const chipStyle: CSSProperties = { display: "inline-flex", gap: 4, whiteSpace: "nowrap", fontSize: 12 };

let setCpu: (value: number) => void = noop;
function MonitorChip() {
  const [cpu, set] = useState(86);
  setCpu = set;
  return <span className="test-monitor-chip" style={chipStyle}><span>CPU {cpu}%</span><span>·</span><span>内存 52%</span></span>;
}
const OldChip = () => <span className="test-old-chip" style={chipStyle}>TYO</span>;
const LongChip = () => <span className="test-long-chip" style={chipStyle}>{"一段很长很长的插件收起项文字，".repeat(4)}</span>;

const WeatherChip = () => <span className="test-weather-chip" style={chipStyle}>晴 18°</span>;
const CountdownChip = () => <span className="test-countdown-chip" style={chipStyle}>还有 12 天</span>;
const WideChip = ({ label }: { label: string }) => <span className="test-wide-chip" style={{ ...chipStyle, width: 120 }}>{label}</span>;

let width = 0;
let setTodo: (title: string | null) => void = noop;
let setScale: (scale: number) => void = noop;
let setExtra: (extra: number) => void = noop;
function Collapsed() {
  const [todoTitle, set] = useState<string | null>("整理下周的发布说明");
  const [collapsedScale, updateScale] = useState(1);
  const [widthExtra, updateExtra] = useState(0);
  setTodo = set;
  setScale = updateScale;
  setExtra = updateExtra;
  useFixtureLines({ todoTitle });
  const slots = useCollapsedGauges(false);
  width = useCollapsedWidth({ barText: true, noticeText: null, showTitle: false, widthExtra, peeking: false, slots, collapsedScale });
  const stageStyle = {
    "--collapsed-island-width": `${width}px`,
    ...(collapsedScale !== 1 ? { "--island-scale": collapsedScale, "--island-collapsed-scale": collapsedScale } : {}),
  } as CSSProperties;
  return <div className="stage stage--collapsed" style={stageStyle}>
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
const root = document.getElementById("collapsed")!;
const bar = () => root.querySelector<HTMLElement>(".island__collapsed")!;

async function frame() {
  await act(async () => { await new Promise(requestAnimationFrame); });
}

async function settle(ready: () => boolean, label: string) {
  for (let tries = 0; tries < 40; tries += 1) {
    await frame();
    if (ready()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  throw new Error(`timed out: ${label}`);
}

function whole(selector: string) {
  const chip = bar().querySelector<HTMLElement>(selector);
  if (!chip) return false;
  const [box, shell] = [chip.getBoundingClientRect(), bar().getBoundingClientRect()];
  const fit = chip.closest<HTMLElement>(".island__collapsed-fit");
  return box.left >= shell.left - 0.5 && box.right <= shell.right + 0.5 && fit !== null && !fit.hasAttribute("data-clipped");
}

async function runChecks() {
  await frame();
  const plain = width;
  check(plain > 0 && !bar().querySelector(".island__collapsed-fit"), `没有插件收起项时宽度照旧（${plain}px）`);

  const removeOld = await act(async () => registry.add("island.collapsed/v1", { id: "old-bar", width: 120, component: OldChip }, "@test/old", external));
  await settle(() => width > plain, "declared width");
  check(Math.abs(width - (plain + 128)) <= 4 && whole(".test-old-chip"), `老插件声明的 width: 120 当下限，内容更窄也按 120 加宽（${plain} → ${width}px）`);
  await act(async () => removeOld());
  await settle(() => width === plain, "declared width removed");

  const removeMonitor = await act(async () => registry.add("island.collapsed/v1", { id: "monitor-bar", hideable: true, component: MonitorChip }, "@test/system-monitor", external));
  await settle(() => width > plain && whole(".test-monitor-chip"), "dynamic text");
  check(whole(".test-monitor-chip") && !bar().querySelector(".island__active-task")?.matches(":empty"), `没声明 width 的动态文字按实际宽度算，CPU 和内存都完整显示，待办摘要也还在（${width}px）`);
  const seen = new Set([width]);
  for (const cpu of [8, 100, 9, 99, 12, 100, 7, 86]) {
    await act(async () => setCpu(cpu));
    await frame();
    seen.add(width);
  }
  check(seen.size <= 2 && whole(".test-monitor-chip"), `读数每秒变化时岛宽最多涨一次，不来回变（${[...seen].join(" / ")}px）`);
  const fitting = measureBarUsage(0).items.find((item) => item.id === "monitor-bar")?.box ?? null;
  check(fitting !== null && !fitting.clipped && fitting.wanted === fitting.width && fitting.width === bar().querySelector<HTMLElement>(".test-monitor-chip")!.offsetWidth, `bar usage: an item that fits is measured at its content width (${fitting?.width}px)`);

  const removeLong = await act(async () => registry.add("island.collapsed/v1", { id: "long-bar", component: LongChip }, "@test/long", external));
  await settle(() => width === MAX_FITTED_COLLAPSED_WIDTH, "cap");
  await settle(() => !bar().querySelector(".test-long-chip") && bar().querySelector(".island__more-chip")?.textContent === "+1", "behind +N");
  const shell = bar().getBoundingClientRect();
  const quiet = bar().querySelector<HTMLElement>(".island__quiet-button")!.getBoundingClientRect();
  const more = bar().querySelector<HTMLElement>(".island__more-chip")!.getBoundingClientRect();
  check(width === MAX_FITTED_COLLAPSED_WIDTH && quiet.right <= shell.right + 0.5 && quiet.width > 0 && more.right <= quiet.left + 0.5, `超过上限时岛宽停在 ${MAX_FITTED_COLLAPSED_WIDTH}px，「+N」和右边的收起按钮都在岛里`);
  check(whole(".test-monitor-chip") && !bar().querySelector(".island__collapsed-fit[data-clipped]"), "放不下的插件收起项整项收进「+N」，留下的完整显示，不再在右端裁掉");
  check(JSON.parse(localStorage.getItem("fuyu-collapsed-overflow") ?? "[]").join() === "long-bar", "收进「+N」的项目记给设置窗口");
  const usage = measureBarUsage(1);
  const [monitorBox, longBox] = ["monitor-bar", "long-bar"].map((id) => usage.items.find((item) => item.id === id)?.box ?? null);
  check(usage.collapsed && usage.barWidth === bar().offsetWidth && usage.items.map((item) => item.owner).join() === "@test/system-monitor,@test/long", `bar usage: the island reports the bar width (${usage.barWidth}px) and whose item each one is`);
  check(monitorBox !== null && !monitorBox.clipped && monitorBox.left >= 0 && monitorBox.left + monitorBox.width <= usage.barWidth! && longBox === null, `bar usage: the item that stays is whole and the one behind +N has no box (${monitorBox?.width}/${monitorBox?.wanted}px)`);

  await act(async () => {
    removeLong();
    removeMonitor();
  });
  await settle(() => width === plain, "all removed");
  check(width === plain && !bar().querySelector(".island__collapsed-fit"), "插件收起项都撤掉后宽度回到原来");

  const removeWeather = await act(async () => registry.add("island.collapsed/v1", { id: "weather-bar", component: WeatherChip }, "@test/weather", external));
  const removeCountdown = await act(async () => registry.add("island.collapsed/v1", { id: "countdown-bar", component: CountdownChip }, "@test/countdown", external));
  await settle(() => whole(".test-weather-chip") && whole(".test-countdown-chip"), "two items with a todo");
  const withTodo = width;
  await act(async () => setTodo(null));
  await settle(() => width < 220 && whole(".test-weather-chip") && whole(".test-countdown-chip"), "bare bar");
  const quietBox = bar().querySelector<HTMLElement>(".island__quiet-button")!.getBoundingClientRect();
  const barBox = bar().getBoundingClientRect();
  check(width < 220 && whole(".test-weather-chip") && whole(".test-countdown-chip") && quietBox.right <= barBox.right + 0.5, `没有待办、只有两个收起项时岛贴着内容变窄，两项都完整（${withTodo} → ${width}px）`);
  const chipsRight = bar().querySelector<HTMLElement>(".test-countdown-chip")!.getBoundingClientRect().right;
  check(barBox.right - quietBox.right <= 24 && quietBox.left - chipsRight <= 24, `变窄后没有大段空白（右边距 ${Math.round(barBox.right - quietBox.right)}px）`);
  await act(async () => setTodo("整理下周的发布说明"));
  await settle(() => width === withTodo, "todo back");
  check(width === withTodo, `待办回来后宽度和原来一样（${width}px）`);
  await act(async () => {
    removeWeather();
    removeCountdown();
  });
  await settle(() => width === plain, "bare items removed");

  const removeWides = await act(async () => [
    registry.add("island.collapsed/v1", { id: "wide-1", component: () => <WideChip label="甲项" /> }, "@test/wide-1", external),
    registry.add("island.collapsed/v1", { id: "wide-2", component: () => <WideChip label="乙项" /> }, "@test/wide-2", external),
    registry.add("island.collapsed/v1", { id: "wide-3", component: () => <WideChip label="丙项" /> }, "@test/wide-3", external),
  ]);
  await act(async () => {
    setTodo(null);
    setScale(1.4);
  });
  await settle(() => width >= 380 && bar().querySelectorAll(".test-wide-chip").length === 3, "scaled bare bar fits");
  check(!bar().querySelector(".island__more-chip") && bar().querySelectorAll(".test-wide-chip").length === 3, `放大到 1.4 倍且没有文字时，没到 520 上限的项目不被误收进「+N」（${width}px）`);
  await act(async () => setExtra(180));
  await settle(() => width === MAX_FITTED_COLLAPSED_WIDTH, "scaled bare bar widens with extra");
  check(width === MAX_FITTED_COLLAPSED_WIDTH && !bar().querySelector(".island__more-chip"), `放大到 1.4 倍且拉宽 +180 时岛宽能到上限 ${MAX_FITTED_COLLAPSED_WIDTH}px（${width}px）`);

  const removeBareLong = await act(async () => registry.add("island.collapsed/v1", { id: "bare-long", component: LongChip }, "@test/bare-long", external));
  await settle(() => bar().querySelector(".island__more-chip") !== null, "bare bar overflows");
  await frame();
  check(width === MAX_FITTED_COLLAPSED_WIDTH && bar().querySelectorAll(".test-wide-chip").length >= 2, `没有文字但真的超出上限收进「+N」时，岛宽稳在 ${MAX_FITTED_COLLAPSED_WIDTH}px 不塌缩（${width}px）`);

  await act(async () => {
    removeBareLong();
    removeWides.forEach((remove) => remove());
    setExtra(0);
    setScale(1);
    setTodo("整理下周的发布说明");
  });
  await settle(() => width === plain && !bar().querySelector(".island__more-chip"), "scaled bare bar cleaned up");

  results.textContent = `${messages.join("\n")}\n\nALL PASS (${messages.length})`;
  results.dataset.result = "passed";
}

try {
  await act(async () => {
    createRoot(root).render(<StrictMode><Collapsed /></StrictMode>);
  });
  await runChecks();
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
