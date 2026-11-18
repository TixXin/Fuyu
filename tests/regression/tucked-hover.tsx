import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { ISLAND_HOLD_CHANGED_EVENT, ISLAND_HOVER_CHANGED_EVENT } from "../../src/windows/island/api";
import { useIslandHoldListener } from "../../src/windows/island/islandHold";
import { useHoverExpand } from "../../src/windows/island/useHoverExpand";
import { useIslandNavigation } from "../../src/windows/island/useIslandNavigation";
import { useTuckPeek } from "../../src/windows/island/useTuckPeek";
import { useTuckedHoverOpen } from "../../src/windows/island/useTuckedHoverOpen";
import { until } from "./pollUntil";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => null, { shouldMockEvents: true });

const RETRACT_MS = 120;
const COLLAPSE_MS = 120;
const HOVER_DELAY_MS = 0;

type Island = ReturnType<typeof useIslandNavigation>;
let island: Island;
let enter: () => void;
let setOpensPanel: (value: boolean) => void;
let setHoverCollapseEnabled: (value: boolean) => void;
let setClickCollapseOnLeave: (value: boolean) => void;

function Harness() {
  const [opensPanel, changeOpensPanel] = useState(false);
  const [hoverCollapseEnabled, changeHoverCollapseEnabled] = useState(false);
  const [clickCollapseOnLeave, changeClickCollapseOnLeave] = useState(false);
  const navigation = useIslandNavigation();
  island = navigation;
  setOpensPanel = changeOpensPanel;
  setHoverCollapseEnabled = changeHoverCollapseEnabled;
  setClickCollapseOnLeave = changeClickCollapseOnLeave;
  useIslandHoldListener();
  useHoverExpand({
    expandOnHover: false,
    collapseOnLeave: hoverCollapseEnabled && (clickCollapseOnLeave || navigation.openedByHover),
    delayMs: HOVER_DELAY_MS,
    paused: false,
    collapseDelayMs: COLLAPSE_MS,
    mode: navigation.mode,
    isTucked: navigation.isTucked || navigation.isPeeking,
    onExpand: () => navigation.openIslandPage("todo"),
    onCollapse: navigation.collapseIsland,
  });
  useTuckPeek(navigation.isPeeking, navigation.endPeek, navigation.peekRetractDelayMs ?? RETRACT_MS);
  enter = useTuckedHoverOpen({
    opensPanel,
    delayMs: HOVER_DELAY_MS,
    isTucked: navigation.isTucked,
    isPeeking: navigation.isPeeking && navigation.mode === "collapsed",
    onPeek: navigation.peekIsland,
    onOpen: () => {
      navigation.openIslandPage("todo");
      navigation.markHoverOpen();
    },
    retractsAfterPeek: navigation.retractsAfterPeek,
    resumePeek: navigation.resumePeek,
  });
  return (
    <p>
      mode {navigation.mode} · tucked {String(navigation.isTucked)} · peeking {String(navigation.isPeeking)}{" "}
      <input id="draft" aria-label="draft" />
    </p>
  );
}

createRoot(document.getElementById("fixture")!).render(<StrictMode><Harness /></StrictMode>);

const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const wait = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const hover = async (inside: boolean) => {
  await act(async () => { await emit(ISLAND_HOVER_CHANGED_EVENT, inside); });
};
const arrive = async () => {
  await act(async () => enter());
  await hover(true);
};
const state = () => `${island.mode}/${island.isTucked ? "tucked" : "out"}`;

