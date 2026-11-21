import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ENTRANCE_PLATE_RADIUS, planEntrance, tracePerimeter, type EntranceBox, type EntrancePart } from "../../../../lib/theme/widgetEntrancePlan";
import { ENTRANCE_DATA_MS, ENTRANCE_MASCOT_SELECTOR, playEntranceData } from "./entranceData";
import type { EntranceRun } from "./useEntranceRun";
import "./EntranceGhosts.css";

export type EntranceCard = EntranceBox & { id: string };

const ACCENTS = ["#f0a04b", "#5eead4", "#ff5f9e", "#e08a3c", "#f5c84b", "#34c759", "#b78cf5", "#4aa8d8"];
const ORIGIN_Y = -44;
const PLAIN_READY_MS = 90;
const SETTLE_MS = 40;
const GHOST_PARTS: Partial<Record<EntrancePart, string>> = {
  plate: ".custom-panel__ghost-plate",
  band: ".custom-panel__ghost-band",
  skeleton: ".custom-panel__ghost-skeleton",
  sweep: ".custom-panel__ghost-sweep",
  trace: ".custom-panel__ghost-trace",
  stroke: ".custom-panel__ghost-trace rect",
};

type EntranceGhostsProps = { run: EntranceRun; cards: readonly EntranceCard[]; viewWidth: number; height: number; step: number; scale: number };

export function EntranceGhosts({ run, cards, viewWidth, height, step, scale }: EntranceGhostsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scene] = useState(() => ({ cards, viewWidth, height, step, scale }));
  const ghosts = run.effect !== null && run.effect !== "curtain";

  useLayoutEffect(() => {
    const root = rootRef.current;
    const grid = root?.parentElement;
    if (!root || !grid) return;
    const cells = scene.cards.map((card) => grid.querySelector<HTMLElement>(`.custom-panel__cell[data-widget="${CSS.escape(card.id)}"]`));
    const scrolled = (grid.closest<HTMLElement>(".custom-panel__scroll")?.scrollLeft ?? 0) / scene.scale;
    const seen = scene.cards.flatMap((card, at) => (card.left + card.width > scrolled && card.left < scrolled + scene.viewWidth ? [at] : []));
    const animations: Animation[] = [];
    const ready = scene.cards.map(() => PLAIN_READY_MS);
    let total = 0;
    scene.cards.forEach((_, at) => root.children[at]?.toggleAttribute("data-idle", !seen.includes(at)));
    if (run.effect) {
      const origin = { x: scrolled + scene.viewWidth / 2, y: ORIGIN_Y };
      const mascot = grid.querySelector<HTMLElement>(ENTRANCE_MASCOT_SELECTOR);
      const mascotCard = mascot ? seen.findIndex((at) => cells[at]?.contains(mascot)) : -1;
      const home = scene.cards[seen[mascotCard] ?? -1];
      const plan = planEntrance(run.effect, {
        cards: seen.map((at) => ({ ...scene.cards[at], left: scene.cards[at].left - scrolled })),
        origin: { x: scene.viewWidth / 2, y: ORIGIN_Y },
        mascot: home ? { card: mascotCard, x: home.left - scrolled + 38, y: home.top + home.height - 31 } : null,
        width: scene.viewWidth,
        height: scene.height,
        step: scene.step,
        accents: seen.map((at) => ACCENTS[at % ACCENTS.length]),
      });
      for (const at of seen) {
        const card = scene.cards[at];
        const turn = root.children[at]?.querySelector<HTMLElement>(".custom-panel__ghost-turn");
        if (turn) turn.style.transform = `rotate(${Math.atan2(card.top + card.height / 2 - origin.y, card.left + card.width / 2 - origin.x)}rad)`;
      }
      for (const { card, part, frames, ...timing } of plan.steps) {
        const at = seen[card];
        const selector = GHOST_PARTS[part];
        const target = part === "cell" ? cells[at] : part === "board" ? grid : part === "mascot" ? mascot : selector ? root.children[at]?.querySelector(selector) : null;
        if (target) animations.push(target.animate(frames, { ...timing, fill: "both" }));
      }
      plan.ready.forEach((time, card) => {
        ready[seen[card]] = time;
      });
      total = plan.total;
    }
    const stopData = run.data ? playEntranceData(cells.map((cell, at) => (seen.includes(at) ? cell : null)), ready, run.effect === "bubble") : null;
    const timer = window.setTimeout(run.done, total + (run.data ? Math.max(...ready, 0) + ENTRANCE_DATA_MS : 0) + SETTLE_MS);
    return () => {
      window.clearTimeout(timer);
      for (const animation of animations) animation.cancel();
      stopData?.();
    };
  }, [run, scene]);

  return (
    <div className="custom-panel__entrance" ref={rootRef} aria-hidden="true">
      {ghosts
        ? scene.cards.map((card, at) => (
            <div key={card.id} className="custom-panel__ghost" style={{ left: card.left, top: card.top, width: card.width, height: card.height, "--entrance-accent": ACCENTS[at % ACCENTS.length] } as CSSProperties}>
              <span className="custom-panel__ghost-plate" />
              {run.effect === "wave" ? (
                <span className="custom-panel__ghost-rim">
                  <span className="custom-panel__ghost-turn">
                    <span className="custom-panel__ghost-band" />
                  </span>
                </span>
              ) : null}
              {run.effect === "skeleton" ? (
                <span className="custom-panel__ghost-skeleton">
                  <i />
                  <i />
                  <i />
                  <span className="custom-panel__ghost-sweep" />
                </span>
              ) : null}
              {run.effect === "trace" ? (
                <svg className="custom-panel__ghost-trace" width={card.width} height={card.height}>
                  <rect x={0.75} y={0.75} width={card.width - 1.5} height={card.height - 1.5} rx={ENTRANCE_PLATE_RADIUS - 0.75} strokeDasharray={tracePerimeter(card)} />
                </svg>
              ) : null}
            </div>
          ))
        : null}
    </div>
  );
}
