import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useErrorText, useTranslation } from "../../../i18n";
import { useBuiltinConfig } from "../../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "../plugin/owner.ts";
import { setImAutoClearEnabled, setSourceEnabled } from "../plugin/useSourceSwitches";
import type { QQPreviewTiming } from "../qqNotificationTiming";
import { hasRequestedQQNotificationAccess, markQQNotificationAccessRequested } from "../qq-notifications/storage";
import {
  clearImSourceNotifications,
  getImSourcesState,
  listenImSourcesChanged,
  openImNotificationSettings,
  openImSource,
  requestImNotificationAccess,
  setImSourceAutoClear,
} from "./api";
import {
  createEmptyImSnapshots,
  createInitialImRevisions,
  IM_SOURCE_IDS,
  isImAutoClearEnabled,
  isImSource,
  nextImPreviewState,
  type ImNotificationItem,
  type ImPreviewWindow,
  type ImSourceId,
  type ImSourceSnapshot,
} from "./imSourcesState";

export type ImActivePreview = {
  source: ImSourceId;
  item: ImNotificationItem;
  receivedAt: number;
  replacedId: string | null;
};

function useImAutoClearMap() {
  const config = useBuiltinConfig(OWNER);
  const autoClearMap = useMemo(
    () => Object.fromEntries(IM_SOURCE_IDS.map((id) => [id, isImAutoClearEnabled(config, id)])) as Record<ImSourceId, boolean>,
    [config],
  );
  const syncedRef = useRef<Partial<Record<ImSourceId, boolean>>>({});

  useEffect(() => {
    if (!isTauri()) return;
    for (const id of IM_SOURCE_IDS) {
      const desired = autoClearMap[id];
      if (syncedRef.current[id] === desired) continue;
      syncedRef.current[id] = desired;
      void setImSourceAutoClear(id, desired).catch(() => undefined);
    }
  }, [autoClearMap]);

  const setAutoClear = useCallback((source: ImSourceId, enabled: boolean) => {
    syncedRef.current[source] = enabled;
    void setImAutoClearEnabled(source, enabled);
    if (isTauri()) void setImSourceAutoClear(source, enabled).catch(() => undefined);
  }, []);

  return { autoClearMap, setAutoClear };
}

function usePreviewExpiry(
  previewWindows: Partial<Record<ImSourceId, ImPreviewWindow>>,
  setPreviewWindows: React.Dispatch<React.SetStateAction<Partial<Record<ImSourceId, ImPreviewWindow>>>>,
) {
  useEffect(() => {
    const entries = Object.entries(previewWindows) as [ImSourceId, ImPreviewWindow | undefined][];
    const active = entries.filter((entry): entry is [ImSourceId, ImPreviewWindow] => Boolean(entry[1]));
    if (active.length === 0) return;
    const earliest = active.reduce((min, item) => (item[1].expiresAt < min[1].expiresAt ? item : min));
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setPreviewWindows((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, win] of Object.entries(prev) as [ImSourceId, ImPreviewWindow | undefined][]) {
          if (win && win.expiresAt <= now) { delete next[id]; changed = true; }
        }
        return changed ? next : prev;
      });
    }, Math.max(0, earliest[1].expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [previewWindows, setPreviewWindows]);
}

