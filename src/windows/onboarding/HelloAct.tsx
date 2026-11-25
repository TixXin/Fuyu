import { useMemo, type CSSProperties } from "react";
import { Hand, Pause, Play, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { LOCALE_CODES, LOCALE_LABELS, useLocale, useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { ActHeading } from "./ActHeading";
import { groupDirectorScenes, type DirectorSceneDef, type DirectorSceneGroup, type DirectorSceneId } from "./directorScenes";
import type { DirectorStatus } from "./useOnboardingDirector";
import "./HelloAct.css";

const PREVIEW_ICONS = [Sparkles, SlidersHorizontal, Hand] as const;

export function HelloAct({
  settings,
  onSettingsChange,
  scenes,
  status,
  activeScene,
  currentScene,
  currentDurationMs,
  runToken,
  anchorDirty,
  onSelectScene,
  onPlayGroup,
  onTogglePlay,
  onRestoreAnchor,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  scenes: readonly DirectorSceneDef[];
  status: DirectorStatus;
  activeScene: DirectorSceneId | null;
  currentScene: DirectorSceneId;
  currentDurationMs: number;
  runToken: number;
  anchorDirty: boolean;
  onSelectScene: (scene: DirectorSceneId) => void;
  onPlayGroup: (group: DirectorSceneGroup) => void;
  onTogglePlay: () => void;
  onRestoreAnchor: () => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.hello;
  const directorText = t.onboarding.director;
  const { locale, setLocale } = useLocale();
  const grouped = useMemo(() => groupDirectorScenes(scenes), [scenes]);
  const activeGroup = useMemo(() => scenes.find((item) => item.id === activeScene)?.group ?? null, [activeScene, scenes]);

  const toggleJelly = () => {
    const next = settings.jellyfishStyle === "vector" ? "fine" : "vector";
    onSettingsChange({ ...settings, jellyfishStyle: next });
  };

  return (
    <>
      <div className="hello-act__director-strip">
        <div className="hello-act__director-head">
          <div className="hello-act__director-meta">
            <span className={`hello-act__live-dot hello-act__live-dot--${status}`} aria-hidden="true" />
            <span className="hello-act__director-title">{directorText.stripTitle}</span>
            {status === "playing" && (
              <span className="hello-act__director-now">{directorText.scenes[currentScene]}</span>
            )}
          </div>
          <div className="hello-act__director-actions">
            {anchorDirty && status !== "playing" && (
              <button type="button" className="hello-act__director-ctl" onClick={onRestoreAnchor}>
                <RotateCcw size={11} aria-hidden="true" />
                {directorText.restoreAnchor}
              </button>
            )}
            <button
              type="button"
              className={status === "playing" ? "hello-act__director-ctl hello-act__director-ctl--active" : "hello-act__director-ctl"}
              onClick={onTogglePlay}
            >
              {status === "playing" ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
              {status === "playing" ? directorText.pause : directorText.playAll}
            </button>
          </div>
        </div>

        <div className="hello-act__groups">
          {grouped.map(({ group, scenes: items }) => (
            <div key={group} className="hello-act__group-row">
              <button
                type="button"
                data-director-group={group}
                className={activeGroup === group ? "hello-act__group-btn hello-act__group-btn--active" : "hello-act__group-btn"}
                onClick={() => onPlayGroup(group)}
              >
                <Play size={10} aria-hidden="true" />
                {directorText.groups[group]}
              </button>
              <div className="hello-act__scenes">
                {items.map((scene) => (
                  <button
                    key={scene.id}
                    type="button"
                    data-director-scene={scene.id}
                    className={activeScene === scene.id ? "hello-act__scene hello-act__scene--active" : "hello-act__scene"}
                    onClick={() => onSelectScene(scene.id)}
                  >
                    {directorText.scenes[scene.id]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="hello-act__progress" aria-hidden="true">
          {status === "playing" && activeScene && (
            <span
              key={`${activeScene}:${runToken}`}
              className="hello-act__progress-bar"
              style={{ "--scene-duration": `${currentDurationMs}ms` } as CSSProperties}
            />
          )}
        </div>
      </div>

      <div className="hello-act__stage">
        <div className="hello-act__visual">
          <button
            type="button"
            className="hello-act__emblem"
            aria-label={text.emblemHint}
            title={text.emblemHint}
            onClick={toggleJelly}
          >
            <JellyfishMark mood="idle" height={48} lively />
          </button>
          <div className="hello-act__visual-title">{text.emblemTitle}</div>
          <div className="hello-act__visual-hint">{text.emblemHint}</div>
          <div className="hello-act__roadmap" aria-label={text.previewLabel}>
            {text.previewItems.map((label, at) => {
              const Icon = PREVIEW_ICONS[at];
              return (
                <span key={label} className="hello-act__pill">
                  <Icon size={12} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="hello-act__main">
          <ActHeading title={text.title} lead={text.lead} />
          <SettingsGroup>
            <SettingsRow
              title={text.language}
              control={
                <SettingsChoice
                  value={locale}
                  ariaLabel={text.language}
                  options={LOCALE_CODES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
                  onChange={setLocale}
                />
              }
            />
          </SettingsGroup>
          <p className="hello-act__hint">{directorText.stripHint}</p>
        </div>
      </div>
    </>
  );
}
