import type { RefObject } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { DirectorSceneId, DirectorStatus } from "./useOnboardingDirector";
import "./DirectorHud.css";

export function DirectorHud({
  hudRef,
  status,
  currentScene,
  sceneIndex,
  sceneCount,
  onToggle,
  onNext,
}: {
  hudRef: RefObject<HTMLDivElement | null>;
  status: DirectorStatus;
  currentScene: DirectorSceneId;
  sceneIndex: number;
  sceneCount: number;
  onToggle: () => void;
  onNext: () => void;
}) {
  const text = useTranslation().onboarding.director;
  const label =
    status === "playing"
      ? text.playing(text.scenes[currentScene])
      : status === "user"
        ? text.userControl
        : text.paused;

  return (
    <div className="director-hud" ref={hudRef} role="region" aria-label={text.stripTitle}>
      <span className={`director-hud__dot director-hud__dot--${status}`} aria-hidden="true" />
      <span className="director-hud__caption">{label}</span>
      {status === "playing" && sceneCount > 0 && (
        <span className="director-hud__count">
          {sceneIndex + 1}/{sceneCount}
        </span>
      )}
      <button className="director-hud__btn" type="button" onClick={onToggle}>
        {status === "playing" ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
        {status === "playing" ? text.pause : text.resume}
      </button>
      <button className="director-hud__btn" type="button" onClick={onNext}>
        <SkipForward size={11} aria-hidden="true" />
        {text.nextScene}
      </button>
    </div>
  );
}
