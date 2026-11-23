import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { tuckLipHeight } from "../../../../lib/settings/tuckLip";
import type { IslandSettings } from "../../../../lib/settings/types";
import { TuckMock } from "./TuckMock";
import { tuckHintPaint, tuckHintRing } from "./tuckHintPaint";
import "./TuckPreview.css";

const MOVE_MS = 420;
const SHOWN_MS = 1400;
const MIN_RETRACT_MS = 300;
const BREATHE_AFTER_CHANGE_MS = 8400;

type Pointer = "away" | "edge" | null;

export function TuckPreview({ settings, label, tryLabel, tryHint }: { settings: IslandSettings; label: string; tryLabel: string; tryHint: string }) {
  const [pointer, setPointer] = useState<Pointer>(null);
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [changed, setChanged] = useState(false);
  const timers = useRef<number[]>([]);
  const mounted = useRef(false);
  const { tuckHintStyle, tuckHintColor, tuckHintCustomColor, tuckHintBreathe } = settings;

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setChanged(true);
    const timer = window.setTimeout(() => setChanged(false), BREATHE_AFTER_CHANGE_MS);
    return () => window.clearTimeout(timer);
  }, [tuckHintStyle, tuckHintColor, tuckHintCustomColor, tuckHintBreathe]);

  const play = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    const retract = Math.max(settings.autoTuckRetractDelayMs, MIN_RETRACT_MS);
    const reveal = 30 + MOVE_MS + settings.tuckedHoverDelayMs;
    const leave = reveal + SHOWN_MS;
    setRevealed(false);
    setPointer("away");
    timers.current = [
      window.setTimeout(() => setPointer("edge"), 30),
      window.setTimeout(() => setRevealed(true), reveal),
      window.setTimeout(() => setPointer("away"), leave),
      window.setTimeout(() => setRevealed(false), leave + retract),
      window.setTimeout(() => setPointer(null), leave + retract + MOVE_MS),
    ];
  };

  const paint = tuckHintPaint(tuckHintColor, settings);
  const hint = { style: tuckHintStyle, paint, ring: tuckHintRing(tuckHintColor, paint), breathe: tuckHintBreathe && (hovered || changed) };

  return (
    <div className="tuck-preview" data-search="off">
      <div className="tuck-preview__stage" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
        <TuckMock
          tuckStyle={settings.tuckStyle}
          lipHeight={tuckLipHeight(settings.tuckStyle, settings.tuckLipHeight)}
          lipWidth={settings.tuckLipWidth}
          hint={hint}
          islandColor={settings.islandBackgroundColor}
          revealed={revealed}
          expanded={settings.tuckedHoverAction === "expand"}
          pointer={pointer}
        />
      </div>
      <div className="tuck-preview__bar">
        <span className="tuck-preview__label">{label}</span>
        <button type="button" className="tuck-preview__try" title={tryHint} onClick={play}>
          <Play size={12} aria-hidden="true" />
          {tryLabel}
        </button>
      </div>
    </div>
  );
}
