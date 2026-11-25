import type { IslandPage } from "./types";

export const PREVIEW_HEIGHT = 86;
export const PREVIEW_MIN_WIDTH = 400;
export const PREVIEW_ROTATE_MS = 4000;
export const PREVIEW_LEAVE_MS = 200;

export type PreviewCardKind = "agent" | "meeting" | "music" | "unread" | "calendar" | "todo" | "clock";

export type PreviewCard = {
  id: string;
  kind: PreviewCardKind;
  urgent: boolean;
  page: IslandPage;
  title: string;
  subtitle: string;
  badge?: string;
  cover?: string | null;
  action?: { id: string; label: string };
};

export type PreviewSourceLine = {
  item: string;
  label?: string;
  page?: string;
  action?: string;
  priority: number;
};

export function previewWidth(collapsedWidth: number, expandedWidth: number): number {
  const target = Math.max(collapsedWidth + 40, PREVIEW_MIN_WIDTH);
  return Math.min(Math.max(expandedWidth, PREVIEW_MIN_WIDTH), target);
}

function classifyLine(line: PreviewSourceLine): { kind: PreviewCardKind; urgent: boolean; page: IslandPage } {
  const id = line.item.toLowerCase();
  if (id.includes("agent") || id.includes("approval") || line.page === "agents") {
    return { kind: "agent", urgent: line.priority >= 60, page: "agents" };
  }
  if (id.includes("meeting") || id.includes("calendar") || line.page === "calendar") {
    return { kind: id.includes("meeting") ? "meeting" : "calendar", urgent: id.includes("meeting") && line.priority >= 50, page: "calendar" };
  }
  if (id.includes("music") || id.includes("lyric") || line.page === "music") {
    return { kind: "music", urgent: false, page: "music" };
  }
  if (id.includes("mail") || id.includes("message") || id.includes("qq") || id.includes("wechat") || line.page === "qq" || line.page === "messages") {
    return { kind: "unread", urgent: false, page: "qq" };
  }
  return { kind: "todo", urgent: false, page: (line.page as IslandPage | undefined) ?? "todo" };
}

const KIND_RANK: Record<PreviewCardKind, number> = {
  agent: 0,
  meeting: 1,
  music: 2,
  unread: 3,
  calendar: 4,
  todo: 5,
  clock: 6,
};

export function buildPreviewCards(
  lines: readonly PreviewSourceLine[],
  options: {
    homePage: IslandPage;
    now: Date;
    locale: string;
    labels: Record<PreviewCardKind, string>;
    musicPlayback?: { playing: boolean; title?: string; artist?: string; cover?: string | null } | null;
    playPauseLabel?: string;
  },
): PreviewCard[] {
  const cards: PreviewCard[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const label = line.label?.trim();
    if (!label) continue;
    const { kind, urgent, page } = classifyLine(line);
    if (seen.has(kind)) continue;
    seen.add(kind);
    cards.push({
      id: `${kind}:${line.item}`,
      kind,
      urgent,
      page,
      title: label,
      subtitle: options.labels[kind],
      action: line.action ? { id: line.action, label: options.labels[kind] } : undefined,
    });
  }

  if (options.musicPlayback?.playing && !seen.has("music")) {
    const title = options.musicPlayback.title?.trim() || options.labels.music;
    const subtitle = options.musicPlayback.artist?.trim() || options.labels.music;
    cards.push({
      id: "music:playback",
      kind: "music",
      urgent: false,
      page: "music",
      title,
      subtitle,
      cover: options.musicPlayback.cover ?? null,
      action: options.playPauseLabel ? { id: "music.toggle", label: options.playPauseLabel } : undefined,
    });
  }

  cards.sort((a, b) => Number(b.urgent) - Number(a.urgent) || KIND_RANK[a.kind] - KIND_RANK[b.kind]);

  if (cards.length === 0) {
    const clock = options.now.toLocaleTimeString(options.locale, { hour: "2-digit", minute: "2-digit", hour12: false });
    const date = options.now.toLocaleDateString(options.locale, { month: "short", day: "numeric", weekday: "short" });
    cards.push({
      id: "clock:fallback",
      kind: "clock",
      urgent: false,
      page: options.homePage,
      title: clock,
      subtitle: date,
    });
  }

  return cards;
}

export function pickVisibleCards(cards: readonly PreviewCard[]): PreviewCard[] {
  const urgent = cards.find((card) => card.urgent);
  if (urgent) return [urgent];
  return [...cards];
}
