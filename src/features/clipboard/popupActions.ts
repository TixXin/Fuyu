import type { ClipboardActionsText } from "../../i18n/sections/clipboardActions";
import type { ClipboardCaptureStatus, ClipboardCopyAs, ClipboardHistoryItem } from "./api";
import { colorFormats, contentKind } from "./contentKind.ts";

export type PopupAction = {
  id: string;
  group: "paste" | "entry" | "record";
  label: string;
  keys?: string;
  note?: string;
  icon: ActionIcon;
  run?: () => void;
  next?: "transforms" | "note" | "ai";
};

export type ActionIcon = "paste" | "plain" | "enter" | "edit" | "wand" | "file" | "image" | "qr" | "star" | "tag" | "snippet" | "trash" | "pause" | "play" | "skip" | "ai";

export type PopupActionHandlers = {
  paste: (id: string, options?: { plain?: boolean; enter?: boolean; copyAs?: ClipboardCopyAs }) => void;
  pasteText: (text: string, enter?: boolean) => void;
  pasteQr: (id: string) => void;
  edit: () => void;
  toggleFavorite: (id: string) => void;
  saveSnippet: (item: ClipboardHistoryItem) => void;
  remove: (item: ClipboardHistoryItem) => void;
  pause: (minutes: number | null) => void;
  resume: () => void;
  ignoreNext: () => void;
};

export function popupActions(item: ClipboardHistoryItem | undefined, capture: ClipboardCaptureStatus | undefined, handlers: PopupActionHandlers, text: ClipboardActionsText): PopupAction[] {
  const actions: PopupAction[] = [];
  const add = (action: PopupAction) => actions.push(action);
  if (item) {
    const isText = item.kind === "text";
    add({ id: "paste", group: "paste", label: text.paste, keys: "↵", icon: "paste", run: () => handlers.paste(item.id) });
    if (isText) add({ id: "plain", group: "paste", label: text.pastePlain, keys: "⇧ ↵", icon: "plain", run: () => handlers.paste(item.id, { plain: true }) });
    add({ id: "enter", group: "paste", label: text.pasteEnter, keys: "Ctrl ↵", note: text.pasteEnterHint, icon: "enter", run: () => handlers.paste(item.id, { enter: true }) });
    if (isText) {
      add({ id: "edit", group: "paste", label: text.edit, keys: "Ctrl E", icon: "edit", run: handlers.edit });
      add({ id: "transform", group: "paste", label: text.transform, keys: "Ctrl T", icon: "wand", next: "transforms" });
      if (!item.masked) add({ id: "ai", group: "paste", label: text.ai, keys: "Ctrl I", icon: "ai", next: "ai" });
      const kind = contentKind(item);
      if (kind?.kind === "color") {
        const formats = colorFormats(kind.color);
        for (const [name, value] of [["HEX", formats.hex], ["RGB", formats.rgb], ["HSL", formats.hsl]] as const) {
          add({ id: `color-${name}`, group: "paste", label: text.pasteAs(name), note: value, icon: "paste", run: () => handlers.pasteText(value) });
        }
      }
      add({ id: "textFile", group: "paste", label: text.pasteTextFile, icon: "file", run: () => handlers.paste(item.id, { copyAs: "textFile" }) });
    }
    if (item.kind === "image") {
      add({ id: "file", group: "paste", label: text.pasteFile, icon: "file", run: () => handlers.paste(item.id, { copyAs: "file" }) });
      add({ id: "path", group: "paste", label: text.pastePath, icon: "image", run: () => handlers.paste(item.id, { copyAs: "path" }) });
      if (item.ocrText) add({ id: "ocr", group: "paste", label: text.pasteOcr, icon: "plain", run: () => handlers.paste(item.id, { copyAs: "text" }) });
      add({ id: "qr", group: "paste", label: text.pasteQr, icon: "qr", run: () => handlers.pasteQr(item.id) });
    }
    if (item.kind === "files") add({ id: "path", group: "paste", label: text.pastePath, icon: "plain", run: () => handlers.paste(item.id, { copyAs: "path" }) });
    add({ id: "favorite", group: "entry", label: item.favorite ? text.unfavorite : text.favorite, keys: "Ctrl S", icon: "star", run: () => handlers.toggleFavorite(item.id) });
    add({ id: "note", group: "entry", label: text.note, keys: "Ctrl M", icon: "tag", next: "note" });
    if (isText && !item.masked) add({ id: "snippet", group: "entry", label: text.saveSnippet, icon: "snippet", run: () => handlers.saveSnippet(item) });
    add({ id: "delete", group: "entry", label: text.delete, keys: "Del", icon: "trash", run: () => handlers.remove(item) });
  }
  if (capture?.paused) {
    add({ id: "resume", group: "record", label: text.resume, icon: "play", run: handlers.resume });
  } else {
    add({ id: "pause15", group: "record", label: text.pause15, icon: "pause", run: () => handlers.pause(15) });
    add({ id: "pause60", group: "record", label: text.pause60, icon: "pause", run: () => handlers.pause(60) });
    add({ id: "pause", group: "record", label: text.pauseUntilResumed, icon: "pause", run: () => handlers.pause(null) });
    if (!capture?.ignoreNext) add({ id: "ignoreNext", group: "record", label: text.ignoreNext, icon: "skip", run: handlers.ignoreNext });
  }
  return actions;
}

export function filterActions(actions: readonly PopupAction[], query: string): PopupAction[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return actions.filter((action) => words.every((word) => `${action.label} ${action.note ?? ""} ${action.keys ?? ""}`.toLowerCase().includes(word)));
}

export function mergedText(items: readonly ClipboardHistoryItem[], separator: "newline" | "space" | "comma"): string {
  const join = separator === "newline" ? "\n" : separator === "space" ? " " : ", ";
  return items
    .map((item) => item.text ?? (item.files ? item.files.join(join) : item.ocrText ?? ""))
    .filter((part) => part.trim() !== "")
    .join(join);
}
