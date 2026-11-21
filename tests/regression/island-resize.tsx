import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandResize } from "../../src/windows/island/resize/IslandResize";
import { useIslandResize } from "../../src/windows/island/resize/useIslandResize";
import { getResizeState, setResizeEditing } from "../../src/windows/island/resize/session";
import { islandPageSize } from "../../src/windows/island/pageSize";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";
import { until } from "./pollUntil";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window.screen, "availWidth", { value: 1920 });
Object.defineProperty(window.screen, "availHeight", { value: 1080 });
const automated = new URLSearchParams(location.search).has("test");
const started: { widthSign: number; height: boolean; reach: { width: number; height: number } | null }[] = [];
mockIPC((command, args) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
  if (command === "start_island_resize") started.push(args as (typeof started)[number]);
}, { shouldMockEvents: true });

let latest: IslandSettings = { ...DEFAULT_SETTINGS, panelWidth: 800, maxPanelHeight: 306, pageSizes: {}, collapsedWidthExtra: 0 };
let setExpanded: (expanded: boolean) => void;

function Fixture() {
  const [settings, setSettings] = useState(latest);
  const [expanded, changeExpanded] = useState(true);
  setExpanded = changeExpanded;
  latest = settings;
  const pageSize = islandPageSize(settings, "music");
  const model = useIslandResize(settings, (next) => { latest = next; setSettings(next); }, "music", pageSize);
  return <div className="stage" style={{ "--collapsed-island-width": `${340 + settings.collapsedWidthExtra}px`, "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": `${pageSize.width}px`, "--expanded-island-height": `${pageSize.height}px`, "--island-top-fillet-size": 8 } as CSSProperties}>
    <IslandShell
      mode={expanded ? "expanded" : "collapsed"} page="music" isTucked={false}
      isDetached={false} showTitle={false}
      showCollapsedText appearanceMode="classic" nativeGlassState="disabled"
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      onOpenPage={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}
      resize={<IslandResize model={model} expanded={expanded} enabled size={pageSize} extra={settings.collapsedWidthExtra} />}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector);
