import { isMacOS } from "../../lib/platform.ts";
import { isPrimaryKey } from "../../lib/shortcut/shortcut.ts";

export type ClipboardPreviewSize = "standard" | "medium" | "full" | "custom";
export type ClipboardPreviewSizeRequest = "standard" | "medium" | "full" | "next" | "toggle-full";
export type ClipboardPreviewEdge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export type ClipboardPreviewDragPhase = "start" | "move" | "end";

export type ClipboardPreviewCommand = { type: "zoom"; zoom: "in" | "out" | "reset" } | { type: "edit" };
export type ClipboardPreviewEditEnd = "refocus" | "leave" | "blur";

export type ClipboardPreviewReport =
  | { type: "pointer"; inside: boolean }
  | { type: "pinned"; pinned: boolean }
  | { type: "close" }
  | { type: "edited"; id: string };

export const PREVIEW_SIZES: readonly Exclude<ClipboardPreviewSize, "custom">[] = ["standard", "medium", "full"];

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

const ZOOM_KEYS: Record<string, "in" | "out" | "reset"> = { "+": "in", "=": "in", "-": "out", "0": "reset" };

export function previewCommandForKey(event: KeyLike, mac = isMacOS): ClipboardPreviewCommand | null {
  if (!event.altKey && isPrimaryKey(event, mac) && event.key.toLowerCase() === "e") return { type: "edit" };
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const zoom = ZOOM_KEYS[event.key];
  return zoom ? { type: "zoom", zoom } : null;
}

export function isPreviewSizeKey(event: KeyLike): boolean {
  return !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "f";
}
