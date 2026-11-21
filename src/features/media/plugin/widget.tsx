import { Music2, Pause, Play, SkipForward } from "lucide-react";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { DEFAULT_MEDIA_STATE } from "../mediaState";
import { useCurrentLyric } from "../lyrics/useCurrentLyric";
import { mediaIsland, useShowsLyricWidget } from "./islandState";
import { LYRICS_WIDGET, NOW_PLAYING_WIDGET } from "./widgets.ts";
import "./widget.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function NowPlayingWidget() {
  const t = useTranslation();
  const island = mediaIsland.use();
  const state = island?.media.mediaState;
  const run = island?.media.runMediaCommand;
  const playing = state?.playbackStatus === "playing";
  const known = Boolean(state && state.playbackStatus !== "unavailable" && state.title);
  return (
    <WidgetFrame icon={Music2} title={t.islandWidgets.widgets.nowPlaying} className="media-widget">
      {known && state && run ? (
        <div className="media-widget__track">
          <span className="media-widget__cover">
            {state.thumbnail ? <img src={state.thumbnail} alt="" draggable={false} /> : <Music2 size={20} strokeWidth={1.7} />}
          </span>
          <span className="media-widget__text">
            <span className="island-widget__line">{state.title}</span>
            <span className="island-widget__sub">{state.artist ?? ""}</span>
          </span>
          <button className="media-widget__button" type="button" aria-label={playing ? t.music.pause : t.music.play} onClick={(event) => { event.stopPropagation(); void run("media_play_pause"); }}>
            {playing ? <Pause size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
          </button>
          <button className="media-widget__button" type="button" disabled={!state.canNext} aria-label={t.music.nextTrack} onClick={(event) => { event.stopPropagation(); void run("media_next"); }}>
            <SkipForward size={15} strokeWidth={2.2} />
          </button>
        </div>
      ) : (
        <WidgetEmpty>{t.islandWidgets.content.notPlaying}</WidgetEmpty>
      )}
    </WidgetFrame>
  );
}

function LyricsWidget() {
  const t = useTranslation().islandWidgets;
  useShowsLyricWidget();
  const island = mediaIsland.use();
  const lines = island?.lyrics?.lines ?? null;
  const state = island?.media.mediaState;
  const current = useCurrentLyric(lines, state ?? DEFAULT_MEDIA_STATE, island?.lyrics?.offsetMs ?? 0, state !== undefined);
  const next = lines && current.text ? lines[current.index + 1]?.text ?? null : null;
  return (
    <WidgetFrame icon={Music2} title={state?.title ?? t.widgets.lyrics} className="media-widget media-widget--lyrics">
      {current.text ? (
        <>
          <span className="media-widget__lyric">{current.text}</span>
          {next ? <span className="island-widget__sub">{next}</span> : null}
        </>
      ) : (
        <WidgetEmpty>{state?.playbackStatus === "playing" ? t.content.noLyrics : t.content.notPlaying}</WidgetEmpty>
      )}
    </WidgetFrame>
  );
}

widgetSlot.add({ ...NOW_PLAYING_WIDGET, component: NowPlayingWidget }, NOW_PLAYING_WIDGET.owner);
widgetSlot.add({ ...LYRICS_WIDGET, component: LyricsWidget }, LYRICS_WIDGET.owner);
