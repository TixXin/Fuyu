import { useLayoutEffect, useRef } from "react";
import type { SessionLight } from "./sessionLight";
import "./AgentListMotion.css";

const MOVE_MS = 200;
const ENTER_MS = 200;
const LEAVE_MS = 180;
const PULSE_FALLBACK_MS = 1000;
const EASING = "cubic-bezier(0.2, 0.7, 0.3, 1)";
const SHIFT = "translateY(-6px)";
const CALLING: ReadonlySet<string> = new Set<SessionLight>(["needs", "yourTurn"]);

export const MOTION_ARCHIVING = "archiving";
export const MOTION_PULSE = "agent-motion-pulse";
export const MOTION_GHOST = "agent-motion-ghost";

export type MotionEntry = { key: string; light?: SessionLight; open?: number };

type Box = { top: number; left: number; width: number; height: number };
type Snapshot = { order: string; boxes: Map<string, Box>; ghosts: Array<{ node: HTMLElement; box: Box }> };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const moving = new WeakMap<HTMLElement, Animation>();

function rows(list: HTMLElement) {
  return Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-session-key]")).filter(
    (row) => row.dataset.motion !== MOTION_ARCHIVING,
  );
}

function boxOf(row: HTMLElement, list: HTMLElement, frame: DOMRect): Box {
  const rect = row.getBoundingClientRect();
  return {
    top: rect.top - frame.top + list.scrollTop,
    left: rect.left - frame.left + list.scrollLeft,
    width: rect.width,
    height: rect.height,
  };
}

function snapshot(list: HTMLElement, order: string, staying: ReadonlySet<string>): Snapshot {
  const frame = list.getBoundingClientRect();
  const boxes = new Map<string, Box>();
  const ghosts: Snapshot["ghosts"] = [];
  for (const row of rows(list)) {
    const key = row.dataset.sessionKey ?? "";
    const box = boxOf(row, list, frame);
    boxes.set(key, box);
    if (!staying.has(key) && box.height > 0) ghosts.push({ node: row.cloneNode(true) as HTMLElement, box });
  }
  return { order, boxes, ghosts };
}

function track(row: HTMLElement, animation: Animation) {
  moving.set(row, animation);
  void animation.finished
    .catch(() => undefined)
    .finally(() => {
      if (moving.get(row) === animation) moving.delete(row);
    });
}

function enter(row: HTMLElement) {
  track(
    row,
    row.animate(
      [
        { opacity: 0, transform: SHIFT },
        { opacity: 1, transform: "none" },
      ],
      { duration: ENTER_MS, easing: EASING },
    ),
  );
}

function leave(list: HTMLElement, node: HTMLElement, box: Box) {
  node.removeAttribute("data-session-key");
  node.removeAttribute("data-motion");
  node.classList.remove(MOTION_PULSE);
  node.classList.add(MOTION_GHOST);
  node.setAttribute("aria-hidden", "true");
  node.inert = true;
  Object.assign(node.style, {
    position: "absolute",
    top: `${box.top}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: "0",
    pointerEvents: "none",
  });
  list.append(node);
  void node
    .animate(
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: SHIFT },
      ],
      { duration: LEAVE_MS, easing: EASING, fill: "forwards" },
    )
    .finished.catch(() => undefined)
    .finally(() => node.remove());
}

function play(list: HTMLElement, shot: Snapshot) {
  const current = rows(list);
  for (const row of current) moving.get(row)?.cancel();
  const frame = list.getBoundingClientRect();
  const placed = current.map((row) => [row, boxOf(row, list, frame)] as const);
  for (const [row, box] of placed) {
    const before = shot.boxes.get(row.dataset.sessionKey ?? "");
    if (!before) {
      enter(row);
      continue;
    }
    const dx = before.left - box.left;
    const dy = before.top - box.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    track(
      row,
      row.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: MOVE_MS, easing: EASING }),
    );
  }
  for (const { node, box } of shot.ghosts) leave(list, node, box);
}

function pulse(list: HTMLElement, key: string) {
  const row = list.querySelector<HTMLElement>(`:scope > [data-session-key="${CSS.escape(key)}"]`);
  if (!row || row.classList.contains(MOTION_PULSE)) return;
  row.classList.add(MOTION_PULSE);
  const done = () => {
    window.clearTimeout(timer);
    row.removeEventListener("animationend", done);
    row.classList.remove(MOTION_PULSE);
  };
  const timer = window.setTimeout(done, PULSE_FALLBACK_MS);
  row.addEventListener("animationend", done);
}

export function useListMotion(
  list: HTMLElement | null,
  entries: readonly MotionEntry[],
  layout: string,
  enabled: boolean,
  returning: string | null,
) {
  const order = `${layout}\n${entries.map((entry) => (entry.open ? `${entry.key}\u0000${entry.open}` : entry.key)).join("\n")}`;
  const lights = entries.map((entry) => `${entry.key}=${entry.light ?? ""}`).join("\n");
  const settled = useRef<{ order: string; layout: string } | null>(null);
  const shot = useRef<Snapshot | null>(null);
  const seen = useRef<Map<string, string> | null>(null);

  const last = settled.current;
  if (enabled && list && last && last.layout === layout && last.order !== order && shot.current?.order !== order) {
    shot.current = snapshot(list, order, new Set(entries.map((entry) => entry.key)));
  }

  useLayoutEffect(() => {
    const previous = settled.current;
    const taken = shot.current;
    settled.current = { order, layout };
    shot.current = null;
    if (!list || !enabled || !previous || !taken || taken.order !== order || returning || reducedMotion()) return;
    play(list, taken);
  }, [list, order, layout, enabled, returning]);

  useLayoutEffect(() => {
    const now = new Map(
      lights
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const cut = line.lastIndexOf("=");
          return [line.slice(0, cut), line.slice(cut + 1)] as const;
        }),
    );
    const before = seen.current;
    seen.current = now;
    if (!list || !enabled || !before || reducedMotion()) return;
    for (const [key, light] of now) {
      const was = before.get(key);
      if (was !== undefined && CALLING.has(light) && !CALLING.has(was)) pulse(list, key);
    }
  }, [list, lights, enabled]);
}
