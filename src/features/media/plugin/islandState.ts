import { useEffect, useSyncExternalStore } from "react";
import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { CurrentLyric } from "../lyrics/useCurrentLyric";
import type { PlayingLyrics } from "../lyrics/usePlayingLyrics";
import type { useMediaState } from "../useMediaState";

export type MediaController = ReturnType<typeof useMediaState>;

export type MediaIsland = {
  media: MediaController;
  lyrics?: PlayingLyrics;
  lyricLine: CurrentLyric | null;
  sideCover: boolean;
  sideLyric: boolean;
};

export const mediaIsland = createRunnerStore<MediaIsland | null>(null);

let lyricWidgets = 0;
const lyricWidgetListeners = new Set<() => void>();
const lyricWidgetsShown = () => lyricWidgets > 0;
const subscribeLyricWidgets = (listener: () => void) => {
  lyricWidgetListeners.add(listener);
  return () => {
    lyricWidgetListeners.delete(listener);
  };
};

export function useLyricWidgetsShown(): boolean {
  return useSyncExternalStore(subscribeLyricWidgets, lyricWidgetsShown, lyricWidgetsShown);
}

export function useShowsLyricWidget() {
  useEffect(() => {
    lyricWidgets += 1;
    lyricWidgetListeners.forEach((listener) => listener());
    return () => {
      lyricWidgets -= 1;
      lyricWidgetListeners.forEach((listener) => listener());
    };
  }, []);
}
