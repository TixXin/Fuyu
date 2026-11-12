import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "../../i18n";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useReducedMotion } from "../center-pattern/useReducedMotion";
import { islandMotionTiming, islandMotionVariables } from "./islandMotion";
import type { IslandMotion } from "./types";
import "./IslandMotionRow.css";

// How long the preview stays open before it closes again.
const HOLD_MS = 700;

/**
 * Settings → General → Opening: how the island opens and closes (C49), with a small island under
 * it that opens and closes with the picked timing, on each pick and on the play button.
 */
export function IslandMotionRow({ value, onChange }: { value: IslandMotion; onChange: (value: IslandMotion) => void }) {
  const text = useTranslation().settings.expand;
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = (motion: IslandMotion) => {
    window.clearTimeout(timer.current);
    setOpen(true);
    timer.current = window.setTimeout(() => setOpen(false), islandMotionTiming(motion, "open").width + HOLD_MS);
  };
  const options = [
    { value: "spring", label: text.motionSpring },
    { value: "smooth", label: text.motionSmooth },
    { value: "fast", label: text.motionFast },
    { value: "bouncy", label: text.motionBouncy },
    { value: "none", label: text.motionNone },
  ] as const;

  return (
    <SettingsRow
      title={text.motion}
      description={text.motionHint}
      control={
        <SettingsSelect<IslandMotion>
          value={value}
          options={options}
          ariaLabel={text.motion}
          onChange={(motion) => {
            onChange(motion);
            play(motion);
          }}
        />
      }
    >
      <div className="island-motion-preview" style={islandMotionVariables(value, open ? "open" : "close", reducedMotion) as CSSProperties}>
        <div className={`island-motion-preview__island${open ? " island-motion-preview__island--open" : ""}`}>
          <span className="island-motion-preview__line" />
          <span className="island-motion-preview__line island-motion-preview__line--short" />
        </div>
        <button type="button" className="island-motion-preview__play" aria-label={text.motionPlay} title={text.motionPlay} onClick={() => play(value)}>
          <Play size={14} />
        </button>
      </div>
    </SettingsRow>
  );
}
