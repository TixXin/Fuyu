import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { wordFill, type LyricWord } from "./lrc";
import type { KaraokeLook } from "./lyricsSettings";
import "./KaraokeText.css";

const FOLLOW_MARGIN_PX = 24;

type Follow = { delayMs: number; durationMs: number; shift: number };

export function KaraokeText({ words, positionMs, playing, look }: { words: LyricWord[]; positionMs: number; playing: boolean; look: KaraokeLook }) {
  const [start] = useState(positionMs);
  const box = useRef<HTMLSpanElement>(null);
  const [follow, setFollow] = useState<Follow | null>(null);

  useLayoutEffect(() => {
    const element = box.current;
    if (!look.follow || !element) return;
    const shift = element.scrollWidth - element.clientWidth;
    if (shift <= 1) return;
    const spans = [...element.querySelectorAll<HTMLElement>(".karaoke__word")];
    const first = spans.findIndex((span) => span.offsetLeft + span.offsetWidth > element.clientWidth - FOLLOW_MARGIN_PX);
    if (first < 0) return;
    const from = words[first].startMs;
    const to = Math.max(from + 1, words[words.length - 1].endMs);
    setFollow({ delayMs: from - start, durationMs: to - from, shift });
  }, [look.follow, words, start]);

  const running = playing ? "running" : "paused";
  const colors = { "--karaoke-lit": look.lit, "--karaoke-dim": look.dim } as CSSProperties;
  const moving = follow
    ? ({ "--karaoke-shift": `${follow.shift}px`, animationDelay: `${follow.delayMs}ms`, animationDuration: `${follow.durationMs}ms`, animationPlayState: running } as CSSProperties)
    : undefined;
  const className = ["karaoke", look.follow ? "karaoke--follow" : "", look.fill === "word" ? "karaoke--word" : "", look.glow ? "karaoke--glow" : ""].filter(Boolean).join(" ");

  return (
    <span ref={box} className={className} style={colors}>
      <span className={follow ? "karaoke__track karaoke__track--moving" : "karaoke__track"} style={moving}>
        {words.map((word, index) => {
          const { delayMs, durationMs } = wordFill(word, start);
          const wordStyle = { animationDelay: `${delayMs}ms`, animationDuration: `${durationMs}ms`, animationPlayState: running } as CSSProperties;
          return <span className="karaoke__word" key={index} style={wordStyle}>{word.text}</span>;
        })}
      </span>
    </span>
  );
}
