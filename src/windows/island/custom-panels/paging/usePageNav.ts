import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MOTION_BASE_MS, MOTION_SLOW_MS } from "../../../../lib/theme/motionTokens";
import { animateScroll } from "./scrollMotion";

export type PageNav = {
  page: number;
  pageRef: RefObject<number>;
  goPage: (page: number, ms?: number) => void;
  peek: (offset: number) => void;
  settle: () => void;
  animating: () => boolean;
};

export function usePageNav(scroller: RefObject<HTMLElement | null>, stepPx: number, enabled: boolean, holding: boolean, reduced: boolean): PageNav {
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const anim = useRef<(() => void) | null>(null);
  const latest = useRef({ stepPx, reduced, holding });
  useEffect(() => {
    latest.current = { stepPx, reduced, holding };
  });

  const show = useCallback((next: number) => {
    pageRef.current = next;
    setPage(next);
  }, []);

  const goPage = useCallback(
    (next: number, ms = MOTION_SLOW_MS) => {
      const element = scroller.current;
      const { stepPx: step, reduced: still } = latest.current;
      if (!element || step <= 0) return;
      const target = Math.max(0, next);
      anim.current?.();
      show(target);
      anim.current = animateScroll(element, target * step, still ? 0 : ms, () => {
        anim.current = null;
      });
    },
    [scroller, show],
  );

  useEffect(() => {
    const element = scroller.current;
    if (!element || !enabled) return;
    const onScroll = () => {
      if (anim.current) return;
      const step = latest.current.stepPx;
      if (step > 0) show(Math.round(element.scrollLeft / step));
    };
    const onScrollEnd = () => {
      const step = latest.current.stepPx;
      if (anim.current || latest.current.holding || step <= 0) return;
      const nearest = Math.round(element.scrollLeft / step);
      if (Math.abs(element.scrollLeft - nearest * step) > 1) goPage(nearest, MOTION_BASE_MS);
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    element.addEventListener("scrollend", onScrollEnd);
    return () => {
      element.removeEventListener("scroll", onScroll);
      element.removeEventListener("scrollend", onScrollEnd);
    };
  }, [scroller, enabled, goPage, show]);

  useEffect(() => () => anim.current?.(), []);

  return useMemo(
    () => ({
      page,
      pageRef,
      goPage,
      peek: (offset: number) => {
        const element = scroller.current;
        if (!element || anim.current) return;
        element.scrollLeft = pageRef.current * latest.current.stepPx + offset;
      },
      settle: () => goPage(pageRef.current, MOTION_BASE_MS),
      animating: () => anim.current !== null,
    }),
    [page, goPage, scroller],
  );
}
