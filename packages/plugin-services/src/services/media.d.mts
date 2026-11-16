import type { ServiceDefinition } from "../define.mjs";
import type { NowPlaying } from "../generated/rust.mjs";

export type { NowPlaying } from "../generated/rust.mjs";

export type MediaMethods = {
  nowPlaying(): NowPlaying;
  playPause(): NowPlaying;
  next(): NowPlaying;
  previous(): NowPlaying;
  seek(params: { positionMs: number }): NowPlaying;
};

export const mediaV1: ServiceDefinition<MediaMethods, {}, {}>;
