export type IslandLineContribution = {
  kind: "line";
  item: string;
  priority: number;
  measure?: string;
  extra?: number;
  page?: string;
  lead?: boolean;
  handle?: boolean;
  label?: string;
  center?: boolean;
  shareable?: boolean;
  drop?: boolean;
  always?: boolean;
  bare?: boolean;
  reserve?: boolean;
  action?: string;
};

export type IslandTrailContribution = { kind: "trail"; item: string };

export type IslandAlertContribution = { kind: "alert"; item: string };
export type IslandNoticeContribution = { kind: "notice"; item: string; measure?: string };
export type IslandPreviewContribution = { kind: "preview"; item: string; key?: string; label?: string; hot?: string; action?: string; open?: string };
export type IslandSummaryContribution = { kind: "summary"; item: string };
export type IslandRevealContribution = { kind: "reveal"; reveal?: "always" | "allowed"; pauseIdle?: boolean; pauseHover?: boolean };
export type IslandHoldContribution = { kind: "hold"; reason: string };
export type IslandSideContribution = { kind: "side"; item: string; height: number };
export type IslandStatusContribution = { kind: "status"; state: string; label: string };
export type IslandPopupContribution = { kind: "popup"; page: string; height?: number; saving?: number; open?: boolean };
export type IslandStyleContribution = { kind: "style"; vars?: Readonly<Record<string, string>>; className?: string; tint?: string };
export type IslandBusyContribution = { kind: "busy" };
export type IslandHintContribution = { kind: "hint"; key: string };
export type IslandPageContribution = { kind: "page"; page: string; enabled: boolean };
export type IslandBadgeContribution = { kind: "badge"; target: string; label: string; action?: string };

export type IslandContribution =
  | IslandLineContribution
  | IslandTrailContribution
  | IslandAlertContribution
  | IslandNoticeContribution
  | IslandPreviewContribution
  | IslandSummaryContribution
  | IslandRevealContribution
  | IslandHoldContribution
  | IslandSideContribution
  | IslandStatusContribution
  | IslandPopupContribution
  | IslandStyleContribution
  | IslandBusyContribution
  | IslandHintContribution
  | IslandPageContribution
  | IslandBadgeContribution;

export type IslandContributed = {
  lines: readonly IslandLineContribution[];
  trails: readonly string[];
  alerts: ReadonlySet<string>;
  notices: ReadonlyMap<string, IslandNoticeContribution>;
  preview: IslandPreviewContribution | null;
  summary: string | null;
  reveal: { always: boolean; allowed: boolean; pauseIdle: boolean; pauseHover: boolean };
  hold: boolean;
  side: ReadonlyMap<string, IslandSideContribution>;
  status: IslandStatusContribution | null;
  popups: ReadonlyMap<string, IslandPopupContribution>;
  style: { vars: Readonly<Record<string, string>>; classNames: readonly string[]; tint: string | null };
  busy: boolean;
  hints: ReadonlySet<string>;
  pages: Readonly<Record<string, boolean>>;
  badges: ReadonlyMap<string, IslandBadgeContribution>;
  settled: boolean;
};

export const ISLAND_SIDE_ROW_HEIGHT = 28;
export const ISLAND_SIDE_COVER_HEIGHT = 40;

export const LINE_PRIORITY = {
  peek: 70,
  screenshotPeek: 69,
  meeting: 60,
  agentInterjection: 50,
  lyricsFirst: 45,
  agentTitle: 40,
  lyrics: 35,
  todoTitle: 20,
  todoCount: 10,
} as const;

type Entry = { owner: string; id: string; seq: number; list: readonly IslandContribution[]; key: string };

export interface IslandContributionStore {
  set(owner: string, id: string, list: readonly IslandContribution[]): void;
  remove(owner: string, id: string): void;
  setDisabledOwners(owners: Iterable<string>): void;
  settle(): void;
  subscribe(listener: () => void): () => void;
  snapshot(): IslandContributed;
  byOwner(): Readonly<Record<string, readonly IslandContribution[]>>;
}

