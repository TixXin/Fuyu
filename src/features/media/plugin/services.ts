import { lyricsV1, mediaV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { getMediaState, seekMedia, sendMediaCommand, type MediaCommand } from "../api";
import { getLyrics } from "../lyrics/api";
import { fromRust, positionOf, serviceNowPlaying } from "../host/index.mjs";
import { getLyricsSources, lookupLyricsWithSources, subscribeLyricsSources } from "../host/lyricsSources.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

const command = async (name: MediaCommand) => serviceNowPlaying(await sendMediaCommand(name, undefined).catch(failed));

windowServices.provide(mediaV1, {
  nowPlaying: async () => serviceNowPlaying(await getMediaState(undefined).catch(failed)),
  playPause: () => command("media_play_pause"),
  next: () => command("media_next"),
  previous: () => command("media_previous"),
  seek: async (params) => serviceNowPlaying(await seekMedia(positionOf(params), undefined).catch(failed)),
}, { owner: OWNER });

const lyricsProvider = windowServices.provide(lyricsV1, {
  lookup: (query) => lookupLyricsWithSources(query, (normalized) => getLyrics(normalized).catch(failed)),
  sources: () => ({ sources: [...getLyricsSources().sources] }),
}, { owner: OWNER });

subscribeLyricsSources(() => {
  lyricsProvider.emit("changed", {});
});
