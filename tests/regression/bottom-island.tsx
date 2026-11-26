import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { useIslandGlass } from "../../src/windows/island/useIslandGlass";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";
import type { PluginNotificationsController } from "../../src/features/messages/island/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import { HIDE_TOOLTIP_EVENT } from "../../src/components/IconButtonTooltip";
import { useFixtureLines } from "./islandLines";
import { animationsDone, until } from "./pollUntil";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = { expanded: boolean; glass: boolean; taskbarClear: boolean };
const GLASS_SETTINGS: IslandSettings = { ...DEFAULT_SETTINGS, appearanceMode: "liquidGlass", glassRim: true, glassSheen: true, glassBackdrop: "none" };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ expanded: false, glass: false, taskbarClear: false });
  change = (next) => setState((current) => ({ ...current, ...next }));
  const mode = state.expanded ? "expanded" : "collapsed";
  const { glass, glassStyle } = useIslandGlass({ settings: GLASS_SETTINGS, background: "#101418", accent: "#ffb020", cover: null, mode, isTucked: false, quiet: false, reducedMotion: false });
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: NO_PLUGIN_NOTIFICATIONS, preview: null }, agents: 0, status: { state: "idle", label: "AI Agent 空闲或已完成" }, todoTitle: "写周报和整理会议记录" });
  const glassVariables = state.glass ? { "--island-background-color": "#101418", "--glass-tint-color": "#101418", "--glass-collapsed-tint-color": "#101418", "--glass-shadow-alpha": 0.2, ...glassStyle } : {};
  return <div className={`stage${state.taskbarClear ? " stage--taskbar-clear" : ""}`} style={{ "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-top-fillet-size": 8, ...glassVariables } as CSSProperties}>
    <IslandShell
      mode={mode} page="todo" isTucked={false} isDetached showTitle={false}
      showCollapsedText appearanceMode={state.glass ? "liquidGlass" : "classic"} nativeGlassState={state.glass ? "css-fallback" : "disabled"} glass={state.glass ? glass : undefined}
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      onOpenPage={() => {}}
      onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <span>待办清单</span>
    </IslandShell>
  </div>;
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const island = () => document.querySelector<HTMLElement>(".island")!;
const stage = () => document.querySelector<HTMLElement>(".stage")!;
const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
const near = (a: number, b: number) => Math.abs(a - b) < 1;
const dockTo = (edge: "top" | "bottom") => {
  document.documentElement.dataset.islandEdge = edge;
  document.documentElement.dataset.islandTopEdge = edge === "top" ? "attached" : "detached";
};
const set = (next: Partial<State>) => act(async () => { change(next); });
const outerShadows = (value: string) => value === "none" ? [] : value.split(/,(?![^(]*\))/).filter((shadow) => !shadow.includes("inset") && !/rgba\(0, 0, 0, 0\)/.test(shadow) && /[1-9][\d.]*px/.test(shadow));
const hoverCard = () => document.querySelector<HTMLElement>(".island-hover-card");
const glassShown = () => getComputedStyle(document.querySelector(".island__glass")!).display !== "none";
const settled = (ready: () => boolean) => until(() => animationsDone(stage()) && ready());
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    dockTo("bottom");
    await settled(() => near(island().getBoundingClientRect().bottom, stage().getBoundingClientRect().bottom));
    const shell = island().getBoundingClientRect();
    check(near(shell.bottom, stage().getBoundingClientRect().bottom), "收起的岛贴在舞台底部");
    check(near(shell.height, 38), "收起的岛还是 38 高的横向胶囊");
    const style = getComputedStyle(island());
    check(parseFloat(style.borderBottomLeftRadius) === 0 && parseFloat(style.borderBottomRightRadius) === 0, "贴底一侧是直边");
    check(parseFloat(style.borderTopLeftRadius) > 0 && parseFloat(style.borderTopRightRadius) > 0, "上方两角是圆角");
    const fillet = getComputedStyle(island(), "::before");
    check(fillet.opacity === "1" && near(parseFloat(fillet.left), -8) && near(parseFloat(fillet.right), -8) && fillet.clipPath.startsWith("shape(") && / cw[,)]/.test(fillet.clipPath) && !fillet.clipPath.includes(" ccw"), "两个下角画向下翻的反向圆弧");
    check(near(box(".island__collapsed").bottom, shell.bottom), "收起层贴着岛的下沿");

    await set({ expanded: true });
    await settled(() => near(island().getBoundingClientRect().height, 306));
    const panel = island().getBoundingClientRect();
    check(near(panel.bottom, stage().getBoundingClientRect().bottom) && near(panel.height, 306), "面板往上展开，下沿不动");
    check(near(box(".island__expanded").bottom, panel.bottom) && near(box(".island__expanded").top, panel.top), "展开层贴着岛的下沿，填满面板");
    check(box(".island__header").top >= panel.top - 0.5, "标签栏在面板顶部，不出岛");

    dockTo("top");
    await settled(() => near(island().getBoundingClientRect().top, stage().getBoundingClientRect().top));
    check(near(island().getBoundingClientRect().top, stage().getBoundingClientRect().top), "换回顶边时面板从顶部往下展开");
    await set({ expanded: false });
    await settled(() => near(island().getBoundingClientRect().height, 38));
    check(parseFloat(getComputedStyle(island()).borderTopLeftRadius) === 0 && parseFloat(getComputedStyle(island()).borderBottomLeftRadius) > 0, "顶边的造型不变：上直下圆");

    dockTo("bottom");
    await set({ glass: true });
    await settled(() => island().classList.contains("island--glass-rim"));
    check(outerShadows(getComputedStyle(island()).boxShadow).length > 0 && glassShown(), "不在任务栏上时，收起的玻璃岛照旧有外阴影和玻璃层");

    const pulse = document.querySelector<HTMLElement>(".island__pulse")!;
    pulse.setAttribute("title", "CPU 12% · 内存 50%");
    pulse.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: pulse.getBoundingClientRect().left + 4 }));
    await until(() => hoverCard() !== null);
    check(outerShadows(getComputedStyle(hoverCard()!).boxShadow).length > 0, "不在任务栏上时，悬浮提示照旧有外阴影");

    document.documentElement.dataset.islandTaskbar = "placed";
    await set({ taskbarClear: true });
    await settled(() => stage().classList.contains("stage--taskbar-clear"));
    const clear = getComputedStyle(island());
    check(clear.boxShadow === "none", "任务栏上透明的岛没有阴影");
    check(clear.backgroundImage === "none" && clear.backgroundColor === "rgba(0, 0, 0, 0)", "任务栏上透明的岛没有底色和玻璃渐变");
    check(!glassShown(), "任务栏上透明的岛不画液态玻璃层");
    check(getComputedStyle(island(), "::after").display === "none" && getComputedStyle(island(), "::before").display === "none", "任务栏上透明的岛不画流光边和描边");
    check(getComputedStyle(hoverCard()!).boxShadow === "none", "任务栏上透明的岛，悬浮提示没有阴影");

    await set({ taskbarClear: false });
    await settled(() => !stage().classList.contains("stage--taskbar-clear"));
    const restingLift = island().style.getPropertyValue("--island-hover-lift");
    island().style.setProperty("--island-hover-lift", "1");
    check(outerShadows(getComputedStyle(island()).boxShadow).length === 0, "任务栏上跟随主题的岛没有外阴影，悬停抬起也没有");
    check(glassShown(), "任务栏上跟随主题的岛保留玻璃层");
    check(getComputedStyle(hoverCard()!).boxShadow === "none", "任务栏上跟随主题的岛，悬浮提示也没有阴影");
    island().style.setProperty("--island-hover-lift", restingLift || "0");

    window.dispatchEvent(new Event(HIDE_TOOLTIP_EVENT));
    delete pulse.dataset.tooltip;
    await until(() => hoverCard() === null);

    await set({ expanded: true });
    await settled(() => near(island().getBoundingClientRect().height, 306));
    check(outerShadows(getComputedStyle(island()).boxShadow).length > 0, "任务栏上点开的面板照旧有外阴影");

    delete document.documentElement.dataset.islandTaskbar;
    await set({ expanded: false, glass: false });
    dockTo("top");
    await settled(() => near(island().getBoundingClientRect().height, 38) && island().classList.contains("island--appearance-classic"));

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

dockTo("bottom");
await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：贴在屏幕底边的岛。加 ?test=1 运行检查。";
}
