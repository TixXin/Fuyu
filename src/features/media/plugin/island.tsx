import type { ComponentProps } from "react";
import type { Translations } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import type { MediaState } from "../api";
import { MusicWaveButton } from "../MusicWaveButton";
import type { PlayingLyrics } from "../lyrics/usePlayingLyrics";
import { MusicPlayerPanel } from "../MusicPlayerPanel";
import type { useMediaState } from "../useMediaState";
import { islandPage } from "./page.ts";

type MusicPageProps = {
  media: ReturnType<typeof useMediaState>;
  settings: NonNullable<ComponentProps<typeof MusicPlayerPanel>["lyricsSettings"]>;
  lyrics?: PlayingLyrics;
  onOpenSettings: (section: "music") => void;
};

const pageSlot = defineSlot<MusicPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function MusicPage({ media, settings, lyrics, onOpenSettings }: MusicPageProps) {
  const { mediaState, isMediaTrackChanging, mediaCommandError, runMediaCommand } = media;
  return (
    <MusicPlayerPanel
      mediaState={mediaState}
      isTrackChanging={isMediaTrackChanging}
      commandError={mediaCommandError}
      onOpenSettings={() => onOpenSettings("music")}
      onPlayPause={() => void runMediaCommand("media_play_pause")}
      onNext={() => void runMediaCommand("media_next")}
      onPrevious={() => void runMediaCommand("media_previous")}
      lyricsSettings={settings}
      lyrics={lyrics}
      onAlignLyrics={media.alignPosition}
    />
  );
}

pageSlot.add({ ...islandPage, component: MusicPage });

type CollapsedContext = {
  t: Translations;
  showMusic: boolean;
  mediaState: MediaState;
  onOpenPage: (page: "music") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function MusicItem({ t, mediaState, onOpenPage }: CollapsedContext) {
  return (
    <MusicWaveButton
      isAvailable={mediaState.available || mediaState.audioActive}
      isPlaying={mediaState.playbackStatus === "playing"}
      audioPeak={mediaState.audioPeak}
      label={t.island.openMusic}
      onClick={() => onOpenPage("music")}
    />
  );
}

collapsedSlot.add({ id: "music", order: 60, shown: ({ showMusic }) => showMusic, component: MusicItem });
