import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppVersion } from "../../features/updater/api";
import { loadDevBuild, type PlatformFeature } from "../../lib/platform";
import { islandRanBefore } from "../../lib/settings/installState";
import {
  activeSinceVersions,
  activeWhatsNewPages,
  dismissAllWhatsNew,
  isNextItemSeen,
  markWhatsNewPageVisited,
  NEXT_SINCE,
  reconcileWhatsNewState,
  replayWhatsNew,
  unreadWhatsNewPages,
  type SettingsWhatsNewState,
  type WhatsNewItem,
} from "../../lib/settings/whatsNew";
import { readWhatsNewState, writeWhatsNewState } from "../../lib/settings/whatsNewStorage";
import type { SettingsRowIdentity, SettingsWhatsNewContextValue } from "../../components/settings/whatsNewContext";
import { isCategoryAvailable, type SettingsCategory } from "./categories";
import whatsNewIndex from "./whatsNewIndex.json";

type LocalizedLabel = { group: string; title: string };

export type WhatsNewIndexEntry = {
  page: SettingsCategory;
  since: string;
  "zh-CN": LocalizedLabel;
  en: LocalizedLabel;
};

export type SettingsWhatsNewView = {
  unreadPages: ReadonlySet<SettingsCategory>;
  unreadCount: number;
  searchSince: ReadonlySet<string>;
  searchPages: ReadonlySet<string>;
  onDismissAll: () => void;
  onReplay?: () => void;
};

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_PAGES: ReadonlySet<SettingsCategory> = new Set();

function cleanLabel(value?: string) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function entryKey(entry: WhatsNewIndexEntry) {
  return `${entry.page}\u0000${cleanLabel(entry["zh-CN"].group)}\u0000${cleanLabel(entry["zh-CN"].title)}`;
}

const RAW_ENTRIES = whatsNewIndex.entries as readonly WhatsNewIndexEntry[];
const ENTRIES: readonly (WhatsNewItem & { page: SettingsCategory; key: string })[] = RAW_ENTRIES.map((entry) => ({
  page: entry.page,
  since: entry.since,
  key: entryKey(entry),
}));

const ROW_MATCH_EXACT = new Map<string, { since: string; key: string }>();
const ROW_MATCH_TITLE = new Map<string, { since: string; key: string }>();

for (const entry of RAW_ENTRIES) {
  const info = { since: entry.since, key: entryKey(entry) };
  for (const text of [entry["zh-CN"], entry.en]) {
    const title = cleanLabel(text?.title);
    if (!title) continue;
    const group = cleanLabel(text?.group);
    ROW_MATCH_EXACT.set(`${entry.page}\u0000${group}\u0000${title}`, info);
    if (!ROW_MATCH_TITLE.has(`${entry.page}\u0000${title}`)) {
      ROW_MATCH_TITLE.set(`${entry.page}\u0000${title}`, info);
    }
  }
}

function lookupRow(page: SettingsCategory, row?: SettingsRowIdentity) {
  const title = cleanLabel(row?.title);
  if (!title) return null;
  const group = cleanLabel(row?.group);
  return ROW_MATCH_EXACT.get(`${page}\u0000${group}\u0000${title}`) ?? ROW_MATCH_TITLE.get(`${page}\u0000${title}`) ?? null;
}

