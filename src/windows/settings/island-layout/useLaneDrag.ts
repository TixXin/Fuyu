import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CollapsedPlacement } from "../../../lib/settings/collapsedItems";
import { placeItem, sameLayout, type LaneId } from "./laneMoves";

const DRAG_START_PX = 4;
const RETARGET_MS = 120;

export type DropLane = LaneId | "center";
export type LaneDrag = { id: string; lane: DropLane | null };
type Hit = { lane: DropLane; before: string | null };

function firstAfter(host: Element, id: string, x: number, y: number) {
  for (const element of host.querySelectorAll<HTMLElement>("[data-item]")) {
    if (element.dataset.item === id) continue;
    const box = element.getBoundingClientRect();
    if (y < box.top || (y <= box.bottom && x < box.left + box.width / 2)) return element.dataset.item ?? null;
  }
  return null;
}

function locate(x: number, y: number, id: string): Hit | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return null;
  const bar = element.closest<HTMLElement>("[data-lane-bar]");
  const host = element.closest<HTMLElement>("[data-lane]");
  if (bar && (!host || host.dataset.lane === "center")) {
    const box = bar.getBoundingClientRect();
    const lane = x < box.left + box.width / 2 ? "left" : "right";
    const zone = bar.querySelector(`[data-lane='${lane}']`);
    return { lane, before: lane === "right" && zone ? firstAfter(zone, id, -Infinity, -Infinity) : null };
  }
  if (!host?.dataset.lane) return null;
  return { lane: host.dataset.lane as DropLane, before: firstAfter(host, id, x, y) };
}

function makeGhost(id: string, source: HTMLElement) {
  const chip = document.querySelector<HTMLElement>(`.lane-chip[data-item='${CSS.escape(id)}']`) ?? source;
  const ghost = chip.cloneNode(true) as HTMLElement;
  ghost.querySelectorAll(".layout-chip__action, .lane-chip__tag").forEach((part) => part.remove());
  ghost.removeAttribute("data-item");
  ghost.classList.add("lane-ghost");
  (source.closest(".settings-stage") ?? document.body).append(ghost);
  return { ghost, fromChip: chip === source };
}

function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
}

export function useLaneDrag({ placements, listed, onDraft, onDrop, onCancel }: {
  placements: CollapsedPlacement[];
  listed: ReadonlySet<string>;
  onDraft: (draft: CollapsedPlacement[] | null) => void;
  onDrop: (before: CollapsedPlacement[], next: CollapsedPlacement[], id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [drag, setDrag] = useState<LaneDrag | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  const start = useCallback((event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0 || stop.current) return;
    const control = (event.target as HTMLElement).closest("button, input");
    if (control && control !== event.currentTarget) return;
    const source = event.currentTarget;
    const press = { x: event.clientX, y: event.clientY };
    const snapshot = placements;
    let current = snapshot;
    let ghost: HTMLElement | null = null;
    let offset = { x: 0, y: 0 };
    let shown: LaneDrag | null = null;
    let last = 0;

    const show = (lane: DropLane | null) => {
      if (shown?.lane === lane) return;
      shown = { id, lane };
      setDrag(shown);
    };
    const aim = (x: number, y: number) => {
      const hit = locate(x, y, id);
      show(hit?.lane ?? null);
      if (!hit || hit.lane === "center") return hit;
      const next = placeItem(snapshot, id, hit.lane, hit.before, listed);
      if (!sameLayout(next, current)) {
        current = next;
        onDraft(next);
      }
      return hit;
    };
    const move = (moveEvent: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(moveEvent.clientX - press.x, moveEvent.clientY - press.y) < DRAG_START_PX) return;
        const made = makeGhost(id, source);
        ghost = made.ghost;
        const box = source.getBoundingClientRect();
        offset = made.fromChip ? { x: press.x - box.left, y: press.y - box.top } : { x: ghost.offsetWidth / 2, y: ghost.offsetHeight / 2 };
        show(null);
      }
      ghost.style.translate = `${moveEvent.clientX - offset.x}px ${moveEvent.clientY - offset.y}px`;
      if (performance.now() - last < RETARGET_MS) return;
      last = performance.now();
      aim(moveEvent.clientX, moveEvent.clientY);
    };
    const finish = (commit: boolean, x?: number, y?: number) => {
      cleanup();
      if (!ghost) return;
      ghost.remove();
      swallowNextClick();
      const hit = commit && x !== undefined && y !== undefined ? aim(x, y) : null;
      setDrag(null);
      onDraft(null);
      if (hit && hit.lane !== "center") onDrop(snapshot, current, id);
      else onCancel(id);
    };
    const up = (upEvent: PointerEvent) => finish(true, upEvent.clientX, upEvent.clientY);
    const cancel = () => finish(false);
    const key = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || !ghost) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      finish(false);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      stop.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
    stop.current = () => {
      cleanup();
      ghost?.remove();
    };
  }, [listed, onCancel, onDraft, onDrop, placements]);

  return { drag, start };
}
