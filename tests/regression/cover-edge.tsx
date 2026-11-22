import { act, StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/IslandTopEdge.css";
import { I18nProvider } from "../../src/i18n";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { MusicPlayerPanel } from "../../src/features/media/MusicPlayerPanel";
import { DEFAULT_MEDIA_STATE } from "../../src/features/media/mediaState";
import { coverAccentVariables } from "../../src/features/media/useCoverColor";
import { hexToRgba } from "../../src/lib/settings/settings";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_lyrics") return null;
}, { shouldMockEvents: true });

const query = new URLSearchParams(location.search);
const automated = query.has("test");
type Look = { cover: boolean; light: boolean; glass: boolean; opacity: number; pill?: boolean };
const look: Look = { cover: query.get("cover") !== "off", light: query.has("light"), glass: query.has("glass"), opacity: Number(query.get("opacity") ?? 100), pill: query.has("pill") };
if (look.pill) document.documentElement.dataset.islandForm = "pill";
const MEDIA = { ...DEFAULT_MEDIA_STATE, available: true, title: "晴天", artist: "周杰伦", album: "叶惠美", durationMs: 269_000, positionMs: 60_000, updatedAt: Date.now(), playbackStatus: "paused" as const };

function Fixture({ cover, light, glass, opacity, pill }: Look) {
  const background = light ? "#f2f2f5" : "#2f2f37";
  const style = {
    "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1,
    "--expanded-island-width": "560px", "--expanded-island-height": "306px",
    "--island-background-color": background, "--island-fill": hexToRgba(background, opacity / 100),
    ...(light ? { "--island-ink-rgb": "24, 24, 30", "--task-text-color": "#1c1c1f" } : {}),
    ...(cover ? coverAccentVariables("#e0402a", background, null) : {}),
  } as CSSProperties;
  return <main className={`stage${light ? " island-light" : ""}${cover ? " cover-color" : ""}`} style={style}>
    <IslandShell
      mode="expanded" page="music" isTucked={false} isDetached={Boolean(pill)} showTitle={false}
      showCollapsedText appearanceMode={glass ? "liquidGlass" : "classic"} nativeGlassState={glass ? "css-fallback" : "disabled"}
      features={{ todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as never}
      onOpenPage={() => {}} onPageChange={() => {}} onWindowDragStart={() => {}} onCollapse={() => {}}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}} pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <MusicPlayerPanel mediaState={MEDIA} isTrackChanging={false} commandError={null} onOpenSettings={() => {}} onPlayPause={() => {}} onNext={() => {}} onPrevious={() => {}} />
    </IslandShell>
  </main>;
}

const fixture = document.getElementById("fixture")!;
const results = document.getElementById("results")!;
const root = createRoot(fixture);
const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const render = (next: Look) => act(async () => {
  root.render(<StrictMode><I18nProvider><Fixture {...next} /></I18nProvider></StrictMode>);
  await new Promise((resolve) => setTimeout(resolve, 50));
});

function glowInside() {
  const player = document.querySelector<HTMLElement>(".music-player")!;
  const glow = getComputedStyle(player, "::before");
  return glow.content !== "none" && ["top", "left", "right"].every((side) => parseFloat(glow.getPropertyValue(side)) >= 0);
}

async function runChecks() {
  try {
    for (const [label, next] of [
      ["深色", { cover: true, light: false, glass: false, opacity: 100 }],
      ["浅色", { cover: true, light: true, glass: false, opacity: 100 }],
      ["半透明", { cover: true, light: false, glass: false, opacity: 60 }],
      ["液态玻璃", { cover: true, light: false, glass: true, opacity: 100 }],
    ] as const) {
      await render(next);
      check(glowInside(), `${label}：封面颜色的光晕从音乐页里面画起，不越过页头和面板外框`);
    }
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

if (automated) await runChecks();
else {
  await render(look);
  results.textContent = "演示：展开的音乐页。参数 cover=off、light、glass、opacity=60；加 ?test=1 运行检查。";
}
