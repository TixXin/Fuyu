import { useCallback, useEffect, useState } from "react";
import type { MediaState } from "./api";
import { syncMusicSources } from "./sourcePriority";
import { MUSIC_SOURCE_PRIORITY_STORAGE_KEY, loadMusicSourcePriority, saveMusicSourcePriority, type KnownMediaSource } from "./storage";

export function useMusicSourcePriority(sessions: MediaState["sessions"]) {
  const [musicSourcePriority, setMusicSourcePriority] = useState<
    KnownMediaSource[]
  >(loadMusicSourcePriority);

  const reorderMusicSource = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) {
        return;
      }

      setMusicSourcePriority((current) => {
        const sourceIndex = current.findIndex(
          (source) => source.id === sourceId,
        );
        const targetIndex = current.findIndex(
          (source) => source.id === targetId,
        );

        if (
          sourceIndex < 0 ||
          targetIndex < 0 ||
          sourceIndex === targetIndex
        ) {
          return current;
        }

        const next = [...current];
        const [moved] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  const removeMusicSource = useCallback((sourceId: string) => {
    setMusicSourcePriority((current) =>
      current.filter((source) => source.id !== sourceId),
    );
  }, []);

  useEffect(() => {
    setMusicSourcePriority((current) =>
      syncMusicSources(current, sessions, Date.now()),
    );
  }, [sessions, musicSourcePriority]);

  useEffect(() => {
    saveMusicSourcePriority(musicSourcePriority);
  }, [musicSourcePriority]);

  useEffect(() => {
    const syncFromOtherWindow = (event: StorageEvent) => {
      if (event.key === MUSIC_SOURCE_PRIORITY_STORAGE_KEY) {
        setMusicSourcePriority(loadMusicSourcePriority());
      }
    };
    window.addEventListener("storage", syncFromOtherWindow);
    return () => window.removeEventListener("storage", syncFromOtherWindow);
  }, []);

  return { musicSourcePriority, reorderMusicSource, removeMusicSource };
}
