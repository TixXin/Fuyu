import { act, StrictMode, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { I18nProvider } from "../../src/i18n";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandPageArrows } from "../../src/windows/island/IslandPageArrows";
import { usePageArrowKeys } from "../../src/windows/island/usePageArrowKeys";
import { usePageSwipe } from "../../src/windows/island/usePageSwipe";
import { useIslandKeyboard } from "../../src/windows/island/useIslandKeyboard";
import type { IslandFeatures } from "../../src/windows/island/features";
import type { IslandMode, IslandPage } from "../../src/windows/island/types";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC((command) => {
  if (command === "list_plugin_views") return { views: [], status: [] };
}, { shouldMockEvents: true });

const automated = new URLSearchParams(location.search).has("test");
const ALL = { todo: true, music: true, clipboard: true, shelf: true, qq: true, wechat: true, qqMail: true, agents: true, translation: true, calendar: true, screenshots: true } as unknown as IslandFeatures;
const ONLY_TODO = { todo: true } as unknown as IslandFeatures;
const counts = { collapse: 0 };

function Fixture({ features, side }: { features: IslandFeatures; side: boolean }) {
  const [page, setPage] = useState<IslandPage>("todo");
  const [mode, setMode] = useState<IslandMode>("expanded");
  const collapse = () => {
    counts.collapse += 1;
    setMode("collapsed");
  };
  useIslandKeyboard(collapse, () => {}, mode, features, page, setPage, "Alt", "Ctrl+Tab", "Ctrl+Shift+Tab");
  usePageArrowKeys({ enabled: true, mode, blocked: false, features, page, homePage: "todo", onPageChange: setPage, onOpenPage: (next) => { setPage(next); setMode("expanded"); }, onCollapse: collapse });
  usePageSwipe({ enabled: mode === "expanded", features, page, onPageChange: setPage });
  const style = {
    "--collapsed-island-width": "340px", "--island-scale": 1, "--island-collapsed-scale": 1, "--island-expanded-scale": 1,
    "--expanded-island-width": "560px", "--expanded-island-height": "306px", "--island-background-color": "#2f2f37", "--island-fill": "#2f2f37",
  } as CSSProperties;
  return <main className="stage" style={style}>
    <IslandShell
      mode={mode} page={page} isTucked={false} isDetached={false} showTitle={false} side={side ? "left" : null}
      showCollapsedText appearanceMode="classic" nativeGlassState="disabled" features={features}
      onOpenPage={setPage} onPageChange={setPage} onWindowDragStart={() => {}} onCollapse={collapse}
      onResetPosition={() => {}} minimizesToTray onMinimize={() => {}} onOpenSettings={() => {}} onOpenTranslator={() => {}} onTuck={() => {}} onReveal={() => {}}
      pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}
      pageArrows={side ? null : <IslandPageArrows features={features} page={page} onPageChange={setPage} />}
      pageSwitch={{ effect: "wipe", speed: "normal", directional: true }}
    >
      <div className="page-arrows-fixture">
        <input id="fixture-input" aria-label="input" />
        <p id="fixture-page">{page}</p>
        <div id="fixture-strip" style={{ overflowX: "auto", width: 200 }}><div style={{ width: 600, height: 20 }} /></div>
      </div>
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 60));
const render = (features: IslandFeatures, side = false) => act(async () => {
  root.render(<StrictMode><I18nProvider><Fixture key={`${side}-${features === ALL}`} features={features} side={side} /></I18nProvider></StrictMode>);
  await settle();
});
const press = (key: string, target: EventTarget = document.body) => act(async () => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await settle();
});
const arrow = (side: "previous" | "next") => document.querySelector<HTMLButtonElement>(`.island-page-arrow--${side}`);
const nameIn = (label: string | null | undefined) => label?.split(/[:：]\s*/).pop() ?? "";
const shownPage = () => document.getElementById("fixture-page")?.textContent ?? "";
const activeDot = () => document.querySelector(".dot-button--active")?.getAttribute("aria-label") ?? "";

