import type { ReactNode } from "react";

export type IslandMode = "collapsed" | "expanded";

export type BuiltinPage = "todo" | "calendar" | "music" | "clipboard" | "shelf" | "qq" | "agents" | "translation";

export type PluginPageId = `plugin:${string}`;

export type IslandPage = BuiltinPage | PluginPageId;

export type NativeGlassState = "active" | "css-fallback" | "disabled";

export type CollapsedSlots = {
  center?: ReactNode;
  agentIcon?: ReactNode;
  gauges?: { id: string; node: ReactNode }[];
  statusLight?: ReactNode;
  agentCount?: ReactNode;
  agentIconWidth?: number;
  centerWidth?: number;
  sideWidth?: number;
};
