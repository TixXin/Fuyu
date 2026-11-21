import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Sun, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { getSystemLevels, listenLevelChanges, setSystemVolume, type SystemLevels } from "../api";
import "./levelsWidget.css";

const SEND_MS = 60;

function useLevels() {
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
        const base = current ?? { volume: null, muted: false, brightness: null };
        return change.kind === "volume" ? { ...base, volume: change.level, muted: change.muted } : { ...base, brightness: change.level };
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
  }, []);
  return [levels, setLevels] as const;
}

export function LevelsWidget() {
  const t = useTranslation().islandWidgets;
  const [levels, setLevels] = useLevels();
  const sent = useRef(0);
  const volume = levels?.volume ?? null;
  const brightness = levels?.brightness ?? null;
  const send = (level: number, force = false) => {
    const next = Math.min(1, Math.max(0, level));
    setLevels((current) => (current ? { ...current, volume: next, muted: false } : current));
    const now = Date.now();
    if (!force && now - sent.current < SEND_MS) return;
    sent.current = now;
    void setSystemVolume(next).catch((failure: unknown) => console.error("Failed to set the volume", failure));
  };
  const levelAt = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return 1 - (event.clientY - box.top) / box.height;
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (volume === null) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    send(levelAt(event), true);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) send(levelAt(event));
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) send(levelAt(event), true);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (volume === null) return;
    const step = event.key === "ArrowUp" || event.key === "ArrowRight" ? 0.05 : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -0.05 : 0;
    if (!step) return;
    event.preventDefault();
    send(volume + step, true);
  };
  const volumePercent = Math.round((volume ?? 0) * 100);
  const brightnessPercent = Math.round((brightness ?? 0) * 100);
  const VolumeIcon = levels?.muted || volume === 0 ? VolumeX : Volume2;
  return (
    <div className="island-widget levels-widget">
      <div
        className="levels-widget__slider"
        role="slider"
        tabIndex={volume === null ? -1 : 0}
        aria-label={t.content.volume}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volumePercent}
        aria-disabled={volume === null || undefined}
        title={volume === null ? t.content.volume : `${t.content.volume} ${volumePercent}%`}
        data-muted={levels?.muted || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <b style={{ height: `${volumePercent}%` }} />
        <VolumeIcon size={13} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div className="levels-widget__slider" role="meter" aria-label={t.content.brightness} aria-valuemin={0} aria-valuemax={100} aria-valuenow={brightnessPercent} title={brightness === null ? t.content.noBrightness : `${t.content.brightness} ${brightnessPercent}%`} data-readonly="true" data-off={brightness === null || undefined}>
        <b style={{ height: `${brightnessPercent}%` }} />
        <Sun size={13} strokeWidth={2.2} aria-hidden="true" />
      </div>
    </div>
  );
}
