import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetEmpty, WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { WidgetOpenButton } from "../../../components/island-widget/WidgetOpenButton";
import { useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { DEFAULT_MEDIA_STATE } from "../mediaState";
import { useCurrentLyric } from "../lyrics/useCurrentLyric";
import { mediaIsland, useShowsLyricWidget } from "./islandState";
import { LYRICS_WIDGET, NOW_PLAYING_WIDGET } from "./widgets.ts";
import "./widget.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const openMusic = () => void runIslandAction("media.open-page");

function NowPlayingWidget() {
  const t = useTranslation();
  const island = mediaIsland.use();
  const state = island?.media.mediaState;
  const run = island?.media.runMediaCommand;
  const playing = state?.playbackStatus === "playing";
  const known = Boolean(state && state.playbackStatus !== "unavailable" && state.title);
  return (
    <WidgetFrame icon={Music2} title={t.islandWidgets.widgets.nowPlaying} className="media-widget" aside={<WidgetOpenButton label={t.music.openPage} onOpen={openMusic} />}>
      {known && state && run ? (
        <div className="media-widget__track">
          <button className="media-widget__cover" type="button" aria-label={t.music.openPage} title={t.music.openPage} onClick={clickOnly(openMusic)}>
            {state.thumbnail ? <img src={state.thumbnail} alt="" draggable={false} /> : <Music2 size={20} strokeWidth={1.7} />}
          </button>
          <span className="media-widget__text">
            <button className="media-widget__title" type="button" title={t.music.openPage} onClick={clickOnly(openMusic)}>
              <span className="island-widget__line">{state.title}</span>
              <span className="island-widget__sub">{state.artist ?? ""}</span>
            </button>
            <span className="media-widget__controls">
              <button className="media-widget__button" type="button" disabled={!state.canPrevious} aria-label={t.music.previousTrack} title={t.music.previousTrack} onClick={clickOnly(() => void run("media_previous"))}>
                <SkipBack size={14} strokeWidth={2.2} />
              </button>
              <button className="media-widget__button" type="button" data-main="true" aria-label={playing ? t.music.pause : t.music.play} title={playing ? t.music.pause : t.music.play} onClick={clickOnly(() => void run("media_play_pause"))}>
                {playing ? <Pause size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
              </button>
              <button className="media-widget__button" type="button" disabled={!state.canNext} aria-label={t.music.nextTrack} title={t.music.nextTrack} onClick={clickOnly(() => void run("media_next"))}>
                <SkipForward size={14} strokeWidth={2.2} />
              </button>
            </span>
          </span>
        </div>
      ) : (
        <WidgetEmpty>{t.islandWidgets.content.notPlaying}</WidgetEmpty>
      )}
    </WidgetFrame>
  );
}

function LyricsWidget() {
  const text = useTranslation();
  const t = text.islandWidgets;
  useShowsLyricWidget();
  const island = mediaIsland.use();
  const lines = island?.lyrics?.lines ?? null;
  const state = island?.media.mediaState;
  const current = useCurrentLyric(lines, state ?? DEFAULT_MEDIA_STATE, island?.lyrics?.offsetMs ?? 0, state !== undefined);
  const next = lines && current.text ? lines[current.index + 1]?.text ?? null : null;
  return (
    <WidgetFrame icon={Music2} title={state?.title ?? t.widgets.lyrics} className="media-widget media-widget--lyrics" aside={<WidgetOpenButton label={text.music.openPage} onOpen={openMusic} />}>
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
