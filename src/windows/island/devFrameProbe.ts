import { reportFrontendError } from "../../lib/crash-report/api";
import { summarizeFrames } from "./frameStats.ts";

const WATCH_MS = 700;

type Run = {
  direction: "open" | "close";
  cold: boolean;
  startedAt: number;
  frames: number[];
  mountedAt: number | null;
};

function report(run: Run) {
  const stats = summarizeFrames(run.startedAt, run.frames);
  const round = (value: number) => Math.round(value * 10) / 10;
  const mount = run.mountedAt === null ? "-" : round(run.mountedAt - run.startedAt);
  const message =
    `${run.direction} cold=${run.cold ? 1 : 0} frames=${stats.frames} first=${round(stats.first)} max=${round(stats.max)} ` +
    `p50=${round(stats.p50)} p90=${round(stats.p90)} drops=${stats.drops} late=${stats.late} mount=${mount}`;
  console.info(`[island-frames] ${message}`);
  void reportFrontendError("island-frames", message, null).catch(() => {});
}

function watch(island: HTMLElement) {
  let wasExpanded = island.classList.contains("island--expanded");
  let run: Run | null = null;
  let frame = 0;

  const tick = (now: number) => {
    if (!run) return;
    run.frames.push(now);
    if (run.mountedAt === null && island.querySelector(".island__content")?.childElementCount) {
      run.mountedAt = now;
    }
    if (now - run.startedAt < WATCH_MS) {
      frame = requestAnimationFrame(tick);
      return;
    }
    report(run);
    run = null;
  };

  const observer = new MutationObserver(() => {
    const expanded = island.classList.contains("island--expanded");
    if (expanded === wasExpanded) return;
    wasExpanded = expanded;
    if (run) report(run);
    cancelAnimationFrame(frame);
    const content = island.querySelector(".island__content");
    run = {
      direction: expanded ? "open" : "close",
      cold: expanded && !content?.childElementCount,
      startedAt: performance.now(),
      frames: [],
      mountedAt: null,
    };
    frame = requestAnimationFrame(tick);
  });
  observer.observe(island, { attributes: true, attributeFilter: ["class"] });
}

function install() {
  const island = document.querySelector<HTMLElement>(".island");
  if (island) {
    watch(island);
    return;
  }
  const waiter = new MutationObserver(() => {
    const found = document.querySelector<HTMLElement>(".island");
    if (!found) return;
    waiter.disconnect();
    watch(found);
  });
  waiter.observe(document.body, { childList: true, subtree: true });
}

install();
