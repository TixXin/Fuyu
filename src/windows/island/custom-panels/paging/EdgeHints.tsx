import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { EdgeState } from "./useEdgeFlip";
import "./EdgeHints.css";

const RING = 2 * Math.PI * 14;

export function EdgeHints({ edge, continuous }: { edge: EdgeState; continuous: boolean }) {
  return (
    <>
      {([-1, 1] as const).map((side) => {
        const on = edge.zone === side;
        const Icon = side < 0 ? ChevronLeft : edge.fresh && on ? Plus : ChevronRight;
        return (
          <div key={side} className="panel-edge" data-side={side < 0 ? "left" : "right"} data-on={on || undefined} data-off={(on && !edge.can) || undefined} aria-hidden="true">
            {continuous ? null : (
              <span className="panel-edge__ring">
                <svg width="34" height="34" viewBox="0 0 34 34">
                  <circle className="panel-edge__track" cx="17" cy="17" r="14" />
                  <circle className="panel-edge__progress" cx="17" cy="17" r="14" strokeDasharray={RING} strokeDashoffset={RING * (1 - (on ? edge.progress : 0))} />
                </svg>
                <Icon size={16} strokeWidth={2.4} />
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
