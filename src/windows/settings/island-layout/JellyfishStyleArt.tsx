import { useEffect, useRef, useState } from "react";
import { JellyfishMark, type JellyMood } from "../../../components/jellyfish/JellyfishMark";
import { JellyfishStyleContext } from "../../../components/jellyfish/jellyfishStyleContext";
import type { JellyfishStyle } from "../../../lib/settings/types";
import "./JellyfishStyleArt.css";

const ART_HEIGHT = 48;
const TOUR: readonly JellyMood[] = ["running", "waiting", "done", "failed", "stale", "compacting"];
const TOUR_STEP_MS = 1600;

export function JellyfishStyleArt({ style }: { style: JellyfishStyle }) {
  const art = useRef<HTMLSpanElement>(null);
  const [touring, setTouring] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const card = art.current?.closest("button");
    if (!card) return undefined;
    const start = () => {
      setStep(0);
      setTouring(true);
    };
    const stop = () => setTouring(false);
    card.addEventListener("pointerenter", start);
    card.addEventListener("pointerleave", stop);
    card.addEventListener("focus", start);
    card.addEventListener("blur", stop);
    return () => {
      card.removeEventListener("pointerenter", start);
      card.removeEventListener("pointerleave", stop);
      card.removeEventListener("focus", start);
      card.removeEventListener("blur", stop);
    };
  }, []);

  useEffect(() => {
    if (!touring) return undefined;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % TOUR.length), TOUR_STEP_MS);
    return () => window.clearInterval(timer);
  }, [touring]);

  return (
    <span ref={art} className="jellyfish-style-art">
      <JellyfishStyleContext.Provider value={style}>
        <JellyfishMark mood={touring ? TOUR[step] : "idle"} paused={!touring} height={ART_HEIGHT} />
      </JellyfishStyleContext.Provider>
    </span>
  );
}
