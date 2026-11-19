import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import "../../src/windows/island/topEdge";
import { IslandShell } from "../../src/windows/island/IslandShell";
import type { TuckHintSettings } from "../../src/windows/island/IslandTuckHint";
import type { TuckStyle } from "../../src/lib/settings/types";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
}, { shouldMockEvents: true });

type State = {
  side: "left" | "right" | null;
  expanded: boolean;
  tucked: boolean;
  tuckStyle: TuckStyle;
  hint: TuckHintSettings;
};
const DOT: TuckHintSettings = { tuckHintStyle: "dot", tuckHintColor: "contrast", tuckHintCustomColor: "#74d6ff", tuckHintBreathe: false };
let change: (next: Partial<State>) => void;

function Fixture() {
  const [state, setState] = useState<State>({ side: null, expanded: false, tucked: true, tuckStyle: "hidden", hint: DOT });
  change = (next) => setState((current) => ({ ...current, ...next }));
  return <div className="stage" style={{ "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1, "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-top-fillet-size": 8 } as CSSProperties}>
    <IslandShell
      mode={state.expanded ? "expanded" : "collapsed"} page="todo" isTucked={state.tucked} tuckStyle={state.tuckStyle} tuckHint={state.hint}
      isDetached={false} side={state.side} showTitle={false}
      showCollapsedText appearanceMode="classic" nativeGlassState="disabled"
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
const hint = () => document.querySelector<HTMLElement>(".island-tuck-hint");
const stage = () => document.querySelector<HTMLElement>(".stage")!.getBoundingClientRect();
const near = (a: number, b: number) => Math.abs(a - b) < 1;
const set = (next: Partial<State>) => act(async () => { change(next); });
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    let box = hint()!.getBoundingClientRect();
    const frame = stage();
    check(hint()?.classList.contains("island-tuck-hint--dot"), "贴边隐身收起时画出小圆点");
    check(near(box.width, 7) && near(box.height, 7), "小圆点直径 7px");
    check(near(box.left + box.width / 2, frame.left + frame.width / 2) && near(box.top, frame.top + 41), "小圆点在岛下沿（屏幕边）往里 3px、水平居中");
    check(getComputedStyle(hint()!).pointerEvents === "none", "提示不接鼠标");
    check(getComputedStyle(document.querySelector(".island")!).opacity === "0", "岛本身仍然看不见");

    await set({ hint: { ...DOT, tuckHintStyle: "glow" } });
    box = hint()!.getBoundingClientRect();
    check(hint()?.classList.contains("island-tuck-hint--glow") && near(box.width, 38) && near(box.height, 3), "光晕是 38×3 的短条");
    check(near(box.top, frame.top + 38) && getComputedStyle(hint()!).boxShadow.includes("8px"), "光晕紧贴屏幕边，带一圈柔光");

    await set({ hint: { ...DOT, tuckHintStyle: "none" } });
    check(!hint(), "选「无」时什么都不画");

    await set({ hint: { ...DOT, tuckHintColor: "custom", tuckHintCustomColor: "#ff3366" } });
    check(getComputedStyle(hint()!).backgroundColor === "rgb(255, 51, 102)", "自选颜色用在提示上");
    await set({ hint: { ...DOT, tuckHintBreathe: true } });
    check(getComputedStyle(hint()!).animationName.includes("island-tuck-hint-breathe"), "开了呼吸时有呼吸动画");
    await set({ hint: DOT });
    check(!getComputedStyle(hint()!).animationName.includes("island-tuck-hint-breathe"), "默认常亮，不呼吸");

    await set({ tuckStyle: "edge" });
    check(!hint(), "标准露边时不画提示");
    await set({ tuckStyle: "hidden", tucked: false });
    check(!hint(), "没收起时不画提示");
    await set({ tucked: true, expanded: true });
    check(!hint(), "展开时不画提示");
    await set({ expanded: false });

    document.documentElement.dataset.islandEdge = "bottom";
    await set({ hint: { ...DOT } });
    box = hint()!.getBoundingClientRect();
    check(near(box.bottom, frame.bottom - 41), "贴底边时小圆点在岛上沿往里 3px");
    document.documentElement.dataset.islandEdge = "left";
    await set({ side: "left" });
    box = hint()!.getBoundingClientRect();
    check(near(box.left, frame.left + 3) && near(box.top + box.height / 2, frame.top + 36), "贴左侧时小圆点在把手中间、离屏幕边 3px");
    await set({ hint: { ...DOT, tuckHintStyle: "glow" } });
    box = hint()!.getBoundingClientRect();
    check(near(box.left, frame.left) && near(box.width, 3) && near(box.height, 38), "贴左侧时光晕是竖条，紧贴屏幕边");
    document.documentElement.dataset.islandEdge = "right";
    await set({ side: "right" });
    box = hint()!.getBoundingClientRect();
    check(near(box.right, frame.right), "贴右侧时光晕紧贴右边");

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
  results.textContent = "演示：贴边隐身时的小圆点。加 ?test=1 运行检查。";
}
