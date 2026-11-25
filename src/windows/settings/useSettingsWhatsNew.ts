import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppVersion } from "../../features/updater/api";
import { loadDevBuild, type PlatformFeature } from "../../lib/platform";
import { islandRanBefore } from "../../lib/settings/installState";
import {
  activeSinceVersions,
  activeWhatsNewPages,
  dismissAllWhatsNew,
  markWhatsNewPageVisited,
  NEXT_SINCE,
  reconcileWhatsNewState,
  replayWhatsNew,
  unreadWhatsNewPages,
  type SettingsWhatsNewState,
} from "../../lib/settings/whatsNew";
import { readWhatsNewState, writeWhatsNewState } from "../../lib/settings/whatsNewStorage";
import type { SettingsWhatsNewContextValue } from "../../components/settings/whatsNewContext";
import { isCategoryAvailable, type SettingsCategory } from "./categories";
import whatsNewIndex from "./whatsNewIndex.json";

export type WhatsNewIndexEntry = {
  page: SettingsCategory;
  since: string;
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
const ENTRIES = whatsNewIndex.entries as readonly WhatsNewIndexEntry[];

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
          const settled = dismissAllWhatsNew(version, reconciled.state.seenNextPages);
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
      ? (unreadWhatsNewPages(ENTRIES, activeSince, state.visitedPages, isVisible, state.seenNextPages) as ReadonlySet<SettingsCategory>)
      : EMPTY_PAGES),
    [activeSince, isVisible, state],
  );

  const unreadCount = useMemo(() => {
    if (unreadPages.size === 0 || !state) return 0;
    const visited = new Set(state.visitedPages);
    const seenNext = new Set(state.seenNextPages ?? []);
    let count = 0;
    for (const entry of ENTRIES) {
      if (!activeSince.has(entry.since) || !unreadPages.has(entry.page)) continue;
      if (entry.since === NEXT_SINCE ? !seenNext.has(entry.page) : !visited.has(entry.page)) count += 1;
    }
    return count;
  }, [activeSince, state, unreadPages]);

  useEffect(() => {
    if (!state || !appVersion || !currentPage || !unreadPages.has(currentPage)) return;
    const pageSince = new Set<string>();
    let hasNextOnPage = false;
    for (const entry of ENTRIES) {
      if (entry.page !== currentPage || !activeSince.has(entry.since)) continue;
      if (entry.since === NEXT_SINCE) {
        if (!state.seenNextPages?.includes(currentPage)) {
          pageSince.add(NEXT_SINCE);
          hasNextOnPage = true;
        }
      } else if (!state.visitedPages.includes(currentPage)) {
        pageSince.add(entry.since);
      }
    }
    if (pageSince.size === 0) return;
    setSessionPages((prev) => {
      if (prev.has(currentPage)) return prev;
      const next = new Set(prev);
      next.add(currentPage);
      return next;
    });
    setSessionSince((prev) => {
      if ([...pageSince].every((version) => prev.has(version))) return prev;
      return new Set([...prev, ...pageSince]);
    });
    const next = markWhatsNewPageVisited(state, currentPage, visibleActivePages, appVersion, { hasNextOnPage, visibleSemverPages });
    if (next !== state) {
      writeWhatsNewState(next);
      setState(next);
    }
  }, [activeSince, appVersion, currentPage, state, unreadPages, visibleActivePages, visibleSemverPages]);

  const dismissAll = useCallback(() => {
    if (!appVersion) return;
    const visibleNextPages = devBuild
      ? [...new Set([...(state?.seenNextPages ?? []), ...ENTRIES.filter((entry) => entry.since === NEXT_SINCE && isVisible(entry.page)).map((entry) => entry.page)])]
      : (state?.seenNextPages ?? []);
    const next = dismissAllWhatsNew(appVersion, visibleNextPages);
    writeWhatsNewState(next);
    setState(next);
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
  }, [appVersion, devBuild, isVisible, state?.seenNextPages]);

  const replay = useCallback(() => {
    if (!appVersion) return;
    const next = replayWhatsNew();
    writeWhatsNewState(next);
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
    setState(next);
  }, [appVersion]);

  const resetSession = useCallback(() => {
    setSessionPages(EMPTY_SET);
    setSessionSince(EMPTY_SET);
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
    (since?: string) => {
      if (!since || !currentPage) return false;
      if (unreadPages.has(currentPage) && activeSince.has(since)) {
        if (since === NEXT_SINCE) return !state?.seenNextPages?.includes(currentPage);
        return !state?.visitedPages.includes(currentPage);
      }
      return sessionPages.has(currentPage) && sessionSince.has(since);
    },
    [activeSince, currentPage, sessionPages, sessionSince, state?.seenNextPages, state?.visitedPages, unreadPages],
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
