import type { IslandLineContribution } from "../../features/plugin-kernel/islandContributions.ts";
import type { NotchTextKind, NotchTextModes } from "../../lib/settings/collapsedText.ts";

export const NOTCH_FLASH_MS = 4000;

const KIND_OF: Readonly<Record<string, NotchTextKind>> = {
  "todos.title": "todos",
  "media.lyric": "lyrics",
  "agent-status.session": "agent",
  "calendar.meeting": "meeting",
};

const PAGE_OF: Readonly<Record<NotchTextKind, string>> = { todos: "todo", lyrics: "music", agent: "agents", meeting: "calendar" };

export function notchTextPage(line: IslandLineContribution): string | null {
  const kind = notchTextKind(line.item);
  return line.page ?? (kind ? PAGE_OF[kind] : null);
}

export function notchTextKind(item: string): NotchTextKind | null {
  return KIND_OF[item] ?? null;
}

export function lineText(line: IslandLineContribution) {
  if (notchTextKind(line.item) === "lyrics") return line.measure ?? "";
  return line.label ?? line.measure ?? "";
}

export type NotchTextRoute = { row: IslandLineContribution | null; panel: IslandLineContribution[] };

export function routeNotchText(lines: readonly IslandLineContribution[], modes: NotchTextModes, flashing: ReadonlySet<string>): NotchTextRoute {
  const panel: IslandLineContribution[] = [];
  let row: IslandLineContribution | null = null;
  for (const line of lines) {
    const kind = notchTextKind(line.item);
    if (!kind || line.reserve === true || line.drop === true || line.always === true) continue;
    const mode = modes[kind];
    if (mode === "panel") panel.push(line);
    else if (!row && (mode === "row" || (mode === "flash" && flashing.has(line.item)))) row = line;
  }
  return { row, panel };
}

export function anyNotchText(modes: NotchTextModes) {
  return Object.values(modes).some((mode) => mode !== "off");
}

const LOUD = "\u0001";

function interjecting(line: IslandLineContribution) {
  return line.interjection === true;
}

export function changedTexts(before: ReadonlyMap<string, string>, lines: readonly IslandLineContribution[]) {
  const now = new Map<string, string>();
  const changed: string[] = [];
  for (const line of lines) {
    if (!notchTextKind(line.item) || line.reserve === true) continue;
    const text = lineText(line) || "shown";
    const key = interjecting(line) ? `${text}${LOUD}` : text;
    now.set(line.item, key);
    const was = before.get(line.item);
    if (was !== key && was !== `${key}${LOUD}`) changed.push(line.item);
  }
  return { now, changed };
}
