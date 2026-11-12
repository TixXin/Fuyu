import type { CSSProperties } from "react";
import type { IslandSpot } from "./api";
import "./Spotlight.css";

const PAD = 8;

export function Spotlight({ spot }: { spot: IslandSpot | null }) {
  if (!spot) return <div className="onboarding-spotlight onboarding-spotlight--none" aria-hidden="true" />;
  const style = {
    left: spot.x - PAD,
    top: spot.y - PAD,
    width: spot.width + PAD * 2,
    height: spot.height + PAD * 2,
    "--spot-radius": `${Math.min(28, (spot.height + PAD * 2) / 2)}px`,
  } as CSSProperties;
  return <div className={spot.expanded ? "onboarding-spotlight onboarding-spotlight--open" : "onboarding-spotlight"} style={style} aria-hidden="true" />;
}
