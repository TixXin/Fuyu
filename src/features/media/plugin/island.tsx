import type { ComponentProps } from "react";
import type { Translations } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { MusicWaveButton } from "../MusicWaveButton";
import { MusicPlayerPanel } from "../MusicPlayerPanel";
import { mediaIsland } from "./islandState";
import { islandPage } from "./page.ts";

type MusicPageProps = {
  settings: NonNullable<ComponentProps<typeof MusicPlayerPanel>["lyricsSettings"]>;
  onOpenSettings: (section: "music") => void;
};

const pageSlot = defineSlot<MusicPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function MusicPage({ settings, onOpenSettings }: MusicPageProps) {
  const island = mediaIsland.use();
  if (!island) return null;
  const { media, lyrics } = island;
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
  hints: ReadonlySet<string>;
  onOpenPage: (page: "music") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function MusicItem({ t, onOpenPage }: CollapsedContext) {
  const mediaState = mediaIsland.use()?.media.mediaState;
  if (!mediaState) return null;
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

collapsedSlot.add({ id: "music", order: 60, shown: ({ hints }) => hints.has("media.audible"), component: MusicItem });
