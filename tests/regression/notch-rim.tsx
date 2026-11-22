import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { applyIslandNotch, notchFittedWidth } from "../../src/windows/island/notch";
import type { IslandNotch } from "../../src/windows/island/api";
import type { NotchRimView } from "../../src/windows/island/notch-rim/NotchRim";
import { I18nProvider } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { NOTCH_RIM_STYLES, notchRimLook, type NotchRimLook, type NotchRimStyle } from "../../src/lib/settings/notchRimSettings";
import type { IslandSettings } from "../../src/lib/settings/types";
import { NotchRimSettings } from "../../src/windows/settings/sections/NotchRimSettings";
import { useIslandContributions } from "../../src/features/plugin-kernel/useIslandContributions";
import type { IslandContribution } from "../../src/features/plugin-kernel/islandContributions";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
}, { shouldMockEvents: true });

const NOTCH: IslandNotch = { width: 200, height: 32 };
const OFF = notchRimLook(DEFAULT_SETTINGS, "Island");
const look = (style: NotchRimStyle, patch: Partial<NotchRimLook> = {}): NotchRimLook => ({ ...OFF, style, ...patch });
const view = (island: NotchRimLook, panel: NotchRimLook = OFF, paused = false): NotchRimView => ({ island, panel, accent: "#74d6ff", paused });

type State = { rim: NotchRimView | null; expanded: boolean; tucked: boolean; glow: IslandContribution[] };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ rim: null, expanded: false, tucked: false, glow: [] });
  change = (next) => setState((current) => ({ ...current, ...next }));
  useIslandContributions("@test/notch-rim", "glow", state.glow);
  return <div className="stage" style={{ "--collapsed-island-width": `${notchFittedWidth(300, NOTCH, 1)}px`, "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": "600px", "--expanded-island-height": "300px" } as CSSProperties}>
    <IslandShell
      mode={state.expanded ? "expanded" : "collapsed"} page="todo" isTucked={state.tucked} isDetached={false} showTitle={false}
      showCollapsedText={false} appearanceMode="classic" nativeGlassState="disabled" notchRim={state.rim}
      features={{ todo: true } as never}
      onOpenPage={() => {}} onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

