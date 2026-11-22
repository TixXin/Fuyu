import { useEffect, useRef, useState, type RefObject } from "react";
import type { PageNav } from "./usePageNav";
import { easeOut } from "./scrollMotion";

export type EdgeZone = -1 | 0 | 1;
export type EdgeState = { zone: EdgeZone; progress: number; fresh: boolean; can: boolean };
export type Pointer = { x: number; y: number };

const ZONE_PX = 36;
const REACH_PX = 14;
const DWELL_MS = 450;
const REPEAT_MS = 800;
const FLICK_PX_PER_MS = 1.1;
const PEEK_PX = 28;
const CRAWL_PX = 14;
const IDLE: EdgeState = { zone: 0, progress: 0, fresh: false, can: false };

type Options = {
  active: boolean;
  pointer: RefObject<Pointer | null>;
  scroller: RefObject<HTMLElement | null>;
  stepPx: number;
  nav: PageNav;
  pageCount: number;
  canAdd: boolean;
  onAdd: () => void;
  continuous: boolean;
  reduced: boolean;
};

export function useEdgeFlip(options: Options): EdgeState {
  const [state, setState] = useState<EdgeState>(IDLE);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!options.active) return;
    let frame = 0;
    let zone: EdgeZone = 0;
    let since = 0;
    let need = DWELL_MS;
    let pending: number | null = null;
    let shown = IDLE;
    const trail: { x: number; t: number }[] = [];
    const publish = (next: EdgeState) => {
      if (next.zone === shown.zone && next.fresh === shown.fresh && next.can === shown.can && Math.abs(next.progress - shown.progress) < 0.02) return;
      shown = next;
      setState(next);
    };
    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      const { pointer, scroller, stepPx, nav, pageCount, canAdd, onAdd, continuous, reduced } = latest.current;
      const point = pointer.current;
      const area = scroller.current;
      if (!point || !area) return publish(IDLE);
      if (pending !== null && area.scrollWidth >= area.clientWidth + pending * stepPx - 1) {
        nav.goPage(pending);
        pending = null;
      }
      trail.push({ x: point.x, t: now });
      while (trail.length > 2 && now - trail[0].t > 90) trail.shift();
      const rect = area.getBoundingClientRect();
      const inside = point.y >= rect.top - REACH_PX && point.y <= rect.bottom + REACH_PX;
      const next: EdgeZone = !inside ? 0 : point.x < rect.left + ZONE_PX ? -1 : point.x > rect.right - ZONE_PX ? 1 : 0;
      const page = nav.pageRef.current ?? 0;
      if (next !== zone) {
        const speed = trail.length > 1 ? (trail[trail.length - 1].x - trail[0].x) / Math.max(1, now - trail[0].t) : 0;
        if (zone !== 0 && !continuous) nav.settle();
        zone = next;
        since = now;
        need = next !== 0 && next * speed > FLICK_PX_PER_MS ? 0 : DWELL_MS;
      }
      if (zone === 0) return publish(IDLE);
      if (continuous) {
        const depth = zone < 0 ? rect.left + ZONE_PX - point.x : point.x - (rect.right - ZONE_PX);
        area.scrollLeft += zone * CRAWL_PX * Math.min(1, Math.max(0.2, depth / ZONE_PX));
        return publish({ zone, progress: 0, fresh: false, can: true });
      }
      const fresh = zone > 0 && page >= pageCount - 1;
      const can = zone < 0 ? page > 0 : !fresh || canAdd;
      if (!can || nav.animating() || pending !== null) {
        since = now;
        return publish({ zone, progress: 0, fresh, can });
      }
      const progress = need > 0 ? Math.min(1, (now - since) / need) : 1;
      if (progress < 1) {
        if (!reduced) nav.peek(zone * PEEK_PX * easeOut(progress));
        return publish({ zone, progress, fresh, can });
      }
      since = now;
      need = REPEAT_MS;
      if (fresh) {
        onAdd();
        pending = page + 1;
      } else nav.goPage(page + zone);
      publish({ zone, progress: 0, fresh, can });
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      setState(IDLE);
    };
  }, [options.active]);

  return state;
}
