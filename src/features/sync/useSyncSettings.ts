import { useCallback, useEffect, useState } from "react";
import {
  confirmSyncDeletions,
  getSyncStatus,
  onSyncStatus,
  pickSyncFolder,
  revealSyncFolder,
  setSyncConfig,
  setSyncWebdav,
  stopSync,
  syncNow,
  type OptionalSyncGroup,
  type SyncCategory,
  type SyncStatus,
} from "./api";
import {
  DEFAULT_SYNC_STATUS,
  activeSyncBackend,
  enabledCategories,
  isSyncActive,
  toggleCategoryList,
  toggleOptionalGroupList,
} from "./syncState";

export type SyncController = {
  status: SyncStatus;
  busy: boolean;
  actionError: unknown;
  chooseFolder: (pickerTitle: string) => Promise<void>;
  saveWebdav: (url: string, username: string, password: string | null) => Promise<boolean>;
  stopCurrentSync: (forgetWebdav?: boolean) => Promise<void>;
  revealFolder: () => Promise<void>;
  toggleCategory: (category: SyncCategory, checked: boolean) => Promise<void>;
  toggleOptionalGroup: (group: OptionalSyncGroup, checked: boolean) => Promise<void>;
  runSyncNow: () => Promise<void>;
  confirmDeletions: () => Promise<void>;
};

export function useSyncSettings(): SyncController {
  const [status, setStatus] = useState<SyncStatus>(DEFAULT_SYNC_STATUS);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;

    void onSyncStatus((next) => {
      if (alive) setStatus(next);
    })
      .then((unlisten) => {
        if (!alive) unlisten();
        else stop = unlisten;
      })
      .catch((error: unknown) => {
        if (alive) setActionError(error);
      });

    void getSyncStatus()
      .then((initial) => {
        if (!alive) return;
        setStatus(initial);
        if (isSyncActive(initial) && initial.phase === "idle") {
          void syncNow().catch((error: unknown) => {
            if (alive) setActionError(error);
          });
        }
      })
      .catch((error: unknown) => {
        if (alive) setActionError(error);
      });

    return () => {
      alive = false;
      stop?.();
    };
  }, []);

  const runBusy = useCallback(async (task: () => Promise<SyncStatus>) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await task();
      setStatus(next);
      return true;
    } catch (error: unknown) {
      setActionError(error);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseFolder = useCallback(async (pickerTitle: string) => {
    setActionError(null);
    try {
      const picked = await pickSyncFolder(pickerTitle);
      if (!picked) return;
      await runBusy(() => setSyncConfig(picked, enabledCategories(status), status.optionalGroups));
    } catch (error: unknown) {
      setActionError(error);
    }
  }, [runBusy, status]);

  const saveWebdav = useCallback((url: string, username: string, password: string | null) => {
    return runBusy(() =>
      setSyncWebdav({
        url,
        username,
        password,
        categories: enabledCategories(status),
        optionalGroups: status.optionalGroups,
      }),
    );
  }, [runBusy, status]);

  const stopCurrentSync = useCallback(async (forgetWebdav = false) => {
    if (forgetWebdav || activeSyncBackend(status) === "webdav") {
      await runBusy(() => stopSync(forgetWebdav));
      return;
    }
    await runBusy(() => setSyncConfig(null, enabledCategories(status), status.optionalGroups));
  }, [runBusy, status]);

  const revealFolder = useCallback(async () => {
    if (!status.folder) return;
    setActionError(null);
    try {
      await revealSyncFolder(status.folder);
    } catch (error: unknown) {
      setActionError(error);
    }
  }, [status.folder]);

  const saveSelection = useCallback(async (categories: SyncCategory[], optionalGroups: OptionalSyncGroup[]) => {
    if (activeSyncBackend(status) === "webdav" && status.webdav) {
      const { url, username } = status.webdav;
      await runBusy(() => setSyncWebdav({ url, username, password: null, categories, optionalGroups }));
      return;
    }
    const folder = activeSyncBackend(status) === "folder" ? status.folder : null;
    await runBusy(() => setSyncConfig(folder, categories, optionalGroups));
  }, [runBusy, status]);

  const toggleCategory = useCallback(async (category: SyncCategory, checked: boolean) => {
    await saveSelection(toggleCategoryList(enabledCategories(status), category, checked), status.optionalGroups);
  }, [saveSelection, status]);

  const toggleOptionalGroup = useCallback(async (group: OptionalSyncGroup, checked: boolean) => {
    await saveSelection(enabledCategories(status), toggleOptionalGroupList(status.optionalGroups, group, checked));
  }, [saveSelection, status]);

  const runSyncNow = useCallback(async () => {
    setActionError(null);
    try {
      await syncNow();
    } catch (error: unknown) {
      setActionError(error);
    }
  }, []);

  const confirmDeletions = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await confirmSyncDeletions();
    } catch (error: unknown) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    status,
    busy,
    actionError,
    chooseFolder,
    saveWebdav,
    stopCurrentSync,
    revealFolder,
    toggleCategory,
    toggleOptionalGroup,
    runSyncNow,
    confirmDeletions,
  };
}
