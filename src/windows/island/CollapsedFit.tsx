import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { collapsedFit } from "./collapsedFitStore";

const CLIPPED = "data-clipped";

export function CollapsedFit({ id, floor, children }: { id: string; floor: number; children: ReactNode }) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const floorRef = useRef(floor);
  useLayoutEffect(() => {
    floorRef.current = floor;
  });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      if (inner.getClientRects().length === 0) return;
      collapsedFit.report(id, inner.offsetWidth + 1, floorRef.current);
      outer.toggleAttribute(CLIPPED, inner.offsetWidth > outer.clientWidth);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return () => collapsedFit.drop(id);
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    observer.observe(outer);
    return () => {
      observer.disconnect();
      collapsedFit.drop(id);
    };
  }, [id]);

  useEffect(() => {
    const inner = innerRef.current;
    if (inner && inner.getClientRects().length > 0) collapsedFit.report(id, inner.offsetWidth + 1, floor);
  }, [id, floor]);

  return (
    <span ref={outerRef} className="island__collapsed-fit" data-fit-item={id}>
      <span ref={innerRef} className="island__collapsed-fit-inner">{children}</span>
    </span>
  );
}
