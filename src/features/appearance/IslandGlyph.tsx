import { MousePointer2 } from "lucide-react";
import "./IslandGlyph.css";

export function IslandGlyph({ state, pointer = false, tone }: { state: "collapsed" | "expanded" | "tucked"; pointer?: boolean | "click"; tone?: "dark" | "light" | "system" }) {
  return (
    <span className={`island-glyph island-glyph--${state}${tone ? ` island-glyph--tone-${tone}` : ""}`}>
      <span className="island-glyph__island">
        <i />
        {state === "expanded" ? <><b /><b /></> : null}
      </span>
      {pointer ? (
        <span className={pointer === "click" ? "island-glyph__pointer island-glyph__pointer--click" : "island-glyph__pointer"}>
          <MousePointer2 size={14} strokeWidth={2} />
        </span>
      ) : null}
    </span>
  );
}
