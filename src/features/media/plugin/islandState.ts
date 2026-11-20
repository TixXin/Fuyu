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
