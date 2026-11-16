import type { Translations } from "../../../i18n";
import type { MediaState } from "../api";
import { DEFAULT_MEDIA_STATE } from "../mediaState";

export function demoMediaState(text: Translations["onboarding"]["demo"], startedAt: number): MediaState {
  return {
    ...DEFAULT_MEDIA_STATE,
    available: true,
    audioActive: true,
    audioPeak: 0.55,
    playbackStatus: "playing",
    title: text.song,
    artist: text.artist,
    positionMs: 42_000,
    durationMs: 214_000,
    sourceApp: text.source,
    updatedAt: startedAt,
  };
}
