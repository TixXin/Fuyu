import type { RefObject } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { DirectorSceneId, DirectorStatus } from "./useOnboardingDirector";
import "./DirectorHud.css";

export function DirectorHud({
  hudRef,
  status,
  currentScene,
  onToggle,
  onNext,
}: {
  hudRef: RefObject<HTMLDivElement | null>;
  status: DirectorStatus;
  currentScene: DirectorSceneId;
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
