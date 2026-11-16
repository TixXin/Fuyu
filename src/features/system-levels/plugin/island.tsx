import { Sun, Volume1, Volume2, VolumeX } from "lucide-react";
import { defineSlot, type IslandAlertMeta } from "../../plugin-kernel/slots";
import type { LevelChange } from "../api";
import { LevelPopup } from "../LevelPopup";

type AlertSources = { levelPopup: LevelChange | null };

const alertSlot = defineSlot<AlertSources, IslandAlertMeta<AlertSources>>("island.alert/v1");

function levelMuted(change: LevelChange) {
  return change.kind === "volume" && (change.muted || Math.round(change.level * 100) === 0);
}

function LevelAlertLeading({ levelPopup }: AlertSources) {
  if (!levelPopup) return null;
  const percent = Math.round(levelPopup.level * 100);
  const Icon = levelPopup.kind === "brightness" ? Sun : levelMuted(levelPopup) ? VolumeX : percent < 50 ? Volume1 : Volume2;
  return (
    <span className={`notch-alert__icon level-popup level-popup--${levelPopup.kind}`} aria-hidden="true">
      <Icon className="level-popup__icon" size={16} strokeWidth={2.2} />
    </span>
  );
}

function LevelAlertTrailing({ levelPopup }: AlertSources) {
  return levelPopup ? <span className="notch-alert__value notch-alert__level"><LevelPopup change={levelPopup} /></span> : null;
}

alertSlot.add({ id: "level", order: 30, active: ({ levelPopup }) => Boolean(levelPopup), component: LevelAlertLeading, trailing: LevelAlertTrailing });
