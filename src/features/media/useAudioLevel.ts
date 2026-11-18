import { useEffect, useRef, useSyncExternalStore } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getAudioLevel, type AudioLevel, type MediaPlaybackStatus } from "./api";
import { audioPeakStore } from "./audioPeakStore";

export type MediaPlaybackIntent = { status: MediaPlaybackStatus; expiresAt: number };

const noopSubscribe = () => () => {};

export function useAudioPeak(override?: number): number {
  const hasOverride = override !== undefined;
  const live = useSyncExternalStore(
    hasOverride ? noopSubscribe : audioPeakStore.subscribe,
    hasOverride ? () => override : audioPeakStore.get,
    hasOverride ? () => override : audioPeakStore.get,
  );
  return hasOverride ? override : live;
}

export function useAudioLevel(
  onAudioLevel: (level: AudioLevel) => void,
  enabled = true,
) {
  const isRefreshingAudioLevel = useRef(false);
  const latestHandler = useRef(onAudioLevel);
  latestHandler.current = onAudioLevel;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let didCancel = false;

    const refreshAudioLevel = async () => {
      if (didCancel || isRefreshingAudioLevel.current) {
        return;
      }

      isRefreshingAudioLevel.current = true;

      try {
        const audioLevel = await getAudioLevel();
        if (!didCancel) {
          latestHandler.current(audioLevel);
        }
      } catch (error) {
        console.error("Failed to read audio level", error);
      } finally {
        isRefreshingAudioLevel.current = false;
      }
    };

    void refreshAudioLevel();

    const stop = visibilityInterval(() => {
      void refreshAudioLevel();
    }, 500);

    return () => {
      didCancel = true;
      stop();
    };
  }, [enabled]);
}
