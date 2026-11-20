import { ANNOTATION_TOOLS, TOOL_KEYS, type AnnotationTool } from "./annotations.ts";
import type { ShortcutPanelCorner } from "./settings.ts";

export type SheetPhase = "pick" | "edit" | "record";
export type SheetSection = "pick" | "finish" | "tools" | "record";
export type SheetWord = "drag" | "click" | "wheel" | "hold";
export type SheetRowId =
  | "selectArea"
  | "pickWindow"
  | "layer"
  | "copyColor"
  | "measure"
  | "cancel"
  | "copy"
  | "save"
  | "pin"
  | "undoRedo"
  | "deleteMark"
  | "wholeScreen"
  | "gif"
  | "collapse";

export type SheetRow = { id: SheetRowId | AnnotationTool; word?: SheetWord; keys: string[]; either?: boolean };
export type SheetGroup = { section: SheetSection; rows: SheetRow[] };

export function shortcutSheet(phase: SheetPhase, mac: boolean): SheetGroup[] {
  const mod = mac ? "⌘" : "Ctrl";
  const measure: SheetRow = { id: "measure", word: "hold", keys: ["M"] };
  const cancel: SheetRow = { id: "cancel", keys: ["Esc"] };
  const collapse: SheetRow = { id: "collapse", keys: ["?"] };
  if (phase === "record") {
    return [{
      section: "record",
      rows: [
        { id: "selectArea", word: "drag", keys: [] },
        { id: "pickWindow", word: "click", keys: [] },
        { id: "wholeScreen", keys: ["F"] },
        { id: "gif", keys: ["G"] },
        cancel,
        collapse,
      ],
    }];
  }
  if (phase === "pick") {
    return [{
      section: "pick",
      rows: [
        { id: "selectArea", word: "drag", keys: [] },
        { id: "pickWindow", word: "click", keys: [] },
        { id: "layer", word: "wheel", keys: [] },
        { id: "copyColor", keys: ["C"] },
        measure,
        cancel,
        collapse,
      ],
    }];
  }
  return [
    {
      section: "finish",
      rows: [
        { id: "copy", keys: ["Enter"] },
        { id: "save", keys: [mod, "S"] },
        { id: "pin", keys: ["T"] },
        { id: "undoRedo", keys: mac ? ["⌘Z", "⇧⌘Z"] : ["Ctrl+Z", "Ctrl+Y"], either: true },
        { id: "deleteMark", keys: [mac ? "⌫" : "Delete"] },
        measure,
        cancel,
        collapse,
      ],
    },
    { section: "tools", rows: ANNOTATION_TOOLS.map((tool) => ({ id: tool, keys: [TOOL_KEYS[tool]] })) },
  ];
}

export type CssBox = { x: number; y: number; width: number; height: number };

export const PANEL_MARGIN = 12;

export function cornerPosition(corner: ShortcutPanelCorner, view: { width: number; height: number }, size: { width: number; height: number }) {
  return {
    x: corner.endsWith("l") ? PANEL_MARGIN : Math.max(PANEL_MARGIN, view.width - size.width - PANEL_MARGIN),
    y: corner.startsWith("t") ? PANEL_MARGIN : Math.max(PANEL_MARGIN, view.height - size.height - PANEL_MARGIN),
  };
}

export function nearestCorner(box: CssBox, view: { width: number; height: number }): ShortcutPanelCorner {
  const top = box.y + box.height / 2 < view.height / 2;
  const left = box.x + box.width / 2 < view.width / 2;
  return `${top ? "t" : "b"}${left ? "l" : "r"}` as ShortcutPanelCorner;
}

export function overlaps(a: CssBox, b: CssBox) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
