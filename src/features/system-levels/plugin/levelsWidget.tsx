import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Sun, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { getSystemLevels, listenLevelChanges, setSystemBrightness, setSystemVolume, type SystemLevels } from "../api";
import { LevelSlider } from "./levelSlider";
import "./levelsWidget.css";

const VOLUME_SEND_MS = 60;
const BRIGHTNESS_SEND_MS = 150;
const BRIGHTNESS_SETTLE_MS = 800;

function useLevels(brightnessHeldUntil: MutableRefObject<number>) {
  const [levels, setLevels] = useState<SystemLevels | null>(null);
  useEffect(() => {
    let alive = true;
    let stop: (() => void) | null = null;
    void getSystemLevels()
      .then((next) => {
        if (alive) setLevels(next);
      })
      .catch((failure: unknown) => console.error("Failed to read the system levels", failure));
    void listenLevelChanges((change) => {
      setLevels((current) => {
        const base = current ?? { volume: null, muted: false, brightness: null, brightnessSettable: false };
        if (change.kind === "volume") return { ...base, volume: change.level, muted: change.muted };
        return Date.now() < brightnessHeldUntil.current ? base : { ...base, brightness: change.level };
      });
    })
      .then((unlisten) => {
        if (alive) stop = unlisten;
        else unlisten();
      })
      .catch((failure: unknown) => console.error("Failed to listen for level changes", failure));
    return () => {
      alive = false;
      stop?.();
    };
  }, [brightnessHeldUntil]);
  return [levels, setLevels] as const;
}

export function LevelsWidget() {
  const t = useTranslation().islandWidgets;
  const brightnessHeldUntil = useRef(0);
  const [levels, setLevels] = useLevels(brightnessHeldUntil);
  const volume = levels?.volume ?? null;
  const brightness = levels?.brightness ?? null;
  const brightnessSettable = Boolean(levels?.brightnessSettable) && brightness !== null;
  const volumePercent = Math.round((volume ?? 0) * 100);
  const brightnessPercent = Math.round((brightness ?? 0) * 100);
  const VolumeIcon = levels?.muted || volume === 0 ? VolumeX : Volume2;
  const holdBrightness = () => {
    brightnessHeldUntil.current = Date.now() + BRIGHTNESS_SETTLE_MS;
  };
  const brightnessTitle = brightness === null ? t.system.brightnessMissing[isMacOS ? "mac" : "windows"] : brightnessSettable ? t.system.brightnessHint(brightnessPercent) : t.system.brightnessFixed(brightnessPercent);
  return (
    <div className="island-widget levels-widget">
      <LevelSlider
        level={volume}
        label={t.content.volume}
        title={volume === null ? t.content.volume : `${t.content.volume} ${volumePercent}%`}
        settable
        sendEveryMs={VOLUME_SEND_MS}
        muted={levels?.muted}
        onLevel={(next) => setLevels((current) => (current ? { ...current, volume: next, muted: false } : current))}
        onSend={(next) => void setSystemVolume(next).catch((failure: unknown) => console.error("Failed to set the volume", failure))}
      >
        <VolumeIcon size={13} strokeWidth={2.2} aria-hidden="true" />
      </LevelSlider>
      <LevelSlider
        level={brightness}
        label={t.content.brightness}
        title={brightnessTitle}
        settable={brightnessSettable}
        sendEveryMs={BRIGHTNESS_SEND_MS}
        onDragging={holdBrightness}
        onLevel={(next) => {
          holdBrightness();
          setLevels((current) => (current ? { ...current, brightness: next } : current));
        }}
        onSend={(next) => {
          holdBrightness();
          void setSystemBrightness(next).catch((failure: unknown) => console.error("Failed to set the brightness", failure));
        }}
      >
        <Sun size={13} strokeWidth={2.2} aria-hidden="true" />
      </LevelSlider>
    </div>
  );
}
