import { useCallback, useEffect, useRef, useState } from "react";
import { clearClipboardHistory, copyClipboardItem, deleteClipboardItem, getClipboardHistory, listenClipboardHistoryChanged, listenClipboardHistoryShortcut, setClipboardItemNote, toggleClipboardFavorite, type ClipboardCopyAs, type ClipboardHistorySnapshot } from "./api";
import { DEFAULT_CLIPBOARD_HISTORY } from "./settings";

const isHidden = () => document.visibilityState === "hidden";

export function useClipboardHistory(onShortcut: () => void, { deferWhileHidden = false }: { deferWhileHidden?: boolean } = {}) {
  const [clipboardHistory, setClipboardHistory] =
    useState<ClipboardHistorySnapshot>(DEFAULT_CLIPBOARD_HISTORY);
  const staleRef = useRef(false);

  const refreshClipboardHistory = useCallback(async () => {
    try {
      const snapshot = await getClipboardHistory();
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to read clipboard history", error);
    }
  }, []);

  const reloadIfStale = useCallback(async (then: () => void) => {
    if (!staleRef.current) {
      then();
      return;
    }
    staleRef.current = false;
    try {
      const snapshot = await getClipboardHistory();
      setClipboardHistory(snapshot);
    } catch (error) {
      staleRef.current = true;
      console.error("Failed to read clipboard history", error);
    }
    then();
  }, []);

  useEffect(() => {
    if (!deferWhileHidden) return;
    const sync = () => {
      if (!isHidden() && staleRef.current) void reloadIfStale(() => {});
    };
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [deferWhileHidden, reloadIfStale]);

  const copyClipboardHistoryItem = useCallback(async (id: string, copyAs?: ClipboardCopyAs) => {
    try {
      const snapshot = await copyClipboardItem(id, copyAs);
      setClipboardHistory(snapshot);
      return true;
    } catch (error) {
      console.error("Failed to copy clipboard history item", error);
      return false;
    }
  }, []);

  const toggleClipboardHistoryFavorite = useCallback(async (id: string) => {
    try {
      const snapshot = await toggleClipboardFavorite(id);
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to toggle clipboard history favorite", error);
    }
  }, []);

  const updateClipboardHistoryItemNote = useCallback(
    async (id: string, note: string) => {
      try {
        const snapshot = await setClipboardItemNote(id, note);
        setClipboardHistory(snapshot);
        return true;
      } catch (error) {
        console.error("Failed to update clipboard history item note", error);
        return false;
      }
    },
    [],
  );

  const deleteClipboardHistoryItem = useCallback(async (id: string) => {
    try {
      const snapshot = await deleteClipboardItem(id);
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to delete clipboard history item", error);
    }
  }, []);

  const clearClipboardHistoryItems = useCallback(async () => {
    try {
      const snapshot = await clearClipboardHistory();
      setClipboardHistory(snapshot);
    } catch (error) {
      console.error("Failed to clear clipboard history", error);
    }
  }, []);

  useEffect(() => {
    void refreshClipboardHistory();

    let didCancel = false;
    let unlistenChanges: (() => void) | null = null;
    let unlistenShortcut: (() => void) | null = null;

    void listenClipboardHistoryChanged(() => {
      if (deferWhileHidden && isHidden()) staleRef.current = true;
      else void refreshClipboardHistory();
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlistenChanges = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for clipboard history changes", error);
      });

    void listenClipboardHistoryShortcut(() => {
      if (clipboardHistory.settings.shortcutEnabled) {
        onShortcut();
      }
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlistenShortcut = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for clipboard history shortcut", error);
      });

    return () => {
      didCancel = true;
      unlistenChanges?.();
      unlistenShortcut?.();
    };
  }, [
    clipboardHistory.settings.shortcutEnabled,
    refreshClipboardHistory,
    onShortcut,
    deferWhileHidden,
  ]);

  return {
    clipboardHistory,
    copyClipboardHistoryItem,
    toggleClipboardHistoryFavorite,
    updateClipboardHistoryItemNote,
    deleteClipboardHistoryItem,
    clearClipboardHistoryItems,
    reloadIfStale,
  };
}
