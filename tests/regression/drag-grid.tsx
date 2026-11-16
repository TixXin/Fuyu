import { act } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/base.css";
import { DragGrid } from "../../src/windows/drag-grid/DragGrid";
import { DragGridWindow } from "../../src/windows/drag-grid/DragGridWindow";
import type { DragGridState } from "../../src/windows/drag-grid/api";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
const calls: string[] = [];
mockIPC((command) => {
  calls.push(command);
  if (command === "get_drag_grid_state") return { visible: true, lines: true, snap: null } satisfies DragGridState;
  return null;
}, { shouldMockEvents: true });

const frames: [string, DragGridState][] = [
  ["lines", { visible: true, lines: true, snap: null }],
  ["top", { visible: true, lines: true, snap: "top" }],
  ["left", { visible: true, lines: true, snap: "left" }],
  ["snap-only", { visible: true, lines: false, snap: "bottom" }],
];

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const settle = () => act(async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await new Promise((resolve) => setTimeout(resolve, 20));
});

async function renderFrames() {
  for (const [id, state] of frames) {
    const root = createRoot(document.getElementById(id)!);
    await act(async () => root.render(<DragGrid state={state} />));
  }
}

function checkFrames() {
  const lines = document.querySelectorAll("#lines .drag-grid__line");
  check(lines.length === 4, "九宫格是横竖各两条线");
  const box = $("#lines")!.getBoundingClientRect();
  const v1 = $("#lines .drag-grid__line--v1")!.getBoundingClientRect();
  const h2 = $("#lines .drag-grid__line--h2")!.getBoundingClientRect();
  check(Math.abs(v1.left - box.left - box.width / 3) < 1.5 && Math.abs(h2.top - box.top - (box.height * 2) / 3) < 1.5, "线在三分之一和三分之二处");
  const style = getComputedStyle($("#lines .drag-grid__line--v1")!);
  check(style.borderLeftStyle === "dashed" && style.borderLeftWidth === "1px", "线是 1px 虚线");
  const probe = document.createElement("span");
  probe.style.color = "var(--color-accent)";
  document.body.append(probe);
  const accent = getComputedStyle(probe).color;
  probe.remove();
  check(style.borderLeftColor === accent, "线用主题色");
  check(Number(style.opacity) < 1, "线是淡的");
  check(getComputedStyle($("#lines .drag-grid")!).pointerEvents === "none", "网格不接鼠标");
  const snap = $("#top .drag-grid__snap--top")!.getBoundingClientRect();
  const topBox = $("#top")!.getBoundingClientRect();
  check(Math.abs(snap.left + snap.width / 2 - (topBox.left + topBox.width / 2)) < 1.5 && Math.abs(snap.top - topBox.top) < 1, "吸到顶边正中时，顶边中线亮起一段");
  check($("#left .drag-grid__snap--left") && Math.abs($("#left .drag-grid__snap--left")!.getBoundingClientRect().left - $("#left")!.getBoundingClientRect().left) < 1, "吸到左边正中时，左边中线亮起一段");
  check(document.querySelectorAll("#snap-only .drag-grid__line").length === 0 && $("#snap-only .drag-grid__snap--bottom"), "关掉网格线时只剩吸附提示");
}

async function checkWindow() {
  const root = createRoot(document.getElementById("window-frame")!);
  await act(async () => root.render(<DragGridWindow />));
  await settle();
  check(calls.includes("get_drag_grid_state") && $("#window-frame .drag-grid--visible"), "窗口打开时向 Rust 要当前状态");
  await act(async () => { await emit("drag-grid-state", { visible: true, lines: true, snap: "right" } satisfies DragGridState); });
  check($("#window-frame .drag-grid__snap--right"), "收到吸附事件后显示右边的提示");
  await act(async () => { await emit("drag-grid-state", { visible: false, lines: true, snap: "right" } satisfies DragGridState); });
  const grid = $("#window-frame .drag-grid")!;
  check(!grid.classList.contains("drag-grid--visible") && getComputedStyle(grid).transitionDuration.includes("0.12s"), "松手时淡出");
  await act(async () => root.unmount());
  document.documentElement.classList.remove("island-light");
}

async function runChecks() {
  const results = document.getElementById("results")!;
  try {
    await renderFrames();
    await settle();
    checkFrames();
    await checkWindow();
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

if (automated) await runChecks();
else {
  await renderFrames();
  document.getElementById("results")!.textContent = "演示：拖动时的九宫格辅助线。加 ?test=1 运行检查。";
}
