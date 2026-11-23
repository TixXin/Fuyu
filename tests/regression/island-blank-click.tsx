import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/windows/island/IslandApp";
import { IslandShell } from "../../src/windows/island/IslandShell";
import { IslandPages } from "../../src/windows/island/IslandPages";
import type { IslandFeatures } from "../../src/windows/island/features";
import { normalizeSettings } from "../../src/lib/settings/settings";
import { requestTranslationHandoffOpen, saveTranslationHandoff } from "../../src/lib/translation-handoff/storage";
import { animationsDone, until } from "./pollUntil";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC((command) => {
  if (command === "has_translation_secret") return true;
  if (command === "read_translation_clipboard") return "";
  if (command === "list_plugin_views") return { views: [], status: [] };
  if (command === "get_qq_mail_state") return [];
  return undefined;
}, { shouldMockEvents: true });

const OUTPUT = "Click blank space to close the island.";
saveTranslationHandoff("", OUTPUT);
requestTranslationHandoffOpen();

const FEATURES: IslandFeatures = { todo: true, music: false, clipboard: false, shelf: false, qq: false, wechat: false, qqMail: false, agents: false, translation: true, calendar: false, screenshots: false, timer: false };
const SETTINGS = normalizeSettings({});
const noop = () => {};
let collapses = 0;

function Island() {
  return <div className="stage stage--expanded">
    <IslandShell
      mode="expanded" page="translation" isTucked={false} isDetached={true} showTitle={false}
      showCollapsedText={true} appearanceMode="classic" nativeGlassState="disabled" features={FEATURES}
      onOpenPage={noop} onPageChange={noop} onWindowDragStart={noop} onCollapse={() => { collapses += 1; }}
      onResetPosition={noop} minimizesToTray onMinimize={noop} onOpenSettings={noop} onOpenTranslator={noop} onTuck={noop} onReveal={noop}
      pageDigitModifiers="Alt" hoverSwitchPage={false} hoverSwitchDelayMs={0}>
      <IslandPages page="translation" mode="expanded" settings={SETTINGS} features={FEATURES} />
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
const find = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
const describe = (element: Element | null) => element ? `${element.localName}.${[...element.classList].join(".")}` : "nothing";

async function pressAt(x: number, y: number) {
  const target = document.elementFromPoint(x, y);
  if (!target) throw new Error(`nothing at ${x},${y}`);
  const down = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: 1 };
  const up = { ...down, buttons: 0 };
  const pointer = { pointerId: 1, pointerType: "mouse", isPrimary: true };
  await act(async () => {
    target.dispatchEvent(new PointerEvent("pointerdown", { ...down, ...pointer }));
    target.dispatchEvent(new MouseEvent("mousedown", down));
    target.dispatchEvent(new PointerEvent("pointerup", { ...up, ...pointer }));
    target.dispatchEvent(new MouseEvent("mouseup", up));
    target.dispatchEvent(new MouseEvent("click", { ...up, detail: 1 }));
  });
  return target;
}

function footSpot(foot: Element) {
  const button = foot.querySelector("button")!.getBoundingClientRect();
  const box = foot.getBoundingClientRect();
  return { x: Math.round(box.left + Math.min(12, (button.left - box.left) / 2)), y: Math.round(box.top + box.height / 2) };
}

async function runChecks() {
  const textarea = () => find<HTMLTextAreaElement>(".translation-panel__pane--source textarea");
  check(await until(() => textarea() && find("#island-panel[aria-hidden='false']") && animationsDone(root), 4000), "展开的岛上是翻译页");
  check(await until(() => document.activeElement === textarea()), "打开翻译页时原文框拿到焦点");
  check(textarea()!.value === "" && find(".translation-panel__output")?.textContent === OUTPUT, "原文框是空的，结果卡片里有一段译文");

  const foot = find(".translation-panel__pane--source .translation-panel__foot")!;
  const footAt = footSpot(foot);
  textarea()!.blur();
  const footTarget = await pressAt(footAt.x, footAt.y);
  check(foot.contains(footTarget) && !footTarget.closest("button"), `原文框左下角点到的是底栏空处（${describe(footTarget)}）`);
  check(collapses === 0, "点原文框左下角的空处不收起岛");
  check(document.activeElement === textarea(), "点原文框左下角的空处把焦点给原文框");

  const result = find(".translation-panel__pane--result")!;
  const resultFoot = result.querySelector(".translation-panel__foot")!;
  const resultAt = footSpot(resultFoot);
  const resultTarget = await pressAt(resultAt.x, resultAt.y);
  check(resultTarget === resultFoot && getComputedStyle(resultTarget).cursor !== "text", `结果卡片左下角点到的是底栏空处，不是文字光标区（${describe(resultTarget)}）`);
  check(collapses === 0, "点结果卡片左下角的空处不收起岛");

  const source = find(".translation-panel__pane--source")!.getBoundingClientRect();
  const resultBox = result.getBoundingClientRect();
  const sideBySide = resultBox.left >= source.right;
  const gapX = Math.round(sideBySide ? (source.right + resultBox.left) / 2 : source.left + source.width / 2);
  const gapY = Math.round(sideBySide ? source.top + source.height / 2 : (source.bottom + resultBox.top) / 2);
  const gapTarget = await pressAt(gapX, gapY);
  check(gapTarget === find(".translation-panel__panes"), `两张卡片之间点到的是空隙（${describe(gapTarget)}）`);
  check(collapses === 1, "点两张卡片之间的空隙收起岛");

  const bar = find(".translation-panel__bar")!.getBoundingClientRect();
  const rowGapY = Math.round((bar.bottom + Math.min(source.top, resultBox.top)) / 2);
  const rowGapTarget = await pressAt(Math.round(source.left + 20), rowGapY);
  check(rowGapTarget === find(".translation-panel"), `工具条和卡片之间点到的是页面本身（${describe(rowGapTarget)}）`);
  check(collapses === 2, "点工具条和卡片之间的空隙收起岛");
}

try {
  await act(async () => {
    createRoot(root).render(<StrictMode><Island /></StrictMode>);
  });
  await runChecks();
  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  results.dataset.result = "failed";
  console.error(error);
}
