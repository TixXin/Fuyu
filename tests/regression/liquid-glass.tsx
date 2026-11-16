import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { useIslandGlass } from "../../src/windows/island/useIslandGlass";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";
import type { PluginNotificationsController } from "../../src/features/plugins/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import { useFixtureLines } from "./islandLines";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = { expanded: boolean; tucked: boolean; quiet: boolean; settings: Partial<IslandSettings> };
const changes: ((next: Partial<State>) => void)[] = [];

function GlassIsland({ background, light }: { background: string; light: boolean }) {
  const [state, setState] = useState<State>({ expanded: false, tucked: false, quiet: false, settings: {} });
  changes.push((next) => setState((current) => ({ ...current, ...next })));
  const settings: IslandSettings = { ...DEFAULT_SETTINGS, appearanceMode: "liquidGlass", islandBackgroundColor: background, ...state.settings };
  const mode = state.expanded ? "expanded" : "collapsed";
  const { glass, glassStyle } = useIslandGlass({ settings, background, accent: "#ffb020", cover: null, mode, isTucked: state.tucked, quiet: state.quiet, reducedMotion: false });
  const qq = useQQNotifications(true);
  const wechat = useWeChatReminders(true);
  const qqMail = useMail(true);
  const stageStyle = {
    "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1,
    "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-top-fillet-size": 8,
    "--glass-intensity": 0.72, "--glass-tint-color": background, "--glass-collapsed-tint-color": background,
    ...(light ? { "--island-ink-rgb": "24, 24, 30", "--task-text-color": "#1c1c1f" } : {}),
    ...glassStyle,
  } as CSSProperties;
  return <div className={`stage${light ? " island-light" : ""}`} data-tone={light ? "light" : "dark"} style={stageStyle}>
    <IslandShell lineSources={useFixtureLines({ todoTitle: "整理周报" })} qqNotifications={qq} wechatReminders={wechat} qqMail={qqMail} pluginNotifications={NO_PLUGIN_NOTIFICATIONS} preview={null}
      mode={mode} page="todo" isTucked={false} isDetached={false} showTitle={false}
      showCollapsedText activeAgentSessionCount={0}
      appearanceMode="liquidGlass" nativeGlassState="css-fallback" glass={glass} agentVisualState="idle" agentStatusLabel="AI Agent 空闲或已完成"
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      shelfCount={null}
      onOpenPage={() => {}} onOpenMessages={() => {}}
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
const set = (next: Partial<State>) => act(async () => { changes.forEach((change) => change(next)); });
const islands = () => [...document.querySelectorAll<HTMLElement>(".island")];
const playState = (island: HTMLElement) => getComputedStyle(island.querySelector(".island__glass-flow i")!).animationPlayState;
const rgb = (value: string) => {
  const parts = value.match(/[\d.]+/g)!.map(Number);
  return value.startsWith("color(srgb") ? parts.slice(0, 3).map((part) => part * 255) : parts.slice(0, 3);
};
const luminance = (value: string) => {
  const [r, g, b] = rgb(value).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1400)); });
    for (const island of islands()) {
      const tone = island.closest<HTMLElement>(".stage")!.dataset.tone;
      check(island.classList.contains("island--glass-style-flow") && island.classList.contains("island--glass-specular"), `${tone}：默认是慢流动加镜面高光`);
      check(island.querySelectorAll(".island__glass-flow i").length === 4, `${tone}：画了四团色块`);
      check(island.querySelector(".island__glass > .island__glass-backdrop") === island.querySelector(".island__glass")!.firstElementChild, `${tone}：最底下留着背景层的位置`);
      check(getComputedStyle(island.querySelector(".island__glass-flow i")!).animationName === "glassBlob1", `${tone}：色块在动`);
      check(playState(island) === "running", `${tone}：折叠时默认一直流动`);
      for (const name of ["--glass-c1", "--glass-c2", "--glass-c3"]) {
        const color = getComputedStyle(island).getPropertyValue(name).trim();
        const value = luminance(color);
        check(tone === "dark" ? value <= 0.1 + 1e-3 : value >= 0.62 - 1e-3, `${tone}：${name} 的相对亮度 ${value.toFixed(3)} 守住文字对比度`);
      }
    }

    for (const notch of ["on", "simulated"]) {
      document.documentElement.dataset.islandNotch = notch;
      check(islands().every((island) => playState(island) === "paused"), `刘海形态（${notch}）下折叠岛的玻璃停下`);
    }
    delete document.documentElement.dataset.islandNotch;
    check(islands().every((island) => playState(island) === "running"), "离开刘海形态后接着流动");

    await set({ tucked: true });
    check(islands().every((island) => island.classList.contains("island--glass-paused") && playState(island) === "paused"), "收到边缘时停下");
    await set({ tucked: false, quiet: true });
    check(islands().every((island) => playState(island) === "paused"), "游戏免打扰时停下");
    await set({ quiet: false, settings: { glassFlowWhen: "expanded" } });
    check(islands().every((island) => playState(island) === "paused"), "「只在展开时」下折叠岛不动");
    await set({ expanded: true });
    check(islands().every((island) => playState(island) === "running"), "展开后流动");

    await set({ settings: { glassRim: true, glassSheen: true, glassSpecular: false, glassMorph: "liquid" } });
    for (const island of islands()) {
      check(getComputedStyle(island.querySelector(".island__glass-rim")!).display === "block", "打开油膜边后画出边");
      check(getComputedStyle(island.querySelector(".island__glass-sheen")!).display === "block", "打开扫光后画出扫光");
      check(getComputedStyle(island.querySelector(".island__glass-highlight")!).display === "none", "关掉镜面高光后不画高光");
      check(island.classList.contains("island--glass-morph-liquid"), "形变设成液体");
    }

    await set({ settings: { glassStyle: "static" } });
    check(islands().every((island) => playState(island) === "paused"), "静态风格不动");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await act(async () => {
  createRoot(document.getElementById("fixture")!).render(<StrictMode>
    <GlassIsland background="#030303" light={false} />
    <GlassIsland background="#f2f2f5" light />
  </StrictMode>);
});
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：深色和浅色的液态玻璃岛。加 ?test=1 运行检查。";
}
