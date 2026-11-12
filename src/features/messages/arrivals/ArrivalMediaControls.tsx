import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "../../../i18n";
import "./ArrivalMediaControls.css";

export type ArrivalMedia = {
  playing: boolean;
  onPrevious: () => void;
  onPlayPause: () => void;
  onNext: () => void;
};

export function ArrivalMediaControls({ media }: { media: ArrivalMedia }) {
  const t = useTranslation().music;
  return (
    <div className="message-arrivals__media" role="group" aria-label={t.playerLabel}>
      <button className="message-arrivals__media-button" type="button" aria-label={t.previousTrack} title={t.previousTrack} onClick={media.onPrevious}>
        <SkipBack size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <button
        className="message-arrivals__media-button message-arrivals__media-button--main"
        type="button"
        aria-label={media.playing ? t.pause : t.play}
        title={media.playing ? t.pause : t.play}
        onClick={media.onPlayPause}
      >
        {media.playing ? <Pause size={16} strokeWidth={2.5} aria-hidden="true" /> : <Play size={16} strokeWidth={2.5} aria-hidden="true" />}
      </button>
      <button className="message-arrivals__media-button" type="button" aria-label={t.nextTrack} title={t.nextTrack} onClick={media.onNext}>
        <SkipForward size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
