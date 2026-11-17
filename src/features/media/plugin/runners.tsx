import { useMemo } from "react";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { ISLAND_SIDE_COVER_HEIGHT, ISLAND_SIDE_ROW_HEIGHT, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { defineSlot } from "../../plugin-kernel/slots";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { useAudible } from "../useAudible";
import { coverAccentVariables, useCoverColor } from "../useCoverColor";
import { useIslandLyrics } from "../useIslandLyrics";
import { useMediaState } from "../useMediaState";
import { demoMediaState } from "./demo";
import { mediaIsland } from "./islandState";
import { lyricLineContribution } from "./lyricLine";
import { OWNER } from "./owner.ts";

type RunnerProps = {
  mode: string;
  isTucked: boolean;
  page: string;
  barText: boolean;
  settings: IslandSettings;
  features: { music: boolean };
  demo: { active: boolean; startedAt: number };
  background: string;
  accent: string | null;
};

const runnerSlot = defineSlot<RunnerProps>("island.runner/v1");

function MediaRunner({ mode, isTucked, page, barText, settings, features, demo, background, accent }: RunnerProps) {
  const t = useTranslation();
  const waveformVisible = !isTucked && (mode === "collapsed" || page === "music");
  const live = useMediaState(settings.musicEnabled, waveformVisible);
  const demoState = useMemo(() => (demo.active ? demoMediaState(t.onboarding.demo, demo.startedAt) : null), [demo.active, demo.startedAt, t]);
  const media = useMemo(() => (demoState && live.mediaState.playbackStatus !== "playing" ? { ...live, mediaState: demoState } : live), [demoState, live]);
  const { mediaState, runMediaCommand } = media;
  const { lyrics, lyricLine } = useIslandLyrics(settings, mediaState, { page, barShown: mode === "collapsed" && !isTucked && barText });
  const audible = useAudible(mediaState.audioActive);
  const playing = mediaState.playbackStatus === "playing";
  const coverOn = settings.musicEnabled && settings.lyricsCoverColor;
  const glassCover = settings.appearanceMode === "liquidGlass" && settings.musicEnabled && settings.glassColorSource === "cover";
  const coverColor = useCoverColor(mediaState.thumbnail, coverOn || glassCover);
  const sideCover = settings.sideMusicCover;
  mediaIsland.useProvide(useMemo(() => ({ media, lyrics, lyricLine, sideCover }), [media, lyrics, lyricLine, sideCover]));
  useIslandAction("media.previous", () => void runMediaCommand("media_previous"));
  useIslandAction("media.play-pause", () => void runMediaCommand("media_play_pause"));
  useIslandAction("media.next", () => void runMediaCommand("media_next"));
  const list: IslandContribution[] = [];
  const line = lyricLineContribution(lyricLine, settings.lyricsIslandPriority === "lyrics", t);
  if (line) list.push(line);
  if (settings.autoTuckHoldMusic && settings.musicEnabled && playing) list.push({ kind: "hold", reason: "media.playing" });
  if (features.music && (mediaState.available || mediaState.audioActive)) {
    list.push({ kind: "side", item: "music", height: sideCover && mediaState.thumbnail ? ISLAND_SIDE_COVER_HEIGHT : ISLAND_SIDE_ROW_HEIGHT });
  }
  if (features.music && audible) list.push({ kind: "hint", key: "media.audible" });
  if (playing) list.push({ kind: "hint", key: "media.playing" });
  if (coverOn) list.push({ kind: "style", vars: coverAccentVariables(coverColor, background, accent), className: "cover-color" });
  if (glassCover && playing && coverColor) list.push({ kind: "style", tint: coverColor });
  useIslandContributions(OWNER, "media.island", list);
  return null;
}

runnerSlot.add({ id: "media.runner", component: MediaRunner }, OWNER);
