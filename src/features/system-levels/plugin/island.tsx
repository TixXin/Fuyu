import { Sun, Volume1, Volume2, VolumeX } from "lucide-react";
import { defineSlot, type IslandAlertMeta } from "../../plugin-kernel/slots";
import type { LevelChange } from "../api";
import { LevelPopup } from "../LevelPopup";
import { levelState } from "./islandState";
import { OWNER } from "./owner.ts";

const alertSlot = defineSlot<object, IslandAlertMeta<object>>("island.alert/v1");

function levelMuted(change: LevelChange) {
  return change.kind === "volume" && (change.muted || Math.round(change.level * 100) === 0);
}

function LevelAlertLeading() {
  const levelPopup = levelState.use();
  if (!levelPopup) return null;
  const percent = Math.round(levelPopup.level * 100);
  const Icon = levelPopup.kind === "brightness" ? Sun : levelMuted(levelPopup) ? VolumeX : percent < 50 ? Volume1 : Volume2;
  return (
    <span className={`notch-alert__icon level-popup level-popup--${levelPopup.kind}`} aria-hidden="true">
      <Icon className="level-popup__icon" size={16} strokeWidth={2.2} />
    </span>
  );
}

function LevelAlertTrailing() {
  const levelPopup = levelState.use();
  return levelPopup ? <span className="notch-alert__value notch-alert__level"><LevelPopup change={levelPopup} /></span> : null;
}

function LevelAlertBody() {
  const levelPopup = levelState.use();
  return levelPopup ? <LevelPopup change={levelPopup} /> : null;
}

alertSlot.add({ id: "level", order: 30, component: LevelAlertLeading, trailing: LevelAlertTrailing, popup: LevelAlertBody }, OWNER);
