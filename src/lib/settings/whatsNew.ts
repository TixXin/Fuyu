export const NEXT_SINCE = "next";

export const MAX_WHATS_NEW_BASES = 2;

export type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
  beta: number | null;
};

export type WhatsNewItem = {
  page: string;
  since: string;
  key?: string;
};

export type SettingsWhatsNewState = {
  seenVersion: string;
  visitedPages: string[];
  seenNextPages?: string[];
  seenNextKeys?: string[];
};

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

export function parseSemver(version: string): ParsedSemver | null {
  const match = version.trim().match(SEMVER);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: match[4] === undefined ? null : Number(match[4]),
  };
}

export function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  const core = a.major - b.major || a.minor - b.minor || a.patch - b.patch;
  if (core !== 0) return core;
  if (a.beta === b.beta) return 0;
  if (a.beta === null) return 1;
  if (b.beta === null) return -1;
  return a.beta - b.beta;
}

export function baseSemver(version: ParsedSemver): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function withSeenNext(
  base: SettingsWhatsNewState,
  seenNextPages?: readonly string[],
  seenNextKeys?: readonly string[],
): SettingsWhatsNewState {
  const pages = seenNextPages ? [...new Set(seenNextPages.filter((page) => page.length > 0))] : [];
  const keys = seenNextKeys ? [...new Set(seenNextKeys.filter((key) => key.length > 0))] : [];
  return {
    seenVersion: base.seenVersion,
    visitedPages: base.visitedPages,
    ...(pages.length > 0 ? { seenNextPages: pages } : {}),
    ...(keys.length > 0 ? { seenNextKeys: keys } : {}),
  };
}

export function normalizeWhatsNewState(raw: unknown): SettingsWhatsNewState | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { seenVersion?: unknown; visitedPages?: unknown; seenNextPages?: unknown; seenNextKeys?: unknown };
  if (typeof record.seenVersion !== "string" || !parseSemver(record.seenVersion)) return null;
  const visitedPages = cleanStrings(record.visitedPages);
  const seenNextPages = cleanStrings(record.seenNextPages);
  const seenNextKeys = cleanStrings(record.seenNextKeys);
  return withSeenNext({ seenVersion: record.seenVersion.replace(/^v/, ""), visitedPages }, seenNextPages, seenNextKeys);
}

export function reconcileWhatsNewState(
  stored: SettingsWhatsNewState | null,
  currentVersion: string,
  ranBefore: boolean,
): { state: SettingsWhatsNewState; changed: boolean } | null {
  const current = parseSemver(currentVersion);
  if (!current) return null;
  const cleanCurrent = currentVersion.trim().replace(/^v/, "");
  if (!stored) {
    return {
      state: { seenVersion: ranBefore ? "0.0.0" : cleanCurrent, visitedPages: [] },
      changed: true,
    };
  }
  const seen = parseSemver(stored.seenVersion);
  if (!seen || compareSemver(seen, current) > 0) {
    return { state: { seenVersion: cleanCurrent, visitedPages: [] }, changed: true };
  }
  if (compareSemver(seen, current) === 0) {
    if (stored.visitedPages.length > 0 || stored.seenVersion !== cleanCurrent) {
      return {
        state: withSeenNext({ seenVersion: cleanCurrent, visitedPages: [] }, stored.seenNextPages, stored.seenNextKeys),
        changed: true,
      };
    }
    return { state: stored, changed: false };
  }
  if ((stored.seenNextPages && stored.seenNextPages.length > 0) || (stored.seenNextKeys && stored.seenNextKeys.length > 0)) {
    return {
      state: { seenVersion: stored.seenVersion, visitedPages: stored.visitedPages },
      changed: true,
    };
  }
  return { state: stored, changed: false };
}

export function activeSinceVersions(
  items: readonly WhatsNewItem[],
  seenVersion: string,
  currentVersion: string,
  options?: number | { maxBases?: number; includeNext?: boolean },
): ReadonlySet<string> {
  const maxBases = typeof options === "number" ? options : (options?.maxBases ?? MAX_WHATS_NEW_BASES);
  const includeNext = typeof options === "object" && options?.includeNext === true;
  const current = parseSemver(currentVersion);
  const seen = parseSemver(seenVersion);
  if (!current || !seen) return new Set();

  const active = new Set<string>();
  if (includeNext && items.some((item) => item.since === NEXT_SINCE)) {
    active.add(NEXT_SINCE);
  }
  if (compareSemver(seen, current) >= 0) return active;

  const parsedEntries: { since: string; parsed: ParsedSemver }[] = [];
  const seenRaw = new Set<string>();
  for (const item of items) {
    if (seenRaw.has(item.since)) continue;
    seenRaw.add(item.since);
    const parsed = parseSemver(item.since);
    if (!parsed || compareSemver(parsed, current) > 0) continue;
    parsedEntries.push({ since: item.since, parsed });
  }

  parsedEntries.sort((a, b) => compareSemver(b.parsed, a.parsed));
  const recentBases = new Set<string>();
  for (const entry of parsedEntries) {
    const base = baseSemver(entry.parsed);
    if (recentBases.size < maxBases) recentBases.add(base);
  }

  for (const entry of parsedEntries) {
    if (recentBases.has(baseSemver(entry.parsed)) && compareSemver(entry.parsed, seen) > 0) {
      active.add(entry.since);
    }
  }
  return active;
}