export function useImSources(canPreview: boolean) {
  const t = useTranslation();
  const errorText = useErrorText();
  const errorTextRef = useRef(errorText);
  useLayoutEffect(() => { errorTextRef.current = errorText; }, [errorText]);

  const [snapshots, setSnapshots] = useState(createEmptyImSnapshots);
  const [actionErrors, setActionErrors] = useState<Partial<Record<ImSourceId, string>>>({});
  const [busySource, setBusySource] = useState<ImSourceId | "all" | null>(() => (isTauri() ? "all" : null));
  const [previewWindows, setPreviewWindows] = useState<Partial<Record<ImSourceId, ImPreviewWindow>>>({});

  const canPreviewRef = useRef(canPreview);
  const previewWindowsRef = useRef(previewWindows);
  previewWindowsRef.current = previewWindows;
  const revisionsRef = useRef(createInitialImRevisions());
  const timingsRef = useRef<Partial<Record<ImSourceId, QQPreviewTiming>>>({});
  const pendingRef = useRef(new Set<ImSourceId>());
  const { autoClearMap, setAutoClear } = useImAutoClearMap();

  useLayoutEffect(() => {
    canPreviewRef.current = canPreview;
    if (!canPreview) {
      timingsRef.current = {};
      setPreviewWindows({});
    }
  }, [canPreview]);

  const acceptSnapshot = useCallback((next: ImSourceSnapshot | null | undefined) => {
    if (!next || !isImSource(next.source) || next.revision < revisionsRef.current[next.source]) return false;
    revisionsRef.current[next.source] = next.revision;
    setSnapshots((prev) => (prev[next.source] === next ? prev : { ...prev, [next.source]: next }));
    return true;
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await listenImSourcesChanged(({ payload }) => {
        if (cancelled || !payload || !isImSource(payload.source) || !acceptSnapshot(payload.snapshot)) return;
        const source = payload.source;
        const next = nextImPreviewState(
          previewWindowsRef.current[source] ?? null,
          timingsRef.current[source] ?? null,
          payload,
          canPreviewRef.current,
          Date.now(),
        );
        if (next.timing) timingsRef.current[source] = next.timing;
        else delete timingsRef.current[source];
        setPreviewWindows((prev) => {
          if (!next.previewWindow) {
            if (!(source in prev)) return prev;
            const copy = { ...prev };
            delete copy[source];
            return copy;
          }
          return { ...prev, [source]: next.previewWindow };
        });
      });
      if (cancelled) { unlisten(); return; }
      const initial = await getImSourcesState();
      if (!cancelled && Array.isArray(initial)) for (const item of initial) acceptSnapshot(item);
    })().catch((error: unknown) => {
      if (!cancelled) setActionErrors((prev) => ({ ...prev, telegram: errorTextRef.current(error) }));
    }).finally(() => {
      if (!cancelled) setBusySource((current) => (current === "all" ? null : current));
    });
    return () => { cancelled = true; unlisten?.(); };
  }, [acceptSnapshot]);

  const anyEnabled = IM_SOURCE_IDS.some((id) => snapshots[id].enabled);
  useEffect(() => {
    if (!anyEnabled || !isTauri() || hasRequestedQQNotificationAccess()) return;
    markQQNotificationAccessRequested();
    void requestImNotificationAccess().catch(() => undefined);
  }, [anyEnabled]);

  usePreviewExpiry(previewWindows, setPreviewWindows);

  const dismissPreview = useCallback((source: ImSourceId) => {
    setPreviewWindows((prev) => {
      if (!(source in prev)) return prev;
      const copy = { ...prev };
      delete copy[source];
      return copy;
    });
  }, []);

  const runFor = useCallback(async (source: ImSourceId, action: () => Promise<void>) => {
    if (pendingRef.current.has(source)) return false;
    if (!isTauri()) {
      setActionErrors((prev) => ({ ...prev, [source]: t.messages.im.desktopOnly(t.messages.sourceLabels[source]) }));
      return false;
    }
    pendingRef.current.add(source);
    setBusySource(source);
    setActionErrors((prev) => {
      if (!(source in prev)) return prev;
      const copy = { ...prev };
      delete copy[source];
      return copy;
    });
    try {
      await action();
      return true;
    } catch (error) {
      setActionErrors((prev) => ({ ...prev, [source]: errorText(error) }));
      return false;
    } finally {
      pendingRef.current.delete(source);
      setBusySource((current) => (current === source ? null : current));
    }
  }, [errorText, t]);

  const setEnabled = useCallback((source: ImSourceId, enabled: boolean) => runFor(source, async () => {
    if (enabled) markQQNotificationAccessRequested();
    await setSourceEnabled(source, enabled);
    if (!enabled) { delete timingsRef.current[source]; dismissPreview(source); }
    if (enabled) await requestImNotificationAccess();
    const list = await getImSourcesState(source);
    if (Array.isArray(list)) for (const item of list) acceptSnapshot(item);
  }), [acceptSnapshot, dismissPreview, runFor]);

  const requestAccess = useCallback((source: ImSourceId) => runFor(source, async () => {
    markQQNotificationAccessRequested();
    await requestImNotificationAccess();
  }), [runFor]);

  const openSettings = useCallback((source: ImSourceId) => runFor(source, async () => {
    const status = snapshots[source].status;
    await openImNotificationSettings(status === "permissionDenied" || status === "permissionRequired");
  }), [runFor, snapshots]);

  const refresh = useCallback((source?: ImSourceId) => runFor(source ?? "telegram", async () => {
    const list = await getImSourcesState(source);
    if (Array.isArray(list)) for (const item of list) acceptSnapshot(item);
  }), [acceptSnapshot, runFor]);

  const clear = useCallback((source: ImSourceId) => runFor(source, async () => {
    acceptSnapshot(await clearImSourceNotifications(source));
    dismissPreview(source);
  }), [acceptSnapshot, dismissPreview, runFor]);

  const openSource = useCallback((source: ImSourceId) => runFor(source, async () => {
    await openImSource(source);
    dismissPreview(source);
  }), [dismissPreview, runFor]);

  const dismissAllPreviews = useCallback(() => setPreviewWindows({}), []);

  const clearAll = useCallback(() => {
    for (const id of IM_SOURCE_IDS) if (snapshots[id].items.length > 0) void clear(id);
    setPreviewWindows({});
  }, [clear, snapshots]);

  const localizedSnapshots = useMemo(() => {
    const out = {} as Record<ImSourceId, ImSourceSnapshot>;
    for (const id of IM_SOURCE_IDS) {
      const s = snapshots[id];
      out[id] = s.error ? { ...s, error: errorText(s.error) } : s;
    }
    return out;
  }, [errorText, snapshots]);

  const previews = useMemo<ImActivePreview[]>(() => {
    if (!canPreview) return [];
    const list: ImActivePreview[] = [];
    for (const id of IM_SOURCE_IDS) {
      const win = previewWindows[id];
      if (!win) continue;
      const item = localizedSnapshots[id].items.find((entry) => entry.id === win.id);
      if (item) list.push({ source: id, item, receivedAt: win.receivedAt, replacedId: win.replacedId });
    }
    return list;
  }, [canPreview, localizedSnapshots, previewWindows]);

  return {
    snapshots: localizedSnapshots, autoClearMap, actionErrors, busySource, previews,
    setEnabled, setAutoClear, requestAccess, openSettings, refresh, clear, clearAll,
    openSource, dismissPreview, dismissAllPreviews,
  };
}

export type ImSourcesController = ReturnType<typeof useImSources>;
