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

export type FlashEntry = { item: string; held: boolean };
export type FlashLive = "gone" | "sticky" | "plain";

export function flashLive(lines: readonly IslandLineContribution[], modes: NotchTextModes) {
  return (item: string): FlashLive => {
    const line = lines.find((candidate) => candidate.item === item && candidate.reserve !== true && candidate.drop !== true && candidate.always !== true);
    const kind = line ? notchTextKind(line.item) : null;
    if (!line || !kind || modes[kind] !== "flash") return "gone";
    return line.sticky === true ? "sticky" : "plain";
  };
}

export function queueFlash(queue: readonly FlashEntry[], items: readonly string[]): readonly FlashEntry[] {
  if (items.length === 0) return queue;
  const kept = queue.map((entry) => (entry.held && items.includes(entry.item) ? { item: entry.item, held: false } : entry));
  const fresh = items.filter((item) => !queue.some((entry) => entry.item === item)).map((item) => ({ item, held: false }));
  return [...kept, ...fresh];
}

export function advanceFlash(queue: readonly FlashEntry[], live: (item: string) => FlashLive): readonly FlashEntry[] {
  const [head, ...rest] = queue;
  if (!head) return queue;
  if (live(head.item) !== "sticky") return rest;
  if (rest.length === 0) return head.held ? queue : [{ item: head.item, held: true }];
  return [...rest, { item: head.item, held: true }];
}

export function pruneFlash(queue: readonly FlashEntry[], live: (item: string) => FlashLive): readonly FlashEntry[] {
  const kept = queue.filter((entry) => {
    const state = live(entry.item);
    return state !== "gone" && !(entry.held && state === "plain");
  });
  return kept.length === queue.length ? queue : kept;
}
