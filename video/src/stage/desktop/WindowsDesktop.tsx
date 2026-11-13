import type { CSSProperties } from "react";
import { stage } from "../stageState";
import { useStore } from "../store";
import { AppWindow, type DesktopWindow } from "./AppWindow";
import { Taskbar, type TaskbarApp } from "./Taskbar";
import "./desktop.css";

export type DesktopSpec = {
  wallpaper: string;
  windows: DesktopWindow[];
  apps: TaskbarApp[];
};

export function WindowsDesktop({ wallpaper, windows, apps }: DesktopSpec) {
  const { scene } = useStore(stage);
  return (
    <div className={`desktop desktop--${scene || "idle"}`}>
      <img className="desktop__wallpaper" src={wallpaper} alt="" draggable={false} />
      {windows.map((item, index) => (
        <AppWindow key={item.id} window={item} style={{ zIndex: index + 1 } as CSSProperties} />
      ))}
      <Taskbar apps={apps} scene={scene} />
    </div>
  );
}
