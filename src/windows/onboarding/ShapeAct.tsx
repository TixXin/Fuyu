import { Play } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { AppearanceMode, IslandMotion, IslandSettings, JellyfishStyle, ThemeMode } from "../../lib/settings/types";
import { BUILTIN_THEME_IDS, BUILTIN_THEMES, builtinThemeInUse, withBuiltinTheme, type BuiltinThemeId } from "../../lib/theme/builtinThemes";
import { THEME_MODES } from "../../lib/theme/themeMode";
import { AccentSettingsRow } from "../settings/sections/AccentSettingsRow";
import { ActHeading } from "./ActHeading";
import { IslandFormsPicker } from "./IslandFormsPicker";
import "./ShapeAct.css";

const QUICK_MOTIONS: readonly ("pop" | "lively" | "snappy" | "soft" | "none")[] = ["pop", "lively", "snappy", "soft", "none"];

export function ShapeAct({
  settings,
  onSettingsChange,
  onPreviewMotion,
  onUserInteract,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onPreviewMotion: () => void;
  onUserInteract: () => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.shape;
  const activeBuiltin = builtinThemeInUse(settings);
  const isPixelJelly = settings.jellyfishStyle !== "vector";

  const applyTheme = (id: BuiltinThemeId) => {
    onUserInteract();
    onSettingsChange(withBuiltinTheme(settings, id));
  };

  const applyGlass = () => {
    onUserInteract();
    onSettingsChange({ ...settings, appearanceMode: "liquidGlass" });
  };

  const applyMotion = (islandMotion: IslandMotion) => {
    onUserInteract();
    onSettingsChange({ ...settings, islandMotion });
    onPreviewMotion();
  };

  const applyJelly = (style: JellyfishStyle) => {
    onUserInteract();
    onSettingsChange({ ...settings, jellyfishStyle: style });
  };

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <IslandFormsPicker settings={settings} onSettingsChange={onSettingsChange} onUserInteract={onUserInteract} />

      <div className="shape-act__section-head">
        <span className="shape-act__section-title">{text.themesTitle}</span>
      </div>
      <div className="shape-act__themes" role="radiogroup" aria-label={text.themesTitle}>
        {BUILTIN_THEME_IDS.map((id) => {
          const theme = BUILTIN_THEMES[id];
          const toneColors = theme[theme.tone];
          const chosen = activeBuiltin === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={chosen}
              data-theme-preset={id}
              className={chosen ? "shape-act__theme shape-act__theme--active" : "shape-act__theme"}
              onClick={() => applyTheme(id)}
            >
              <span className="shape-act__swatch" style={{ "--theme-fill": toneColors.islandBackgroundColor, "--theme-dot": toneColors.pulseColor } as React.CSSProperties}>
                <span className="shape-act__swatch-pill">
                  <i />
                  <b />
                </span>
              </span>
              <span className="shape-act__theme-name">{t.settings.colors.builtinNames[id]}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={settings.appearanceMode === "liquidGlass" && activeBuiltin === null}
          data-theme-preset="liquidGlass"
          className={settings.appearanceMode === "liquidGlass" && activeBuiltin === null ? "shape-act__theme shape-act__theme--active" : "shape-act__theme"}
          onClick={applyGlass}
        >
          <span className="shape-act__swatch shape-act__swatch--glass">
            <span className="shape-act__swatch-pill">
              <i />
              <b />
            </span>
          </span>
          <span className="shape-act__theme-name">{t.settings.appearance.liquidGlass}</span>
        </button>
      </div>

      <div className="shape-act__columns">
        <SettingsGroup>
          <SettingsRow
            title={text.theme}
            control={
              <SettingsChoice<ThemeMode>
                value={settings.themeMode}
                ariaLabel={text.theme}
                options={THEME_MODES.map((mode) => ({ value: mode, label: t.settings.colors.modes[mode] }))}
                onChange={(themeMode) => onSettingsChange({ ...settings, themeMode })}
              />
            }
          />
          <SettingsRow
            title={text.look}
            description={settings.appearanceMode === "liquidGlass" ? text.glassHint : undefined}
            control={
              <SettingsChoice<AppearanceMode>
                value={settings.appearanceMode}
                ariaLabel={text.look}
                options={[
                  { value: "classic", label: text.solid },
                  { value: "liquidGlass", label: t.settings.appearance.liquidGlass },
                ]}
                onChange={(appearanceMode) => onSettingsChange({ ...settings, appearanceMode })}
              />
            }
          />
          <AccentSettingsRow settings={settings} onSettingsChange={onSettingsChange} />
        </SettingsGroup>

        <div className="shape-act__side-controls">
          <div className="shape-act__box">
            <div className="shape-act__box-head">
              <span className="shape-act__section-title">{text.motionTitle}</span>
              <button className="onboarding__chip-btn" type="button" onClick={onPreviewMotion}>
                <Play size={11} aria-hidden="true" />
                {text.playMotion}
              </button>
            </div>
            <div className="shape-act__pills" role="radiogroup" aria-label={text.motionTitle}>
              {QUICK_MOTIONS.map((motion) => {
                const active = settings.islandMotion === motion;
                return (
                  <button
                    key={motion}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-motion={motion}
                    className={active ? "shape-act__pill shape-act__pill--active" : "shape-act__pill"}
                    onClick={() => applyMotion(motion)}
                  >
                    {text.motions[motion]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="shape-act__box">
            <div className="shape-act__box-head">
              <span className="shape-act__section-title">{text.jellyfishStyle}</span>
              <SettingsChoice<"vector" | "pixel">
                value={isPixelJelly ? "pixel" : "vector"}
                ariaLabel={text.jellyfishStyle}
                options={[
                  { value: "vector", label: text.jellyVector },
                  { value: "pixel", label: text.jellyPixel },
                ]}
                onChange={(choice) => applyJelly(choice === "pixel" ? "fine" : "vector")}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
