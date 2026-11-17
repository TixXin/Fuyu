import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/IslandTopEdge.css";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { useIslandGlass } from "../../src/windows/island/useIslandGlass";
import { maxExpandedIslandWidth } from "../../src/windows/island/layout";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settingsDefaults";
import type { IslandSettings } from "../../src/lib/settings/types";
import type { PluginNotificationsController } from "../../src/features/messages/island/usePluginNotifications";
import { useQQNotifications } from "../../src/features/messages/qq-notifications/QQNotifications";
import { useWeChatReminders } from "../../src/features/messages/wechat/WeChatReminders";
import { useMail } from "../../src/features/messages/mail/MailPanel";
import { useFixtureLines } from "./islandLines";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const NO_PLUGIN_NOTIFICATIONS: PluginNotificationsController = { notification: null, dismiss: () => {}, runAction: () => {}, post: () => {} };
const whiteWallpaper = (() => {
  const canvas = Object.assign(document.createElement("canvas"), { width: 32, height: 18 });
  const context = canvas.getContext("2d")!;
  context.fillStyle = "white";
  context.fillRect(0, 0, 32, 18);
  return canvas.toDataURL("image/png");
})();
let demoWallpaper: string | null = null;
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_wallpapers") return { fit: "fill", color: "#000000", monitors: [{ x: 0, y: 0, width: demoWallpaper ? innerWidth * devicePixelRatio : 3840, height: demoWallpaper ? innerHeight * devicePixelRatio : 2160, image: demoWallpaper ?? whiteWallpaper }] };
  if (command === "plugin:window|inner_position") return { x: 0, y: 0 };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });
mockWindows("main");

type State = { expanded: boolean; tucked: boolean; quiet: boolean; settings: Partial<IslandSettings> };
const changes: ((next: Partial<State>) => void)[] = [];

