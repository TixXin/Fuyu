export const HOVER_FOCUS_DWELL_MS = 160;
export const HOVER_FOCUS_RETRY_MS = 120;

export type HoverFocusState = {
  expanded: boolean;
  hovering: boolean;
  editing: boolean;
  selecting?: boolean;
  blocked: boolean;
};

export type HoverFocusAction = "take" | "release" | "none";

export function hoverFocusAction({ expanded, hovering, editing, selecting = false, blocked }: HoverFocusState): HoverFocusAction {
  if (expanded && hovering) return blocked ? "none" : "take";
  if (expanded && (editing || selecting)) return "none";
  return "release";
}