let changeSettings: (settings: IslandSettings) => void;
function SettingsFixture() {
  const [settings, setSettings] = useState<IslandSettings>(DEFAULT_SETTINGS);
  changeSettings = setSettings;
  return <NotchRimSettings settings={settings} onSettingsChange={setSettings} />;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const island = () => document.querySelector<HTMLElement>(".island")!;
const rim = () => document.querySelector<HTMLElement>(".notch-rim");
const svg = () => document.querySelector<SVGSVGElement>(".notch-rim__svg");
const set = (next: Partial<State>) => act(async () => change(next));
async function until(ready: () => unknown, label: string) {
  for (let waited = 0; waited < 3000; waited += 50) {
    if (ready()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  throw new Error(`等不到：${label}`);
}
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
const rimPaint = () => getComputedStyle(island(), "::after").backgroundImage;
const rowTitles = () => [...document.querySelectorAll("#settings .settings-row__title")].map((title) => title.textContent);
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    await act(async () => applyIslandNotch(NOTCH));
    await settle();
    check(!rim(), "默认（全关）时岛上没有边框层，和以前一样");
    const defaultPanelPaint = await (async () => { await set({ expanded: true }); await settle(); return rimPaint(); })();
    await set({ expanded: false });
    await settle();

    await set({ rim: view(look("glow")) });
    await until(svg, "岛屿辉光画出来");
    const shell = island().getBoundingClientRect();
    const fillet = Number.parseFloat(getComputedStyle(document.querySelector(".notch-rim__probe")!).width);
    const drawn = svg()!.getBoundingClientRect();
    check(fillet > 0, "量到了刘海模式的反向弧半径");
    check(Math.abs(drawn.left - (shell.left - fillet - 40)) < 1 && Math.abs(drawn.width - (shell.width + 2 * fillet + 80)) < 1, "边框层从左边弧尖外到右边弧尖外，盖住整条轮廓和外发光的余量");
    check(Math.abs(drawn.top - shell.top) < 1 && Math.abs(drawn.height - (shell.height + 40)) < 1, "边框层贴着屏幕顶边，底下留出外发光的地方");
    check(svg()!.querySelector("path[d^='M0 0 A']"), "描边从左边弧尖开始顺着反向弧走");
    check(getComputedStyle(rim()!).pointerEvents === "none", "边框层不挡点击");

    for (const style of NOTCH_RIM_STYLES) {
      await set({ rim: view(look(style, { status: style === "off" })) });
      await until(() => rim()?.dataset.style === style && Boolean(svg()) === (style !== "off"), `样式「${style}」`);
      check(rim()?.dataset.style === style && Boolean(svg()) === (style !== "off"), `岛屿样式「${style}」${style === "off" ? "不画" : "画出来"}`);
    }
    await set({ rim: view(look("comet")) });
    await until(() => svg()?.querySelector(".notch-rim__anim"), "环游开始走");
    check(svg()!.querySelector(".notch-rim__anim--comet-head") && svg()!.querySelector(".notch-rim__anim--comet-tail"), "环游有一颗走动的光点和拖尾");
    await set({ rim: view(look("comet", { motion: false })) });
    await until(() => svg() && !svg()!.querySelector(".notch-rim__anim"), "环游停下");
    check(!svg()!.querySelector(".notch-rim__anim"), "关掉动效后环游停成静止的辉光");

    const strokes = () => [...svg()?.querySelectorAll<SVGPathElement>(":scope > g path") ?? []].map((path) => path.style.stroke);
    await set({ rim: view(look("off", { status: true })) });
    await until(() => rim() && !svg(), "跟随状态开着、没有状态时不画");
    await set({ glow: [{ kind: "glow", color: "#12b7f5", priority: 60, reason: "messages.qq" }] });
    await until(svg, "新消息亮起");
    check(strokes().length > 0 && strokes().every((stroke) => stroke === "rgb(18, 183, 245)"), "样式是「关」时新消息也亮一下，用来源软件的颜色");
    check(svg()!.querySelector(".notch-rim__anim--ripple"), "状态来的那一刻扫一圈");
    await set({ glow: [{ kind: "glow", color: "#ff9f0a", priority: 70, reason: "agent-status.waiting", pulse: true }] });
    await until(() => svg()?.querySelector(".notch-rim__anim--pulse"), "Agent 等你时闪");
    check(strokes().every((stroke) => stroke === "rgb(255, 159, 10)"), "Agent 等你时用橙色闪");
    await set({ glow: [{ kind: "glow", color: "#30d158", priority: 90, reason: "device-use.camera" }] });
    await until(() => !svg(), "摄像头不亮边框");
    check(true, "摄像头、麦克风的状态归摄像头刘海内描边管，边框不跟着亮");
    await set({ glow: [] });

    await set({ rim: view(look("glow"), look("hairline")), expanded: true });
    await settle();
    check(rim()?.dataset.style === "hairline" && svg(), "展开后换成面板自己的样式");
    check(rimPaint() === "none" && defaultPanelPaint !== "none", "面板画了边框时，原来那圈淡白细线让开，不叠两条");
    await set({ rim: view(look("glow"), OFF) });
    await until(() => !svg(), "面板边框撤掉");
    check(!svg() && rimPaint() === defaultPanelPaint, "面板样式是「关」时不画，保留原来的细线");
    await set({ rim: view(look("aurora"), look("aurora"), true) });
    await until(() => svg(), "面板极光画出来");
    check(rim()!.classList.contains("notch-rim--paused"), "岛隐藏或前台全屏时动画停下");
    await set({ expanded: false, tucked: true });
    await settle();
    check(!rim(), "贴边收起时不画边框");
    await set({ tucked: false });
    await settle();

    check(rowTitles().join("|") === "岛屿|跟随状态变色|面板同岛屿|面板|跟随状态变色", "设置默认只列样式和跟随状态，其余选项等开了样式再出现");
    await act(async () => changeSettings({ ...DEFAULT_SETTINGS, notchRimIslandStyle: "glow", notchRimIslandColor: "custom", notchRimPanelSame: true }));
    const titles = rowTitles();
    check(["颜色", "自定义颜色", "粗细", "强度", "动效"].every((title) => titles.includes(title)), "开了样式后能调颜色、自定义颜色、粗细、强度和动效");
    check(!titles.includes("面板"), "面板同岛屿时不再单独列面板的选项");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
  }
}

const root = createRoot(document.getElementById("fixture")!);
const settingsRoot = createRoot(document.getElementById("settings")!);
await act(async () => {
  root.render(<StrictMode><Fixture /></StrictMode>);
  settingsRoot.render(<StrictMode><I18nProvider><SettingsFixture /></I18nProvider></StrictMode>);
});
const demo = new URLSearchParams(location.search).get("style") as NotchRimStyle | null;
if (demo) {
  await act(async () => applyIslandNotch(NOTCH));
  const params = new URLSearchParams(location.search);
  const shown = look(demo, { color: (params.get("color") as NotchRimLook["color"] | null) ?? OFF.color, width: Number(params.get("width")) || OFF.width });
  await set({ rim: view(shown, shown), expanded: params.has("expanded") });
  results.textContent = `演示：${demo}`;
} else {
  await runChecks();
}
