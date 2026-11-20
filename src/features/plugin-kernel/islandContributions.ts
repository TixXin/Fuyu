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
export type IslandSummaryGrow = { width: number; height: number };
export type IslandSummaryContribution = { kind: "summary"; item: string; grow?: IslandSummaryGrow };
export type IslandRevealContribution = { kind: "reveal"; reveal?: "always" | "allowed"; pauseIdle?: boolean; pauseHover?: boolean };
export type IslandHoldContribution = { kind: "hold"; reason: string };
export type IslandSideContribution = { kind: "side"; item: string; height: number; grow?: boolean };
export type IslandStatusContribution = { kind: "status"; state: string; label: string };
export type IslandPopupContribution = { kind: "popup"; page: string; height?: number; saving?: number; open?: boolean; wide?: boolean; label?: string; icon?: "music" | "bell"; iconUrl?: string };
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
  summaryGrow: IslandSummaryGrow | null;
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

function sameRecord<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]));
}

function sameArray<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean = Object.is): boolean {
  return a.length === b.length && a.every((item, index) => eq(item, b[index]));
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function sameMap<K, V extends Record<string, unknown>>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    const other = b.get(key);
    if (!other || !sameRecord(value, other)) return false;
  }
  return true;
}

export function aggregateContributions(
  lists: readonly (readonly IslandContribution[])[],
  settled: boolean,
  prev: IslandContributed | null = null,
): IslandContributed {
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
  let summaryGrow: IslandSummaryGrow | null = null;
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
        case "summary":
          if (summary === null) {
            summary = item.item;
            summaryGrow = item.grow ?? null;
          }
          break;
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
  if (!prev) {
    return { lines, trails, alerts, notices, preview, summary, summaryGrow, reveal, hold, side, status, popups, style: { vars, classNames, tint }, busy, hints, pages, badges, settled };
  }
  const nextLines = sameArray(lines, prev.lines, sameRecord) ? prev.lines : lines;
  const nextTrails = sameArray(trails, prev.trails) ? prev.trails : trails;
  const nextAlerts = sameSet(alerts, prev.alerts) ? prev.alerts : alerts;
  const nextHints = sameSet(hints, prev.hints) ? prev.hints : hints;
  const nextNotices = sameMap(notices, prev.notices) ? prev.notices : notices;
  const nextSide = sameMap(side, prev.side) ? prev.side : side;
  const nextPopups = sameMap(popups, prev.popups) ? prev.popups : popups;
  const nextBadges = sameMap(badges, prev.badges) ? prev.badges : badges;
  const nextPages = sameRecord(pages, prev.pages) ? prev.pages : pages;
  const nextReveal = sameRecord(reveal, prev.reveal) ? prev.reveal : reveal;
  const nextPreview = preview && prev.preview && sameRecord(preview, prev.preview) ? prev.preview : preview;
  const nextSummaryGrow = summaryGrow && prev.summaryGrow && sameRecord(summaryGrow, prev.summaryGrow) ? prev.summaryGrow : summaryGrow;
  const nextStatus = status && prev.status && sameRecord(status, prev.status) ? prev.status : status;
  const nextVars = sameRecord(vars, prev.style.vars) ? prev.style.vars : vars;
  const nextClassNames = sameArray(classNames, prev.style.classNames) ? prev.style.classNames : classNames;
  const nextStyle = nextVars === prev.style.vars && nextClassNames === prev.style.classNames && tint === prev.style.tint
    ? prev.style
    : { vars: nextVars, classNames: nextClassNames, tint };
  const next: IslandContributed = {
    lines: nextLines,
    trails: nextTrails,
    alerts: nextAlerts,
    notices: nextNotices,
    preview: nextPreview,
    summary,
    summaryGrow: nextSummaryGrow,
    reveal: nextReveal,
    hold,
    side: nextSide,
    status: nextStatus,
    popups: nextPopups,
    style: nextStyle,
    busy,
    hints: nextHints,
    pages: nextPages,
    badges: nextBadges,
    settled,
  };
  return sameRecord(next, prev) ? prev : next;
}

export function selectContributed<T = IslandContributed>(
  state: IslandContributed,
  prev: { state: IslandContributed; value: T } | null,
  selector?: (state: IslandContributed) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): { state: IslandContributed; value: T } {
  if (!selector) {
    const value = state as unknown as T;
    return prev && prev.state === state ? prev : { state, value };
  }
  const next = selector(state);
  if (prev && isEqual(prev.value, next)) {
    return prev.state === state ? prev : { state, value: prev.value };
  }
  return { state, value: next };
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
  let last: IslandContributed | null = null;
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
      if (!cached) {
        cached = aggregateContributions(live().map((entry) => entry.list), settled, last);
        last = cached;
      }
      return cached;
    },
    byOwner() {
      const out: Record<string, IslandContribution[]> = {};
      for (const entry of entries.values()) (out[entry.owner] ??= []).push(...entry.list);
      return out;
    },
  };
}
