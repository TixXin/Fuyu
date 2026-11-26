import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { DEFAULT_MEDIA_STATE } from "../mediaState";
import { KaraokeText } from "../lyrics/KaraokeText";
import { useCurrentLyric } from "../lyrics/useCurrentLyric";
import type { TaskbarLyricsFeed, TaskbarLyricsRequest } from "./api";
import { taskbarLyricsActive } from "./taskbarLyricsActive";
import "./TaskbarLyrics.css";

type TaskbarLyricsProps = {
  feed: TaskbarLyricsFeed | null;
  light: boolean;
  onRequest: (request: TaskbarLyricsRequest) => void;
};

export function TaskbarLyrics({ feed, light, onRequest }: TaskbarLyricsProps) {
  const t = useTranslation().music;
  const state = feed?.state ?? DEFAULT_MEDIA_STATE;
  const content = feed?.content ?? "both";
  const current = useCurrentLyric(feed?.lines ?? null, state, feed?.offsetMs ?? 0, content !== "song", feed?.karaoke ?? null);
  const className = light ? "taskbar-lyrics island-light" : "taskbar-lyrics";
  const open = () => onRequest("open");

  if (!taskbarLyricsActive(feed)) {
    return (
      <div className={className}>
        <button className="taskbar-lyrics__idle" type="button" aria-label={t.openPage} title={t.openPage} onClick={open}>
          <Music2 size={18} strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  const playing = state.playbackStatus === "playing";
  const song = [state.title, state.artist].filter(Boolean).join(" - ");
  const lyric = content === "song" ? null : current.text;
  const sub = content === "both" && lyric ? song : null;

  return (
    <div className={className}>
      <button className="taskbar-lyrics__body" type="button" title={song} aria-label={`${t.openPage}: ${song}`} onClick={open}>
        <span className="taskbar-lyrics__cover">
          {state.thumbnail ? <img src={state.thumbnail} alt="" draggable={false} /> : <Music2 size={16} strokeWidth={1.8} />}
        </span>
        <span className="taskbar-lyrics__text">
          <span className="taskbar-lyrics__line">
            {lyric && current.karaoke ? (
              <KaraokeText key={`${current.index}:${current.karaoke.clock}`} words={current.karaoke.words} positionMs={current.karaoke.positionMs} sampledAt={current.karaoke.sampledAt} playing={playing} look={current.karaoke.look} />
            ) : (
              lyric ?? song
            )}
          </span>
          {sub ? <span className="taskbar-lyrics__sub">{sub}</span> : null}
        </span>
      </button>
      <span className="taskbar-lyrics__controls">
        <button className="taskbar-lyrics__button" type="button" disabled={!state.canPrevious} aria-label={t.previousTrack} title={t.previousTrack} onClick={() => onRequest("previous")}>
          <SkipBack size={14} strokeWidth={2.2} />
        </button>
        <button className="taskbar-lyrics__button" type="button" aria-label={playing ? t.pause : t.play} title={playing ? t.pause : t.play} onClick={() => onRequest("play-pause")}>
          {playing ? <Pause size={15} strokeWidth={2.2} /> : <Play size={15} strokeWidth={2.2} />}
        </button>
        <button className="taskbar-lyrics__button" type="button" disabled={!state.canNext} aria-label={t.nextTrack} title={t.nextTrack} onClick={() => onRequest("next")}>
          <SkipForward size={14} strokeWidth={2.2} />
        </button>
      </span>
    </div>
  );
}
