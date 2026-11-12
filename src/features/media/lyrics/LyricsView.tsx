import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import type { MediaState } from "../api";
import { lineIndexAt, playbackPosition, type LyricLine } from "./lrc";
import { KaraokeText } from "./KaraokeText";
import type { KaraokeLook } from "./lyricsSettings";
import "./LyricsView.css";

const TICK_MS = 200;

const PAGE_LOOK: KaraokeLook = { fill: "smooth", lit: "var(--text-1)", dim: "var(--text-3)", glow: false, follow: false };

export function LyricsView({ lines, mediaState, offsetMs, onPickLine }: {
  lines: LyricLine[];
  mediaState: MediaState;
  offsetMs: number;
  onPickLine?: (positionMs: number) => void;
}) {
  const t = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const playing = mediaState.playbackStatus === "playing";

  useEffect(() => {
    setNow(Date.now());
    if (!playing) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [playing, mediaState.updatedAt]);

  const position = playbackPosition(mediaState, now) - offsetMs;
  const index = lineIndexAt(lines, position);
  const words = index >= 0 ? lines[index].words : undefined;
  const text = (at: number) => (at >= 0 && at < lines.length ? lines[at].text : "");
  const current = (index >= 0 && text(index)) || "♪";
  const row = (at: number, className: string, content: ReactNode, key?: number) => {
    const line = at >= 0 && at < lines.length ? lines[at] : null;
    if (!onPickLine || !line?.text) {
      return <span className={className} key={key} aria-hidden={className.includes("--side") ? true : undefined}>{content}</span>;
    }
    return (
      <button type="button" className={`${className} lyrics-view__pick`} key={key} aria-label={t.music.alignToLine(line.text)} onClick={() => onPickLine(line.timeMs + offsetMs)}>
        {content}
      </button>
    );
  };

  return (
    <div className={onPickLine ? "lyrics-view lyrics-view--pickable" : "lyrics-view"} aria-label={t.music.lyricsLabel}>
      {row(index - 1, "lyrics-view__line lyrics-view__line--side", text(index - 1))}
      {row(index, "lyrics-view__line lyrics-view__line--current", words
        ? <KaraokeText key={`${mediaState.updatedAt}:${offsetMs}`} words={words} positionMs={position} playing={playing} look={PAGE_LOOK} />
        : current, index)}
      {index >= 0 && lines[index].translation ? (
        <span className="lyrics-view__line lyrics-view__line--translation">{lines[index].translation}</span>
      ) : (
        row(index + 1, "lyrics-view__line lyrics-view__line--side", text(index + 1))
      )}
    </div>
  );
}
