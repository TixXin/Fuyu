import type { CSSProperties, ReactNode } from "react";
import { IslandShell, type IslandShellProps } from "./IslandShell";
import type { IslandMode } from "./types";
import type { TaskbarParts } from "./useTaskbarParts";
import "./IslandTaskbarParts.css";

export type IslandShellBase = Omit<IslandShellProps, "mode" | "part" | "children">;

type IslandTaskbarPartsProps = {
  shell: IslandShellBase;
  mode: IslandMode;
  parts: TaskbarParts;
  lift: number;
  children: ReactNode;
};

export function IslandTaskbarParts({ shell, mode, parts, lift, children }: IslandTaskbarPartsProps) {
  const open = mode === "expanded";
  return (
    <>
      <div className={`island-taskbar-bar${parts.barLight ? " island-light" : ""}`} style={parts.barStyle}>
        <IslandShell {...shell} mode="collapsed" part="bar" popup={false}>
          {null}
        </IslandShell>
      </div>
      <div
        className={`island-taskbar-panel${open ? " island-taskbar-panel--open" : ""}${parts.panelLight ? " island-light" : ""}`}
        style={{ "--island-taskbar-lift": `${lift}px`, "--island-taskbar-shift": `${parts.shift}px` } as CSSProperties}
        aria-hidden={!open}
        inert={!open}
      >
        <IslandShell {...shell} mode={mode} part="panel" notice={null} taskbarHandle={null}>
          {children}
        </IslandShell>
      </div>
    </>
  );
}
