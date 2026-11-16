import { Music2, Pause, Play, SkipForward } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayMedia } from "./trayCard";
import type { TrayCardHandlers } from "./types";

export function MediaBlock({ media, handlers }: { media: TrayMedia; handlers: TrayCardHandlers }) {
  const text = useTranslation().trayMenu;
  const sub = [media.artist, media.source].filter(Boolean).join(" · ");
  const toggle = media.playing ? text.pause : text.play;
  return (
    <div className="tray-card__block" role="group" aria-label={text.nowPlaying}>
      <span className="tray-card__cover" aria-hidden="true">
        {media.thumbnail ? <img src={media.thumbnail} alt="" draggable={false} /> : <Music2 size={18} />}
      </span>
      <span className="tray-card__block-text">
        <b>{media.title ?? text.unknownTrack}</b>
        {sub ? <span>{sub}</span> : null}
        <span className="tray-card__progress" aria-hidden="true">
          <i style={{ width: `${Math.round(media.progress * 100)}%` }} />
        </span>
      </span>
      <button type="button" className="tray-card__icon-button" aria-label={toggle} title={toggle} onClick={handlers.onPlayPause}>
        {media.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
      {media.canNext ? (
        <button type="button" className="tray-card__icon-button" aria-label={text.next} title={text.next} onClick={handlers.onNext}>
          <SkipForward size={16} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
