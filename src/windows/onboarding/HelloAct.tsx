import { Hand, SlidersHorizontal, Sparkles } from "lucide-react";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { LOCALE_CODES, LOCALE_LABELS, useLocale, useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import { ActHeading } from "./ActHeading";
import { DIRECTOR_SCENE_IDS, type DirectorSceneId } from "./useOnboardingDirector";
import "./HelloAct.css";

const PREVIEW_ICONS = [Sparkles, SlidersHorizontal, Hand] as const;

export function HelloAct({
  settings,
  onSettingsChange,
  activeScene,
  onSelectScene,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  activeScene: DirectorSceneId | null;
  onSelectScene: (scene: DirectorSceneId) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.hello;
  const directorText = t.onboarding.director;
  const { locale, setLocale } = useLocale();

  const toggleJelly = () => {
    const next = settings.jellyfishStyle === "vector" ? "fine" : "vector";
    onSettingsChange({ ...settings, jellyfishStyle: next });
  };

  return (
    <>
      <div className="hello-act__director-strip">
        <span className="hello-act__director-title">{directorText.stripTitle}</span>
        <div className="hello-act__scenes">
          {DIRECTOR_SCENE_IDS.map((scene) => (
            <button
              key={scene}
              type="button"
              data-director-scene={scene}
              className={activeScene === scene ? "hello-act__scene hello-act__scene--active" : "hello-act__scene"}
              onClick={() => onSelectScene(scene)}
            >
              {directorText.scenes[scene]}
            </button>
          ))}
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
