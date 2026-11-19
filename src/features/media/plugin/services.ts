import { lyricsV1, mediaV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { getMediaState, isMediaSourceFrontmost, seekMedia, sendMediaCommand, type MediaCommand, type MediaState } from "../api";
import { getLyrics } from "../lyrics/api";
import { fromRust, positionOf, serviceNowPlaying } from "../host/index.mjs";
import { getLyricsSources, lookupLyricsWithSources, subscribeLyricsSources } from "../host/lyricsSources.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

async function nowPlayingOf(state: MediaState) {
  const now = serviceNowPlaying(state);
  if (!now.sourceApp) return now;
  return { ...now, sourceFrontmost: await isMediaSourceFrontmost(now.sourceApp).catch(() => false) };
}

const command = async (name: MediaCommand) => nowPlayingOf(await sendMediaCommand(name, undefined).catch(failed));

windowServices.provide(mediaV1, {
  nowPlaying: async () => nowPlayingOf(await getMediaState(undefined).catch(failed)),
  playPause: () => command("media_play_pause"),
  next: () => command("media_next"),
  previous: () => command("media_previous"),
  seek: async (params) => nowPlayingOf(await seekMedia(positionOf(params), undefined).catch(failed)),
}, { owner: OWNER });

const lyricsProvider = windowServices.provide(lyricsV1, {
  lookup: (query) => lookupLyricsWithSources(query, (normalized) => getLyrics(normalized).catch(failed)),
  sources: () => ({ sources: [...getLyricsSources().sources] }),
}, { owner: OWNER });

subscribeLyricsSources(() => {
  lyricsProvider.emit("changed", {});
});
