import type { CSSProperties } from "react";
import type { TrayAgents, TrayMedia, TrayMeeting } from "./trayCard";

const TRAY_ENTRY_PLUGINS = {
  screenshot: "screenshot",
  translate: "translation",
  clipboard: "clipboard",
  todo: "todos",
  notes: "todos",
  calendar: "calendar",
  "file-shelf": "file-shelf",
  agent: "agents",
  music: "music",
} as const;

export type TrayEntry = keyof typeof TRAY_ENTRY_PLUGINS;

export function entryShown(off: ReadonlySet<string>, entry: TrayEntry) {
  return !off.has(TRAY_ENTRY_PLUGINS[entry]);
}

type Status = { media: TrayMedia | null; meeting: TrayMeeting | null; agents: TrayAgents | null };

export function shownStatus<T extends Status>(status: T, off: ReadonlySet<string>): T {
  return {
    ...status,
    media: entryShown(off, "music") ? status.media : null,
    meeting: entryShown(off, "calendar") ? status.meeting : null,
    agents: entryShown(off, "agent") ? status.agents : null,
  };
}

export type TrayFeatureEntry = Extract<TrayEntry, "screenshot" | "translate" | "clipboard">;

export function shownFeatures(off: ReadonlySet<string>, features: readonly TrayFeatureEntry[]) {
  return features.filter((feature) => entryShown(off, feature));
}

export function columns(count: number): CSSProperties {
  return { "--tray-cols": Math.max(1, count) } as CSSProperties;
}
