import type { ReactNode } from "react";
import type { IslandDecor } from "../../features/plugin-kernel/islandDecor";

export type IslandMode = "collapsed" | "expanded";

export type BuiltinPage = "todo" | "calendar" | "music" | "clipboard" | "shelf" | "screenshots" | "timer" | "qq" | "agents" | "translation";

export type HeaderDotPage = Extract<BuiltinPage, "todo" | "calendar" | "music" | "clipboard" | "shelf" | "screenshots" | "timer">;

export type PluginPage = string & Record<never, never>;

export type IslandPage = BuiltinPage | PluginPage;

export type NativeGlassState = "active" | "css-fallback" | "disabled";

export type CollapsedSlots = IslandDecor & {
  gauges?: { id: string; node: ReactNode }[];
};
