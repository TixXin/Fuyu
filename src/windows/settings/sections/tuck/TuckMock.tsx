import type { CSSProperties } from "react";
import { MousePointer2 } from "lucide-react";
import type { TuckHintStyle, TuckStyle } from "../../../../lib/settings/types";
import "./TuckMock.css";

const ISLAND = { width: 150, height: 38, expandedWidth: 236, expandedHeight: 92, margin: 10, realWidth: 300 } as const;
const VISIBLE: Record<TuckStyle, number> = { edge: 10, line: 4, hidden: 0 };

export type TuckMockHint = { style: TuckHintStyle; paint: string; ring: "dark" | "light"; breathe: boolean };

export function TuckMock({
  tuckStyle,
  hint,
  islandColor,
  scale = 1,
  revealed = false,
  expanded = false,
  pointer = null,
  lipHeight,
  lipWidth = 0,
}: {
  tuckStyle: TuckStyle;
  lipHeight?: number;
  lipWidth?: number;
  hint: TuckMockHint | null;
  islandColor: string;
  scale?: number;
  revealed?: boolean;
  expanded?: boolean;
  pointer?: "away" | "edge" | null;
}) {
  const open = revealed && expanded;
  const narrow = !revealed && lipWidth > 0 ? Math.min(ISLAND.width, (lipWidth * ISLAND.width) / ISLAND.realWidth) : ISLAND.width;
  const width = (open ? ISLAND.expandedWidth : narrow) * scale;
  const height = (open ? ISLAND.expandedHeight : ISLAND.height) * scale;
  const offset = revealed ? ISLAND.margin * scale : -(ISLAND.height - (lipHeight ?? VISIBLE[tuckStyle])) * scale;
  const hidden = tuckStyle === "hidden" && !revealed;
  const islandStyle = { width, height, transform: `translate(-50%, ${offset}px)`, background: islandColor } as CSSProperties;
  const showHint = hint && hidden && hint.style !== "none";
  const hintClass = showHint
    ? `tuck-mock__hint tuck-mock__hint--${hint.style} tuck-mock__hint--ring-${hint.ring}${hint.breathe ? " tuck-mock__hint--breathe" : ""}`
    : "";

  return (
    <span className="tuck-mock" style={{ "--tuck-mock-scale": scale } as CSSProperties} aria-hidden="true">
      <span className={["tuck-mock__island", hidden && "tuck-mock__island--hidden", revealed && "tuck-mock__island--revealed"].filter(Boolean).join(" ")} style={islandStyle}>
        <i />
      </span>
      {showHint ? <span className={hintClass} style={{ "--tuck-mock-hint": hint.paint } as CSSProperties} /> : null}
      {pointer ? (
        <span className={`tuck-mock__pointer tuck-mock__pointer--${pointer}`}>
          <MousePointer2 size={14} strokeWidth={2} />
        </span>
      ) : null}
    </span>
  );
}
