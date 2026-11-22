import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsThumbStrip } from "../../../components/settings/SettingsThumbStrip";
import { useReducedMotion } from "../../../lib/theme/useReducedMotion";
import { ISLAND_MOTIONS, islandMotionTiming, islandMotionVariables } from "../../../lib/theme/islandMotion";
import type { IslandBounce, IslandMotion } from "../../../lib/settings/types";
import { MotionThumb } from "./motion/MotionThumb";
import { useThumbPointer } from "./useThumbPointer";
import "./IslandMotionRow.css";

const HOLD_MS = 700;

export function IslandMotionRow({
  value,
  bounce,
  showBounce,
  islandColor,
  onChange,
  onBounceChange,
}: {
  value: IslandMotion;
  bounce: IslandBounce;
  showBounce: boolean;
  islandColor: string;
  onChange: (value: IslandMotion) => void;
  onBounceChange: (value: IslandBounce) => void;
}) {
  const text = useTranslation().settings.expand;
  const reducedMotion = useReducedMotion();
  const { pointed, handlers } = useThumbPointer();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = (motion: IslandMotion, strength: IslandBounce) => {
    window.clearTimeout(timer.current);
    setOpen(true);
    timer.current = window.setTimeout(() => setOpen(false), islandMotionTiming(motion, "open", false, strength).width + HOLD_MS);
  };
  const labels: Record<IslandMotion, string> = {
    pop: text.motionPop,
    lively: text.motionLively,
    spring: text.motionSpring,
    snappy: text.motionSnappy,
    soft: text.motionSoft,
    unfold: text.motionUnfold,
    grow: text.motionGrow,
    smooth: text.motionSmooth,
    fast: text.motionFast,
    bouncy: text.motionBouncy,
    none: text.motionNone,
  };
  const bounces = [
    { value: "subtle", label: text.bounceSubtle },
    { value: "regular", label: text.bounceRegular },
    { value: "bouncy", label: text.bounceBouncy },
  ] as const;

  return (
    <>
      <SettingsRow className="island-motion-row" title={text.motionCurve} description={text.motionHint}>
        <div className="island-motion-preview" data-search="off" style={islandMotionVariables(value, open ? "open" : "close", reducedMotion, bounce) as CSSProperties}>
          <div className={`island-motion-preview__island${open ? " island-motion-preview__island--open" : ""}`}>
            <span className="island-motion-preview__line" />
            <span className="island-motion-preview__line island-motion-preview__line--short" />
          </div>
          <button type="button" className="island-motion-preview__play" aria-label={text.motionPlay} title={text.motionPlay} onClick={() => play(value, bounce)}>
            <Play size={14} />
          </button>
        </div>
        <div className="island-motion-row__strip" {...handlers}>
          <SettingsThumbStrip<IslandMotion>
            options={ISLAND_MOTIONS.map((motion) => ({ value: motion, label: labels[motion], hint: text.motionHints[motion] }))}
            value={value}
            ariaLabel={text.motion}
            onChange={(motion) => {
              onChange(motion);
              play(motion, bounce);
            }}
            renderArt={(motion) => <MotionThumb motion={motion} bounce={bounce} play={!reducedMotion && pointed === motion} islandColor={islandColor} />}
          />
        </div>
      </SettingsRow>
      {showBounce && (
        <SettingsRow
          indent
          title={text.bounce}
          description={text.bounceHint}
          control={
            <SettingsChoice<IslandBounce>
              value={bounce}
              options={bounces}
              ariaLabel={text.bounce}
              onChange={(strength) => {
                onBounceChange(strength);
                if (value === "pop") play(value, strength);
              }}
            />
          }
        />
      )}
    </>
  );
}
