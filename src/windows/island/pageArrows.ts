export type PageArrowAction = "previous" | "next" | "collapse" | "open";
export type PageArrowSide = "previous" | "next";

export type PageArrowKeyEvent = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "repeat" | "isComposing" | "defaultPrevented"
>;

export const PAGE_ARROW_PULSE_EVENT = "fuyu-page-arrow-pulse";

export const EDITABLE_TARGET = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
export const ARROW_OWNER_TARGET = [
  "listbox",
  "grid",
  "slider",
  "menu",
  "menubar",
  "radiogroup",
  "tree",
  "treegrid",
  "spinbutton",
  "combobox",
  "tablist",
].map((role) => `[role='${role}']`).join(", ");
export const OPEN_OVERLAY_TARGET = "[role='menu'], [role='dialog'], [aria-haspopup][aria-expanded='true']";
export const PRESSABLE_TARGET = "button, a[href], summary, [role='button'], [role='menuitem'], [role='option'], [role='switch'], [role='checkbox'], [role='link']";

export function pageArrowAction(event: PageArrowKeyEvent, expanded: boolean): PageArrowAction | null {
  if (event.defaultPrevented || event.repeat || event.isComposing) return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (!expanded) return event.key === "ArrowDown" || event.key === "Enter" ? "open" : null;
  if (event.key === "ArrowLeft") return "previous";
  if (event.key === "ArrowRight") return "next";
  if (event.key === "ArrowUp") return "collapse";
  return null;
}

export type PageArrowField = { tagName: string; type?: string; value?: string; isContentEditable?: boolean; textContent: string | null };
export type PageArrowTarget = { closest: (selector: string) => PageArrowField | null };

const EMPTY_FIELD_TYPES = new Set(["", "text", "search", "url", "email", "tel", "password"]);

function emptyTextField(field: PageArrowField): boolean {
  const tag = field.tagName.toUpperCase();
  if (tag === "TEXTAREA") return field.value === "";
  if (tag === "INPUT") return EMPTY_FIELD_TYPES.has((field.type ?? "").toLowerCase()) && field.value === "";
  return field.isContentEditable === true && (field.textContent ?? "").trim() === "";
}

export function pageArrowTargetAllows(action: PageArrowAction, key: string, target: PageArrowTarget | null): boolean {
  if (!target) return true;
  const field = target.closest(EDITABLE_TARGET);
  if (field && (action === "open" || !emptyTextField(field))) return false;
  if (action === "open") return key !== "Enter" || !target.closest(PRESSABLE_TARGET);
  return !target.closest(ARROW_OWNER_TARGET);
}

export function escapeClosesPanel(event: Pick<KeyboardEvent, "defaultPrevented" | "isComposing">, overlayOpen: boolean): boolean {
  return !event.defaultPrevented && !event.isComposing && !overlayOpen;
}