async function runChecks() {
  try {
    await render(ALL);
    check(arrow("previous") && arrow("next"), "有好几个页面时左右各一个箭头");
    check(getComputedStyle(arrow("next")!).opacity === "0", "鼠标不在面板上时箭头看不见");
    check(arrow("next")!.tabIndex === -1, "箭头不进 Tab 顺序");
    const startDot = activeDot();
    await act(async () => { arrow("next")!.click(); await settle(); });
    check(shownPage() !== "todo", "点右箭头切到下一页");
    const reveal = (element: Element | null) => (element?.getAnimations() ?? []).flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes())
      .map((frame) => `${String(frame.maskSize ?? frame.webkitMaskSize ?? "")} @ ${String(frame.maskPosition ?? frame.webkitMaskPosition ?? "")}`)
      .filter((frame) => frame !== " @ ");
    check(/^0px \d+px @ [1-9]\d*px 0px$/.test(reveal(document.querySelector(".page-arrows-fixture"))[0] ?? ""), `翻到下一页时新页从右边拉开（${reveal(document.querySelector(".page-arrows-fixture"))[0]}）`);
    check(reveal(arrow("next")).length === 0 && reveal(arrow("previous")).length === 0, "翻页动效不遮两边的箭头");
    check(document.querySelector("[data-page-switch-overlay='edge']"), "幕布边上有一道亮线");
    await act(async () => { for (const animation of document.getAnimations()) animation.finish(); await settle(); });
    check(!document.querySelector("[data-page-switch-overlay]"), "播完亮线删掉");
    check(startDot.includes(nameIn(arrow("previous")!.getAttribute("aria-label"))), "切过去后左箭头的名字是刚才那一页");
    await act(async () => { arrow("previous")!.click(); await settle(); });
    check(shownPage() === "todo", "点左箭头回到原来那页");

    await press("ArrowRight");
    const afterKey = shownPage();
    check(afterKey !== "todo", "按 → 翻到下一页");
    await press("ArrowLeft");
    check(shownPage() === "todo", "按 ← 翻回来");

    const input = document.getElementById("fixture-input") as HTMLInputElement;
    input.focus();
    await press("ArrowRight", input);
    check(shownPage() !== "todo", "光标在空输入框里也能翻页");
    await press("ArrowLeft", input);
    input.value = "hello";
    await press("ArrowRight", input);
    check(shownPage() === "todo", "输入框里有字时方向键留给输入框");
    input.value = "";
    input.blur();

    const swipe = (target: Element, dx: number) => act(async () => {
      for (let step = 0; step < 12; step += 1) target.dispatchEvent(new WheelEvent("wheel", { deltaX: dx, deltaY: 0, bubbles: true }));
      await settle();
    });
    const before = shownPage();
    await swipe(document.getElementById("fixture-page")!, 30);
    const swiped = shownPage();
    check(swiped !== before, "触控板往左滑翻到下一页");
    await press("ArrowLeft");
    check(shownPage() === before, "一次滑动只翻一页");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await swipe(document.getElementById("fixture-strip")!, 30);
    check(shownPage() === before, "在能左右滚动的地方滑动不翻页");

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    await press("Escape");
    check(counts.collapse === 0, "菜单开着时 Esc 不收起面板");
    menu.remove();
    await press("ArrowUp");
    check(counts.collapse === 1, "按 ↑ 收起面板");
    await press("ArrowDown");
    check(document.querySelector(".island--expanded"), "收起的岛按 ↓ 重新展开");
    await press("Escape");
    check(counts.collapse === 2, "没有菜单时 Esc 照常收起");

    await render(ONLY_TODO);
    check(!arrow("previous") && !arrow("next"), "只有一个页面时不显示箭头");
    await render(ALL, true);
    check(!arrow("next"), "侧边岛不显示箭头");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

if (automated) await runChecks();
else {
  await render(ALL);
  results.textContent = "演示：展开的面板两侧的翻页箭头，鼠标移进面板就出现；方向键能翻页、收起。加 ?test=1 运行检查。";
}
