import { useEffect, useState, type RefObject } from "react";
import { getResizeState } from "./session.ts";
import { zoneAt, type ResizeEdge } from "./zones.ts";

export type { ResizeEdge } from "./zones.ts";

const ARM_MS = 180;
const NONE: string[] = [];

export function useResizeZones(rootRef: RefObject<HTMLDivElement | null>, expanded: boolean, active: boolean) {
  const [armed, setArmed] = useState<ResizeEdge | null>(null);
  const [near, setNear] = useState<string[]>(NONE);

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !active) return;
    let timer = 0;
    let pending: ResizeEdge | null = null;
    const show = (next: string[]) => setNear((current) => (current.join() === next.join() ? current : next.length ? next : NONE));
    const move = (event: PointerEvent) => {
      if (getResizeState().drag) return;
      const rect = host.getBoundingClientRect();
      const flipped = document.documentElement.dataset.islandEdge === "bottom";
      const zone = zoneAt(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height, expanded, flipped);
      show(zone.near);
      if (zone.edge === pending) return;
      pending = zone.edge;
      window.clearTimeout(timer);
      setArmed(null);
      if (zone.edge) timer = window.setTimeout(() => setArmed(zone.edge), ARM_MS);
    };
    const leave = () => {
      if (getResizeState().drag) return;
      window.clearTimeout(timer);
      pending = null;
      show(NONE);
      setArmed(null);
    };
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => {
      window.clearTimeout(timer);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      show(NONE);
      setArmed(null);
    };
  }, [active, expanded, rootRef]);

  return { armed, near };
}
