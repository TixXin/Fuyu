import type { NowPlaying } from "@fuyu/plugin-services";

export const CHANGE_SETTLE_MS: number;
export function changeKey(state: NowPlaying): string;
export function createNowPlayingFeed(options: {
  read: () => Promise<NowPlaying>;
  emit: (state: NowPlaying) => void;
  settleMs?: number;
}): { signal: () => void; stop: () => void };
