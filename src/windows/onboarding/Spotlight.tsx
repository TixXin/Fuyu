import type { CSSProperties } from "react";
import type { IslandSpot } from "./api";
import type { SpotlightMode } from "./flow";
import "./Spotlight.css";

const PAD = 8;
const TOP_ATTACH_THRESHOLD = 4;

export function Spotlight({ spot, mode = "pulse" }: { spot: IslandSpot | null; mode?: SpotlightMode }) {
  if (mode === "off") {
    return <div className="onboarding-spotlight onboarding-spotlight--off" aria-hidden="true" />;
  }
  if (!spot) {
    return <div className="onboarding-spotlight onboarding-spotlight--none" aria-hidden="true" />;
  }
  const detached = spot.y > TOP_ATTACH_THRESHOLD;
  const style = {
    width: spot.width + PAD * 2,
    height: spot.height + PAD * 2,
    "--spot-x": `${spot.x - PAD}px`,
    "--spot-y": `${spot.y - PAD}px`,
    "--spot-radius": `${Math.min(28, Math.min(spot.width, spot.height) / 2 + PAD)}px`,
  } as CSSProperties;
  const classes = [
    "onboarding-spotlight",
    spot.expanded ? "onboarding-spotlight--open" : "",
    mode === "calm" ? "onboarding-spotlight--calm" : "",
    detached ? "onboarding-spotlight--detached" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={classes} style={style} aria-hidden="true" />;
}