function GlassIsland({ background, light }: { background: string; light: boolean }) {
  const [state, setState] = useState<State>({ expanded: false, tucked: false, quiet: false, settings: { glassBackdrop: "none" } });
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
    "--glass-intensity": settings.glassIntensity / 100, "--glass-panel-blur": `${10 + (settings.glassIntensity / 100) * 9}px`, "--island-background-color": background, "--glass-tint-color": background, "--glass-collapsed-tint-color": background,
    ...(light ? { "--island-ink-rgb": "24, 24, 30", "--task-text-color": "#1c1c1f" } : {}),
    ...glassStyle,
  } as CSSProperties;
  useFixtureLines({ messages: { qq: qq, wechat: wechat, mail: qqMail, plugin: NO_PLUGIN_NOTIFICATIONS, preview: null }, agents: 0, status: { state: "idle", label: "AI Agent 空闲或已完成" }, todoTitle: "整理周报" });
  return <div className={`stage${light ? " island-light" : ""}`} data-tone={light ? "light" : "dark"} style={stageStyle}>
    <IslandShell
      mode={mode} page="todo" isTucked={false} isDetached={false} showTitle={false}
      showCollapsedText appearanceMode="liquidGlass" nativeGlassState="css-fallback" glass={glass}
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
      check(playState(island) === "paused", `${tone}：折叠时默认停着，只在展开时流动`);
      for (const name of ["--glass-c1", "--glass-c2", "--glass-c3"]) {
        const color = getComputedStyle(island).getPropertyValue(name).trim();
        const value = luminance(color);
        check(tone === "dark" ? value <= 0.1 + 1e-3 : value >= 0.62 - 1e-3, `${tone}：${name} 的相对亮度 ${value.toFixed(3)} 守住文字对比度`);
      }
    }

    await set({ settings: { glassBackdrop: "none", glassFlowWhen: "always" } });
    check(islands().every((island) => playState(island) === "running"), "选「一直」后折叠时也流动");

    for (const notch of ["on", "simulated"]) {
      document.documentElement.dataset.islandNotch = notch;
      check(islands().every((island) => playState(island) === "paused" && getComputedStyle(island).backdropFilter === "none" && getComputedStyle(island.querySelector(".island__glass-highlight")!).display === "none"), `刘海形态（${notch}）下折叠岛的玻璃停下并关闭实时模糊`);
    }
    delete document.documentElement.dataset.islandNotch;
    check(islands().every((island) => playState(island) === "running" && getComputedStyle(island).backdropFilter !== "none" && getComputedStyle(island.querySelector(".island__glass-highlight")!).display === "block" && getComputedStyle(island.querySelector(".island__glass-highlight")!).transitionProperty === "transform"), "离开刘海形态后接着流动并恢复模糊与合成层高光");

    await set({ tucked: true });
    check(islands().every((island) => island.classList.contains("island--glass-paused") && playState(island) === "paused"), "收到边缘时停下");
    await set({ tucked: false, quiet: true });
    check(islands().every((island) => playState(island) === "paused"), "游戏免打扰时停下");
    await set({ quiet: false, settings: { glassFlowWhen: "expanded" } });
    check(islands().every((island) => playState(island) === "paused"), "「只在展开时」下折叠岛不动");
    await set({ expanded: true });
    check(islands().every((island) => playState(island) === "running"), "展开后流动");

    const scale = 1.15;
    for (const island of islands()) {
      const stage = island.closest<HTMLElement>(".stage")!;
      const tone = stage.dataset.tone;
      const saved = stage.getAttribute("style") ?? "";
      Object.assign(stage.style, { width: "820px", margin: "0 auto" });
      for (const [name, value] of [["--island-scale", scale], ["--island-expanded-scale", scale], ["--expanded-island-width", `${maxExpandedIslandWidth(scale)}px`]] as const) stage.style.setProperty(name, String(value));
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 900)); });
      const box = island.getBoundingClientRect();
      const room = stage.getBoundingClientRect();
      const fillet = (parseFloat(getComputedStyle(island, "::before").width) - box.width) / 2;
      check(fillet > 8 && box.left - fillet >= room.left - 0.5 && box.right + fillet <= room.right + 0.5, `${tone}：缩放 ${scale} 下最宽的展开岛两侧倒角（${fillet.toFixed(1)}px）还在 820px 窗口里（左 ${(box.left - room.left).toFixed(1)}px，右 ${(room.right - box.right).toFixed(1)}px）`);
      stage.setAttribute("style", saved);
    }

    await set({ settings: { glassRim: true, glassSheen: true, glassSpecular: false, glassMorph: "liquid" } });
    for (const island of islands()) {
      const rim = getComputedStyle(island, "::after");
      check(rim.backgroundImage.startsWith("conic-gradient(") && rim.clipPath.startsWith("shape(evenodd") && rim.animationName === "glassRimSpin", "打开油膜边后画出边，和反向弧是同一圈");
      check(getComputedStyle(island.querySelector(".island__glass-sheen")!).display === "block", "打开扫光后画出扫光");
      check(getComputedStyle(island.querySelector(".island__glass-highlight")!).display === "none", "关掉镜面高光后不画高光");
      check(island.classList.contains("island--glass-morph-liquid"), "形变设成液体");
    }

    await set({ settings: { glassStyle: "static" } });
    check(islands().every((island) => playState(island) === "paused"), "静态风格不动");

    await set({ settings: { glassBackdrop: "wallpaper", glassBlur: 20, glassSaturation: 150 } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
    for (const island of islands()) {
      const tone = island.closest<HTMLElement>(".stage")!.dataset.tone;
      check(island.style.getPropertyValue("--glass-wallpaper").startsWith('url("data:image/jpeg'), `${tone}：选了壁纸后岛的底子换成磨砂过的壁纸`);
      check(getComputedStyle(island).backdropFilter === "none", `${tone}：选了壁纸后关闭主壳实时 backdrop-filter`);
      check(getComputedStyle(island).backgroundImage.includes("data:image/jpeg"), `${tone}：岛本体（含贴顶圆角继承的背景）画出壁纸`);
      check(island.querySelector(".island__glass-noise"), `${tone}：加了噪点层`);
      check(getComputedStyle(island, "::before").backgroundImage.includes("data:image/jpeg"), `${tone}：贴顶圆角继承同一块磨砂壁纸`);
      const boost = Number(island.style.getPropertyValue("--glass-backdrop-boost"));
      check(tone === "dark" ? boost > 0 : boost === 0, `${tone}：白壁纸上${tone === "dark" ? "加深" : "不加深"}底色（${boost}）`);
    }
    await set({ settings: { glassStyle: "static", glassBackdrop: "none" } });
    check(islands().every((island) => !("glassWallpaper" in island.dataset) && !island.style.getPropertyValue("--glass-wallpaper")), "关掉后退回纯色玻璃");

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
  results.textContent = "演示：深色和浅色的液态玻璃岛，右边选壁纸、调参数。加 ?test=1 运行检查。";
  const { mountPlayground } = await import("./glassPlayground");
  mountPlayground({ apply: (settings) => changes.forEach((change) => change({ settings })), setWallpaper: (url) => { demoWallpaper = url; } });
  if (new URLSearchParams(location.search).has("expanded")) changes.forEach((change) => change({ expanded: true }));
}
