import { useCallback, useEffect, useState } from "react";
import {
  confirmSyncDeletions,
  getSyncStatus,
  onSyncStatus,
  pickSyncFolder,
  revealSyncFolder,
  setSyncConfig,
  syncNow,
  type OptionalSyncGroup,
  type SyncCategory,
  type SyncStatus,
} from "./api";
import {
  DEFAULT_SYNC_STATUS,
  enabledCategories,
  toggleCategoryList,
  toggleOptionalGroupList,
} from "./syncState";

export type SyncController = {
  status: SyncStatus;
  busy: boolean;
  actionError: unknown;
  chooseFolder: (pickerTitle: string) => Promise<void>;
  stopFolderSync: () => Promise<void>;
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
        if (initial.folder && initial.phase === "idle") {
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

  const applyConfig = useCallback(async (
    folder: string | null,
    categories: SyncCategory[],
    optionalGroups: OptionalSyncGroup[],
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await setSyncConfig(folder, categories, optionalGroups);
      setStatus(next);
    } catch (error: unknown) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseFolder = useCallback(async (pickerTitle: string) => {
    setActionError(null);
    try {
      const picked = await pickSyncFolder(pickerTitle);
      if (!picked) return;
      await applyConfig(picked, enabledCategories(status), status.optionalGroups);
    } catch (error: unknown) {
      setActionError(error);
    }
  }, [applyConfig, status]);

  const stopFolderSync = useCallback(async () => {
    await applyConfig(null, enabledCategories(status), status.optionalGroups);
  }, [applyConfig, status]);

  const revealFolder = useCallback(async () => {
    if (!status.folder) return;
    setActionError(null);
    try {
      await revealSyncFolder(status.folder);
    } catch (error: unknown) {
      setActionError(error);
    }
  }, [status.folder]);

  const toggleCategory = useCallback(async (category: SyncCategory, checked: boolean) => {
    const next = toggleCategoryList(enabledCategories(status), category, checked);
    await applyConfig(status.folder, next, status.optionalGroups);
  }, [applyConfig, status]);

  const toggleOptionalGroup = useCallback(async (group: OptionalSyncGroup, checked: boolean) => {
    const next = toggleOptionalGroupList(status.optionalGroups, group, checked);
    await applyConfig(status.folder, enabledCategories(status), next);
  }, [applyConfig, status]);

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
    stopFolderSync,
    revealFolder,
    toggleCategory,
    toggleOptionalGroup,
    runSyncNow,
    confirmDeletions,
  };
}