const islandBox = () => q(".island")!.getBoundingClientRect();
const root = () => q(".island-resize")!;
const badge = () => q(".island-resize__badge")!;
const last = () => started[started.length - 1];
const topAt = (x: number, y: number) => document.elementFromPoint(x, y) ?? q(".island")!;
const hover = (x: number, y: number) => act(async () => {
  topAt(x, y).dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x, clientY: y }));
});
const pressAt = async (x: number, y: number) => {
  const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  await act(async () => { topAt(x, y).dispatchEvent(event); });
  return event;
};
const press = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return pressAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
};
const cursor = () => document.documentElement.dataset.islandResizeCursor;
const resize = (width: number, height: number, done: boolean) => act(async () => {
  await emit("island-resize", { width, height, collapsed: false, done });
});
const size = () => latest.pageSizes.music;
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    let box = islandBox();
    const edgeX = box.right - 4;
    const edgeY = box.top + 140;
    await hover(edgeX, edgeY);
    const under = document.elementFromPoint(edgeX, edgeY);
    check(under && !under.closest(".island-resize") && under.closest(".island__expanded"), "鼠标刚碰到右边时，点下去给的是面板内容，不是改尺寸");
    check(!root().classList.contains("glow-r"), "刚碰到时边还没亮");
    const early = await pressAt(edgeX, edgeY);
    check(!early.defaultPrevented && started.length === 0, "边还没亮时按下不开始改尺寸");
    await until(() => root().classList.contains("glow-r"), 1000);
    check(root().classList.contains("glow-r") && root().classList.contains("half-l"), "停一下后右边亮、对侧半亮");
    const cover = document.createElement("div");
    cover.style.cssText = "position:fixed;inset:0;z-index:9999";
    document.body.append(cover);
    await hover(edgeX, edgeY + 1);
    check(cursor() === "ew-resize", "亮了之后指针变成左右箭头，上面压着透明层也一样");
    await pressAt(edgeX, edgeY);
    check(last()?.widthSign === 1 && last()?.height === false && last()?.reach === null, "拖右边只改宽度，不临时放大窗口");
    await resize(84, 0, false);
    await until(() => size()?.width === 884);
    check(size()?.width === 884 && size()?.height === 306, "拖动按左右一起变算宽度");
    check(badge().classList.contains("is-shown") && badge().textContent?.includes("884 × 306"), "拖动时显示尺寸");
    await resize(236, 0, false);
    await until(() => size()?.width === 1040);
    check(size()?.width === 1040 && badge().textContent?.includes("宽"), "靠近档位时吸到 1040 并写出档位名");
    await resize(236, 0, true);
    await until(() => getResizeState().drag === null);
    check(getResizeState().drag === null && !root().classList.contains("glow-r"), "松手后结束拖动、光收起");

    box = islandBox();
    await hover(box.left + box.width / 2, box.bottom - 10);
    const grab = q(".island-resize__grab")!;
    check(getComputedStyle(grab).pointerEvents === "auto", "鼠标到底部中间时出现拉环");
    await hover(box.left + box.width / 2 - 30, box.bottom - 4);
    await hover(box.left + box.width / 2, box.bottom - 10);
    await new Promise((done) => setTimeout(done, 250));
    check(root().classList.contains("is-near-grab"), "边的亮灭变化后拉环还在");
    await press(grab);
    check(last()?.widthSign === 1 && last()?.height === true, "拉环同时改宽高");
    check(root().classList.contains("glow-l") && root().classList.contains("glow-r") && root().classList.contains("glow-b"), "拖拉环时会变的三条边都亮");
    await resize(0, 254, true);
    await until(() => size()?.height === 560);
    check(size()?.height === 560 && size()?.width === 1040, "往下拉到 560 吸住");

    box = islandBox();
    await hover(box.right - 20, box.bottom - 20);
    const knob = q(".island-resize__knob--r")!;
    check(getComputedStyle(knob).pointerEvents === "auto", "鼠标到右下角时出现旋钮");
    await press(knob);
    check(last()?.reach?.width === 1040 && last()?.reach?.height === 560, "拖旋钮时让窗口临时放大到能装下最大一档（宽大 1040 × 560）");
    await resize(-550, -310, false);
    await until(() => size()?.width === 480);
    check(size()?.width === 480 && size()?.height === 240 && badge().textContent?.includes("紧凑"), "旋钮靠近预设时整档吸到紧凑");
    await resize(-550, -310, true);
    await until(() => getResizeState().drag === null);

    await act(async () => setResizeEditing(true));
    const chips = [...document.querySelectorAll<HTMLButtonElement>(".island-resize__chips button")].map((button) => button.textContent);
    check(chips.join(",") === "紧凑,默认,宽大,完成", "调整模式有三档和完成");
    check(document.querySelectorAll(".island-resize__bead").length === 5 && !q(".island-resize__grab"), "调整模式换成五个圆点，拉环收起");
    await act(async () => [...document.querySelectorAll<HTMLButtonElement>(".island-resize__chips button")].find((button) => button.textContent === "宽大")!.click());
    check(size()?.width === 1040 && size()?.height === 560, "点「宽大」直接换档");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true })); });
    check(size()?.width === 1000, "Shift + 方向键每次 40");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    check(!getResizeState().editing && size()?.width === 480 && size()?.height === 240, "Esc 退出并撤销这次的改动");

    await act(async () => setExpanded(false));
    check(!q(".island-resize__grab") && document.querySelectorAll(".island-resize__cap").length === 2, "折叠岛只有两端的小拉环");
    await until(() => Math.abs(islandBox().width - 340) < 0.5, 2000);
    box = islandBox();
    await hover(box.left + box.width / 2, box.top + 15);
    check(getComputedStyle(q(".island-resize__cap--r")!).opacity === "0", "鼠标在折叠岛中间时不出小拉环");
    await hover(box.left + 4, box.top + 15);
    await until(() => root().classList.contains("glow-l") && getComputedStyle(q(".island-resize__cap--l")!).opacity === "1", 1000);
    check(!q(".island-resize__glow") && getComputedStyle(q(".island-resize__cap--l")!).opacity === "1", "折叠岛的边亮起时只亮小拉环，不再并排多一条亮线");
    await hover(box.left + box.width / 2, box.top + 15);
    await hover(box.left + box.width / 2, box.top + 15);
    let lastWidth = 0;
    await until(() => {
      const width = islandBox().width;
      const settled = width - box.width > 17 && Math.abs(width - lastWidth) < 0.1;
      lastWidth = width;
      return settled;
    }, 2000);
    const grown = islandBox();
    const capBox = q(".island-resize__cap--r")!.getBoundingClientRect();
    check(grown.width - box.width > 17 && capBox.right <= box.right - 6 + 0.5, `悬停把岛撑宽时，小拉环留在没撑宽时的范围里，原生侧不会把它当成岛外`);
    await hover(capBox.left + 2, capBox.top + capBox.height / 2);
    await hover(capBox.left + 2, capBox.top + capBox.height / 2 + 1);
    check(root().classList.contains("is-near-cap-r") && cursor() === "ew-resize", "撑宽时鼠标到小拉环上，拉环出现、指针变成左右箭头");
    await hover(box.left + box.width / 2, 590);
    await until(() => q(".island")!.style.getPropertyValue("--island-hover-lift") === "0.0000" && !root().className.includes("is-near") && !root().className.includes("glow"), 3000);
    await until(() => !badge().classList.contains("is-shown"), 2000);
    check(!badge().classList.contains("is-shown"), "松手一会儿后尺寸标签收起");

    cover.remove();
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

document.documentElement.dataset.islandTopEdge = "attached";
await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：拉环、捏边、旋钮和调整模式。加 ?test=1 运行检查。";
}