export function activeWhatsNewPages(
  items: readonly WhatsNewItem[],
  activeSince: ReadonlySet<string>,
  isPageVisible: (page: string) => boolean,
): ReadonlySet<string> {
  if (activeSince.size === 0) return new Set();
  const pages = new Set<string>();
  for (const item of items) {
    if (activeSince.has(item.since) && isPageVisible(item.page)) {
      pages.add(item.page);
    }
  }
  return pages;
}

export function isNextItemSeen(
  item: WhatsNewItem,
  seenNextPages: ReadonlySet<string>,
  seenNextKeys: ReadonlySet<string>,
): boolean {
  if (item.key) {
    if (seenNextKeys.has(item.key)) return true;
    if (seenNextKeys.size === 0 && seenNextPages.has(item.page)) return true;
    return false;
  }
  return seenNextPages.has(item.page);
}

export function unreadWhatsNewPages(
  items: readonly WhatsNewItem[],
  activeSince: ReadonlySet<string>,
  visitedPages: readonly string[],
  isPageVisible: (page: string) => boolean,
  seenNextPages: readonly string[] = [],
  seenNextKeys: readonly string[] = [],
): ReadonlySet<string> {
  if (activeSince.size === 0) return new Set();
  const visited = new Set(visitedPages);
  const nextPages = new Set(seenNextPages);
  const nextKeys = new Set(seenNextKeys);
  const unread = new Set<string>();
  for (const item of items) {
    if (!activeSince.has(item.since) || !isPageVisible(item.page)) continue;
    if (item.since === NEXT_SINCE) {
      if (!isNextItemSeen(item, nextPages, nextKeys)) unread.add(item.page);
    } else if (!visited.has(item.page)) {
      unread.add(item.page);
    }
  }
  return unread;
}

export function markWhatsNewPageVisited(
  state: SettingsWhatsNewState,
  page: string,
  visibleActivePages: ReadonlySet<string>,
  currentVersion: string,
  options?: { hasNextOnPage?: boolean; nextKeysOnPage?: readonly string[]; visibleSemverPages?: ReadonlySet<string> },
): SettingsWhatsNewState {
  if (!visibleActivePages.has(page)) return state;
  const cleanCurrent = currentVersion.trim().replace(/^v/, "");
  const semverPages = options?.visibleSemverPages ?? visibleActivePages;
  const hasSemverOnPage = semverPages.has(page);
  const hasNextOnPage = options?.hasNextOnPage === true;
  const keysOnPage = options?.nextKeysOnPage ?? [];

  let nextSeenVersion = state.seenVersion;
  let nextVisited = state.visitedPages;
  if (hasSemverOnPage) {
    const updated = state.visitedPages.includes(page) ? state.visitedPages : [...state.visitedPages, page];
    const visitedSet = new Set(updated);
    const allSemverVisited = [...semverPages].every((activePage) => visitedSet.has(activePage));
    if (allSemverVisited) {
      nextSeenVersion = cleanCurrent;
      nextVisited = [];
    } else {
      nextVisited = updated;
    }
  }

  let nextSeenNextPages = state.seenNextPages;
  if (hasNextOnPage && keysOnPage.length === 0) {
    const existing = state.seenNextPages ?? [];
    if (!existing.includes(page)) nextSeenNextPages = [...existing, page];
  }

  let nextSeenNextKeys = state.seenNextKeys;
  if (keysOnPage.length > 0) {
    const existing = new Set(state.seenNextKeys ?? []);
    const missing = keysOnPage.filter((key) => key.length > 0 && !existing.has(key));
    if (missing.length > 0) nextSeenNextKeys = [...existing, ...missing];
  }

  if (
    nextSeenVersion === state.seenVersion
    && nextVisited === state.visitedPages
    && nextSeenNextPages === state.seenNextPages
    && nextSeenNextKeys === state.seenNextKeys
  ) {
    return state;
  }
  return withSeenNext({ seenVersion: nextSeenVersion, visitedPages: nextVisited }, nextSeenNextPages, nextSeenNextKeys);
}

export function dismissAllWhatsNew(
  currentVersion: string,
  nextPages: readonly string[] = [],
  nextKeys: readonly string[] = [],
): SettingsWhatsNewState {
  return withSeenNext({ seenVersion: currentVersion.trim().replace(/^v/, ""), visitedPages: [] }, nextPages, nextKeys);
}

export function replayWhatsNew(): SettingsWhatsNewState {
  return { seenVersion: "0.0.0", visitedPages: [] };
}
