import { AppWindow, MousePointer2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { IslandMonitor, MenuBarPlacement } from "./types";
import "./PositionDiagram.css";

const MAX_MARGIN = 160;
const MAX_OFFSET = 26;

export function PositionDiagram({ monitor, marginY, menuBar }: { monitor: IslandMonitor; marginY: number; menuBar: MenuBarPlacement | null }) {
  const onSecond = monitor !== "primary";
  const offset = Math.round((Math.min(Math.max(marginY, 0), MAX_MARGIN) / MAX_MARGIN) * MAX_OFFSET) + (menuBar === "below" ? 7 : 0);
  const island = <span className="position-diagram__island" style={{ "--position-offset": `${offset}px` } as CSSProperties} />;
  const screen = (active: boolean, main: boolean) => (
    <span className={`position-diagram__screen${main ? " position-diagram__screen--main" : ""}${active ? " position-diagram__screen--active" : ""}`}>
      {menuBar ? <span className="position-diagram__menu-bar" /> : null}
      {active ? island : null}
      {active && monitor === "cursor" ? <MousePointer2 className="position-diagram__mark" size={13} strokeWidth={2} /> : null}
      {active && monitor === "foreground" ? <AppWindow className="position-diagram__mark" size={15} strokeWidth={1.8} /> : null}
    </span>
  );
  return (
    <span className="position-diagram" aria-hidden="true">
      {screen(!onSecond, true)}
      {screen(onSecond, false)}
    </span>
  );
}
