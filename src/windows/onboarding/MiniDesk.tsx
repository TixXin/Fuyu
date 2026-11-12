import type { ReactNode } from "react";
import "./MiniDesk.css";

/** The guide's small desktop: a wallpaper, the island hanging from its top edge, and whatever else an act puts on it. */
export function MiniDesk({ island, tall = false, children }: { island: ReactNode; tall?: boolean; children?: ReactNode }) {
  return (
    <div className={tall ? "mini-desk mini-desk--tall" : "mini-desk"}>
      <div className="mini-desk__island">{island}</div>
      {children}
    </div>
  );
}