export function aggregateContributions(lists: readonly (readonly IslandContribution[])[], settled: boolean): IslandContributed {
  const lines: IslandLineContribution[] = [];
  const trails: string[] = [];
  const alerts = new Set<string>();
  const hints = new Set<string>();
  const notices = new Map<string, IslandNoticeContribution>();
  const side = new Map<string, IslandSideContribution>();
  const popups = new Map<string, IslandPopupContribution>();
  const badges = new Map<string, IslandBadgeContribution>();
  const pages: Record<string, boolean> = {};
  const vars: Record<string, string> = {};
  const classNames: string[] = [];
  const reveal = { always: false, allowed: false, pauseIdle: false, pauseHover: false };
  let preview: IslandPreviewContribution | null = null;
  let summary: string | null = null;
  let status: IslandStatusContribution | null = null;
  let tint: string | null = null;
  let hold = false;
  let busy = false;
  for (const list of lists) {
    for (const item of list) {
      switch (item.kind) {
        case "line": lines.push(item); break;
        case "trail": trails.push(item.item); break;
        case "alert": alerts.add(item.item); break;
        case "notice": notices.set(item.item, item); break;
        case "preview": preview ??= item; break;
        case "summary": summary ??= item.item; break;
        case "reveal":
          if (item.reveal === "always") reveal.always = true;
          if (item.reveal === "allowed") reveal.allowed = true;
          if (item.pauseIdle) reveal.pauseIdle = true;
          if (item.pauseHover) reveal.pauseHover = true;
          break;
        case "hold": hold = true; break;
        case "side": side.set(item.item, item); break;
        case "status": status ??= item; break;
        case "popup": popups.set(item.page, item); break;
        case "style":
          Object.assign(vars, item.vars);
          if (item.className) classNames.push(item.className);
          if (item.tint) tint ??= item.tint;
          break;
        case "busy": busy = true; break;
        case "hint": hints.add(item.key); break;
        case "page": pages[item.page] = item.enabled; break;
        case "badge": if (!badges.has(item.target)) badges.set(item.target, item); break;
      }
    }
  }
  lines.sort((a, b) => b.priority - a.priority);
  return { lines, trails, alerts, notices, preview, summary, reveal, hold, side, status, popups, style: { vars, classNames, tint }, busy, hints, pages, badges, settled };
}

export function topLine(lines: readonly IslandLineContribution[]): IslandLineContribution | null {
  return lines[0] ?? null;
}

export function lineBelow(lines: readonly IslandLineContribution[], priority: number): IslandLineContribution | null {
  return lines.find((line) => line.priority < priority) ?? null;
}

export function visibleLines(lines: readonly IslandLineContribution[], barText: boolean): readonly IslandLineContribution[] {
  return barText ? lines : lines.filter((line) => line.always === true);
}

export function shownLine(lines: readonly IslandLineContribution[]): IslandLineContribution | null {
  return lines.find((line) => line.reserve !== true) ?? null;
}

export function measuredLine(lines: readonly IslandLineContribution[]): IslandLineContribution | null {
  return lines.find((line) => line.measure !== undefined) ?? null;
}

export function labelLine(lines: readonly IslandLineContribution[]): IslandLineContribution | null {
  return lines.find((line) => line.label !== undefined && line.drop !== true) ?? null;
}

export function leadLine(lines: readonly IslandLineContribution[], { reserved = false }: { reserved?: boolean } = {}): IslandLineContribution | null {
  return lines.find((line) => line.lead === true && (reserved || line.reserve !== true)) ?? null;
}

export function createIslandContributions(): IslandContributionStore {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let off = new Set<string>();
  let seq = 0;
  let settled = false;
  let cached: IslandContributed | null = null;

  const live = () => [...entries.values()].filter((entry) => !off.has(entry.owner)).sort((a, b) => a.seq - b.seq);
  const changed = () => {
    cached = null;
    for (const listener of listeners) listener();
  };

  return {
    set(owner, id, list) {
      const at = `${owner}\n${id}`;
      const key = JSON.stringify(list);
      const before = entries.get(at);
      if (before?.key === key) return;
      entries.set(at, { owner, id, seq: before?.seq ?? ++seq, list, key });
      changed();
    },
    remove(owner, id) {
      if (entries.delete(`${owner}\n${id}`)) changed();
    },
    setDisabledOwners(owners) {
      const next = new Set(owners);
      if (next.size === off.size && [...next].every((owner) => off.has(owner))) return;
      off = next;
      changed();
    },
    settle() {
      if (settled) return;
      settled = true;
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      cached ??= aggregateContributions(live().map((entry) => entry.list), settled);
      return cached;
    },
    byOwner() {
      const out: Record<string, IslandContribution[]> = {};
      for (const entry of entries.values()) (out[entry.owner] ??= []).push(...entry.list);
      return out;
    },
  };
}
