import { useEffect, useState, type CSSProperties } from "react";
import { islandMotionTiming, islandMotionVariables } from "../../../../lib/theme/islandMotion";
import type { IslandBounce, IslandMotion } from "../../../../lib/settings/types";
import "./MotionThumbs.css";

const HOLD_MS = 600;

export function MotionThumb({ motion, bounce, play, islandColor }: { motion: IslandMotion; bounce: IslandBounce; play: boolean; islandColor: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!play) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), islandMotionTiming(motion, "open", false, bounce).width + HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [play, motion, bounce]);

  const style = { ...islandMotionVariables(motion, open ? "open" : "close", false, bounce), background: islandColor } as CSSProperties;
  return (
    <span className="motion-thumb" aria-hidden="true">
      <span className={open ? "motion-thumb__island motion-thumb__island--open" : "motion-thumb__island"} style={style}>
        <i />
        <i />
      </span>
    </span>
  );
}