export function useSettingsWhatsNew(
  currentPage: SettingsCategory | null,
  hidden: ReadonlySet<SettingsCategory>,
  unsupported: ReadonlySet<PlatformFeature>,
  mac: boolean,
): {
  context: SettingsWhatsNewContextValue;
  view: SettingsWhatsNewView;
  resetSession: () => void;
} {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [devBuild, setDevBuild] = useState(false);
  const [state, setState] = useState<SettingsWhatsNewState | null>(null);
  const [sessionPages, setSessionPages] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [sessionSince, setSessionSince] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [sessionKeys, setSessionKeys] = useState<ReadonlySet<string>>(EMPTY_SET);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAppVersion(), loadDevBuild()])
      .then(([version, isDev]) => {
        if (cancelled) return;
        setAppVersion(version);
        setDevBuild(isDev);
        const reconciled = reconcileWhatsNewState(readWhatsNewState(), version, islandRanBefore());
        if (!reconciled) {
          setState(null);
          return;
        }
        const semverActive = activeSinceVersions(ENTRIES, reconciled.state.seenVersion, version, { includeNext: false });
        const availableSemverPages = activeWhatsNewPages(
          ENTRIES,
          semverActive,
          (page) => isCategoryAvailable(page as SettingsCategory, unsupported, mac),
        );
        if (semverActive.size === 0 || availableSemverPages.size === 0) {
          const settled = dismissAllWhatsNew(version, reconciled.state.seenNextPages, reconciled.state.seenNextKeys);
          if (reconciled.changed || settled.seenVersion !== reconciled.state.seenVersion || reconciled.state.visitedPages.length > 0) {
            writeWhatsNewState(settled);
          }
          setState(settled);
          return;
        }
        if (reconciled.changed) writeWhatsNewState(reconciled.state);
        setState(reconciled.state);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mac, unsupported]);

  const activeSince = useMemo(
    () => (state && appVersion ? activeSinceVersions(ENTRIES, state.seenVersion, appVersion, { includeNext: devBuild }) : EMPTY_SET),
    [appVersion, devBuild, state],
  );

  const semverActiveSince = useMemo(() => {
    if (!activeSince.has(NEXT_SINCE)) return activeSince;
    const next = new Set(activeSince);
    next.delete(NEXT_SINCE);
    return next;
  }, [activeSince]);

  const isVisible = useCallback(
    (page: string) => isCategoryAvailable(page as SettingsCategory, unsupported, mac) && !hidden.has(page as SettingsCategory),
    [hidden, mac, unsupported],
  );

  const visibleActivePages = useMemo(
    () => activeWhatsNewPages(ENTRIES, activeSince, isVisible),
    [activeSince, isVisible],
  );

  const visibleSemverPages = useMemo(
    () => activeWhatsNewPages(ENTRIES, semverActiveSince, isVisible),
    [isVisible, semverActiveSince],
  );

  const unreadPages = useMemo(
    () => (state
      ? (unreadWhatsNewPages(ENTRIES, activeSince, state.visitedPages, isVisible, state.seenNextPages, state.seenNextKeys) as ReadonlySet<SettingsCategory>)
      : EMPTY_PAGES),
    [activeSince, isVisible, state],
  );

  const unreadCount = useMemo(() => {
    if (unreadPages.size === 0 || !state) return 0;
    const visited = new Set(state.visitedPages);
    const seenNextPages = new Set(state.seenNextPages ?? []);
    const seenNextKeys = new Set(state.seenNextKeys ?? []);
    let count = 0;
    for (const entry of ENTRIES) {
      if (!activeSince.has(entry.since) || !unreadPages.has(entry.page)) continue;
      if (entry.since === NEXT_SINCE ? !isNextItemSeen(entry, seenNextPages, seenNextKeys) : !visited.has(entry.page)) count += 1;
    }
    return count;
  }, [activeSince, state, unreadPages]);

  useEffect(() => {
    if (!state || !appVersion || !currentPage || !unreadPages.has(currentPage)) return;
    const pageSince = new Set<string>();
    const nextKeysOnPage: string[] = [];
    const seenNextPages = new Set(state.seenNextPages ?? []);
    const seenNextKeys = new Set(state.seenNextKeys ?? []);
    for (const entry of ENTRIES) {
      if (entry.page !== currentPage || !activeSince.has(entry.since)) continue;
      if (entry.since === NEXT_SINCE) {
        if (!isNextItemSeen(entry, seenNextPages, seenNextKeys)) {
          pageSince.add(NEXT_SINCE);
          nextKeysOnPage.push(entry.key);
        }
      } else if (!state.visitedPages.includes(currentPage)) {
        pageSince.add(entry.since);
      }
    }
    if (pageSince.size === 0) return;
    setSessionPages((prev) => (prev.has(currentPage) ? prev : new Set([...prev, currentPage])));
    setSessionSince((prev) => ([...pageSince].every((version) => prev.has(version)) ? prev : new Set([...prev, ...pageSince])));
    if (nextKeysOnPage.length > 0) {
      setSessionKeys((prev) => (nextKeysOnPage.every((key) => prev.has(key)) ? prev : new Set([...prev, ...nextKeysOnPage])));
    }
    const next = markWhatsNewPageVisited(state, currentPage, visibleActivePages, appVersion, {
      hasNextOnPage: nextKeysOnPage.length > 0,
      nextKeysOnPage,
      visibleSemverPages,
    });
    if (next !== state) {
      writeWhatsNewState(next);
      setState(next);
    }
  }, [activeSince, appVersion, currentPage, state, unreadPages, visibleActivePages, visibleSemverPages]);

  const dismissAll = useCallback(() => {
    if (!appVersion) return;
    const visibleNextKeys = devBuild
      ? [...new Set([...(state?.seenNextKeys ?? []), ...ENTRIES.filter((entry) => entry.since === NEXT_SINCE && isVisible(entry.page)).map((entry) => entry.key)])]
      : (state?.seenNextKeys ?? []);
    const visibleNextPages = devBuild
      ? [...new Set([...(state?.seenNextPages ?? []), ...ENTRIES.filter((entry) => entry.since === NEXT_SINCE && isVisible(entry.page)).map((entry) => entry.page)])]
      : (state?.seenNextPages ?? []);
    const next = dismissAllWhatsNew(appVersion, visibleNextPages, visibleNextKeys);
    writeWhatsNewState(next);
    setState(next);
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
    setSessionKeys(EMPTY_SET);
  }, [appVersion, devBuild, isVisible, state?.seenNextKeys, state?.seenNextPages]);

  const replay = useCallback(() => {
    if (!appVersion) return;
    const next = replayWhatsNew();
    writeWhatsNewState(next);
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
    setSessionKeys(EMPTY_SET);
    setState(next);
  }, [appVersion]);

  const resetSession = useCallback(() => {
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
    setSessionKeys(EMPTY_SET);
  }, []);

  const searchSince = useMemo(() => {
    if (unreadPages.size === 0) return sessionSince;
    if (sessionSince.size === 0) return activeSince;
    return new Set([...activeSince, ...sessionSince]);
  }, [activeSince, sessionSince, unreadPages.size]);

  const searchPages = useMemo(() => {
    if (unreadPages.size === 0) return sessionPages;
    if (sessionPages.size === 0) return unreadPages as ReadonlySet<string>;
    return new Set([...unreadPages, ...sessionPages]);
  }, [sessionPages, unreadPages]);

  const isNew = useCallback(
    (explicitSince?: string, row?: SettingsRowIdentity) => {
      if (explicitSince === "off" || !currentPage) return false;
      const matched = lookupRow(currentPage, row);
      const since = explicitSince || matched?.since;
      if (!since) return false;
      if (since === NEXT_SINCE) {
        const key = matched?.key;
        if (key && sessionKeys.has(key)) return true;
        if (unreadPages.has(currentPage) && activeSince.has(NEXT_SINCE)) {
          const seenPages = new Set(state?.seenNextPages ?? []);
          const seenKeys = new Set(state?.seenNextKeys ?? []);
          return !isNextItemSeen({ page: currentPage, since: NEXT_SINCE, key }, seenPages, seenKeys);
        }
        return !key && sessionPages.has(currentPage) && sessionSince.has(NEXT_SINCE);
      }
      if (unreadPages.has(currentPage) && activeSince.has(since)) {
        return !state?.visitedPages.includes(currentPage);
      }
      return sessionPages.has(currentPage) && sessionSince.has(since);
    },
    [activeSince, currentPage, sessionKeys, sessionPages, sessionSince, state?.seenNextKeys, state?.seenNextPages, state?.visitedPages, unreadPages],
  );

  const context = useMemo<SettingsWhatsNewContextValue>(() => ({ isNew }), [isNew]);

  const view = useMemo<SettingsWhatsNewView>(
    () => ({
      unreadPages,
      unreadCount,
      searchSince,
      searchPages,
      onDismissAll: dismissAll,
      ...(devBuild && ENTRIES.length > 0 ? { onReplay: replay } : {}),
    }),
    [devBuild, dismissAll, replay, searchPages, searchSince, unreadCount, unreadPages],
  );

  return { context, view, resetSession };
}