async function runChecks() {
  try {
    await until(() => Boolean(island));

    await act(async () => island.minimizeToEdge());
    await arrive();
    await wait(400);
    check(state() === "collapsed/out" && island.isPeeking, "只露出岛屿：鼠标移上去只露出岛屿，不展开面板");
    await hover(false);
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "只露出岛屿：鼠标移开后岛屿收回边缘");

    await act(async () => setOpensPanel(true));
    await arrive();
    check(state() === "collapsed/out", "展开面板：先立即露出岛屿");
    await wait(200);
    check(state() === "collapsed/out", "展开面板：露出的动画结束前不展开面板");
    await until(() => state() === "expanded/out" && island.isPeeking);
    check(state() === "expanded/out" && island.isPeeking, "展开面板：停留后展开面板，仍记得要收回");
    await hover(false);
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "展开面板：鼠标移开后面板关闭，岛屿收回边缘");

    await hover(true);
    await until(() => state() === "expanded/out" && island.isPeeking);
    check(state() === "expanded/out" && island.isPeeking, "贴边隐身：仅靠原生边缘热区悬停事件即可唤醒并展开面板");
    await hover(false);
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "贴边隐身：移出边缘热区并离开面板后收回边缘");

    await arrive();
    await wait(40);
    await hover(false);
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "鼠标只是划过边缘时不展开面板，岛屿收回");

    await arrive();
    await wait(40);
    await hover(false);
    await wait(50);
    check(state() === "collapsed/out", "快速移出时岛屿还没收回");
    await hover(true);
    await until(() => state() === "expanded/out");
    check(state() === "expanded/out", "快速移出再移入，鼠标停在岛屿上时面板照样展开");
    await hover(false);
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "之后移开，面板关闭、岛屿收回");

    await arrive();
    await until(() => state() === "expanded/out");
    await act(async () => document.querySelector<HTMLInputElement>("#draft")!.focus());
    await hover(false);
    await wait(500);
    check(state() === "expanded/out", "面板里正在输入时，鼠标移开也不收回");
    await act(async () => document.querySelector<HTMLInputElement>("#draft")!.blur());
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "输入框失去焦点后再收回");

    await arrive();
    await until(() => state() === "expanded/out");
    await act(async () => { await emit(ISLAND_HOLD_CHANGED_EVENT, true); });
    await hover(false);
    await wait(450);
    check(state() === "expanded/out", "外部对话框持有锁时，鼠标移开也不收回");
    await act(async () => { await emit(ISLAND_HOLD_CHANGED_EVENT, false); });
    await until(() => state() === "collapsed/tucked");
    check(state() === "collapsed/tucked", "释放持有锁后再收回");

    await act(async () => island.idleTuck(null));
    await arrive();
    await until(() => state() === "expanded/out");
    await hover(false);
    await wait(450);
    check(state() === "expanded/out", "没开「鼠标移开后重新收起」时，展开后不自动收回");

    await act(async () => {
      island.collapseIsland();
      setHoverCollapseEnabled(true);
      setClickCollapseOnLeave(true);
    });
    await act(async () => island.openIslandPage("todo"));
    await wait(300);
    check(state() === "expanded/out", "点击展开 + 移开自动收起：快捷键在岛外打开面板时不误收起");
    await hover(true);
    await hover(false);
    await until(() => state() === "collapsed/out");
    check(state() === "collapsed/out", "点击展开 + 移开自动收起：鼠标进过面板再移出后自动收起");

    await hover(true);
    await act(async () => island.openIslandPage("todo"));
    check(state() === "expanded/out", "点击展开 + 移开自动收起：在岛上点击展开面板");
    await hover(false);
    await until(() => state() === "collapsed/out");
    check(state() === "collapsed/out", "点击展开 + 移开自动收起：看完移出面板后自动收起");

    await act(async () => {
      setClickCollapseOnLeave(false);
      island.idleTuck(null);
    });
    await arrive();
    await until(() => state() === "expanded/out");
    await hover(false);
    await until(() => state() === "collapsed/out");
    check(state() === "collapsed/out", "点击模式下从贴边悬停展开面板，移开后折叠回小岛留在屏幕上");

    await hover(true);
    await act(async () => island.openIslandPage("todo"));
    await hover(false);
    await wait(300);
    check(state() === "expanded/out", "随后手动点击展开时，不再受上一次贴边悬停影响而自动收起");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

void runChecks();
