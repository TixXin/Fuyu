import { SettingsAdvanced } from "../../../components/settings/SettingsAdvanced";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsColor } from "../../../components/settings/SettingsColor";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { GLASS_STYLE_PRESETS, glassPalette } from "../../../lib/theme/glassPalette";
import { GLASS_LOOK_VALUES, GLASS_LOOKS, glassLookOf, type GlassLookId } from "../../../lib/theme/glassLooks";
import {
  DEFAULT_GLASS_SETTINGS,
  GLASS_BACKDROPS,
  GLASS_COLOR_SOURCES,
  GLASS_FLOW_WHEN,
  GLASS_MORPHS,
  GLASS_STYLES,
  type GlassSettingValues,
} from "../../../lib/settings/glassSettings";
import { DEFAULT_SETTINGS } from "../../../lib/settings/settings";
import { glassFallbackNote } from "./glassFallbackNote";
import { useIslandGlassStatus } from "./useIslandGlassStatus";
import type { IslandSettings } from "../../../lib/settings/types";

const percent = (value: number) => `${Math.round(value)}%`;
const COLOR_KEYS = ["glassColor1", "glassColor2", "glassColor3"] as const;

export function GlassSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.appearance.glass;
  const resetLabel = t.settings.layout.resetToDefault;
  const glassStatus = useIslandGlassStatus();
  if (settings.appearanceMode !== "liquidGlass") return null;

  const set = (patch: Partial<GlassSettingValues> & Partial<Pick<IslandSettings, "glassIntensity">>) => onSettingsChange({ ...settings, ...patch });
  const derived = glassPalette({
    settings: { ...settings, glassColorSource: "accent", glassContrastGuard: false },
    accent: settings.accentMode === "pick" ? settings.accentColor : null,
    cover: null,
    background: settings.islandBackgroundColor,
  });

  const look = glassLookOf(settings) ?? "custom";
  const lookOptions = [...GLASS_LOOKS, ...(look === "custom" ? ["custom" as const] : [])].map((value) => ({ value, label: text.looks[value] }));
  const backdropDescription = settings.glassBackdrop === "wallpaper"
    ? text.backdropHint
    : settings.glassBackdrop === "native"
      ? isMacOS ? text.nativeHintMac : text.nativeHintWindows
      : undefined;
  const fallback = glassFallbackNote(settings.glassBackdrop, glassStatus);
  const showFrostControls = settings.glassBackdrop === "wallpaper" || (settings.glassBackdrop === "native" && !isMacOS);

  return (
    <>
      <SettingsGroup
        title={text.title}
        action={
          <SettingsLinkButton onClick={() => set({ ...DEFAULT_GLASS_SETTINGS, glassIntensity: DEFAULT_SETTINGS.glassIntensity })}>
            {text.reset}
          </SettingsLinkButton>
        }
      >
        <SettingsRow
          title={text.look}
          control={
            <SettingsSelect<GlassLookId | "custom">
              value={look}
              options={lookOptions}
              ariaLabel={text.look}
              onChange={(next) => { if (next !== "custom") set(GLASS_LOOK_VALUES[next]); }}
            />
          }
        />
        <SettingsRow
          title={text.style}
          description={settings.glassStyle === "shader" ? text.shaderHint : undefined}
          control={
            <SettingsChoice
              value={settings.glassStyle}
              options={GLASS_STYLES.map((value) => ({ value, label: text.styles[value] }))}
              ariaLabel={text.style}
              onChange={(glassStyle) => set({ glassStyle, ...GLASS_STYLE_PRESETS[glassStyle] })}
            />
          }
        />
        <SettingsSliderRow
          title={t.settings.appearance.glassStrength}
          value={settings.glassIntensity}
          min={0}
          max={100}
          step={1}
          format={percent}
          defaultValue={DEFAULT_SETTINGS.glassIntensity}
          resetLabel={resetLabel}
          onChange={(glassIntensity) => set({ glassIntensity })}
        />
      </SettingsGroup>

      <SettingsGroup title={text.refractionTitle}>
        <SettingsRow
          title={text.backdrop}
          description={backdropDescription}
          control={
            <SettingsChoice
              value={settings.glassBackdrop}
              options={GLASS_BACKDROPS.map((value) => ({ value, label: text.backdrops[value] }))}
              ariaLabel={text.backdrop}
              onChange={(glassBackdrop) => set(glassBackdrop !== "none" ? { glassBackdrop, glassIntensity: Math.min(settings.glassIntensity, 40) } : { glassBackdrop })}
            />
          }
        >
          {fallback && (
            <span className="settings-row__description" role="status">
              {text.fallbackShown[fallback.shown]}{text.fallbackReasons[fallback.reason]}
            </span>
          )}
        </SettingsRow>
        <SettingsRow
          title={text.colorSource}
          description={settings.glassColorSource === "cover" ? text.coverHint : undefined}
          control={
            <SettingsChoice
              value={settings.glassColorSource}
              options={GLASS_COLOR_SOURCES.map((value) => ({ value, label: text.colorSources[value] }))}
              ariaLabel={text.colorSource}
              onChange={(glassColorSource) => set({ glassColorSource })}
            />
          }
        />
        {settings.glassColorSource === "custom" && COLOR_KEYS.map((key, index) => (
          <SettingsRow
            key={key}
            title={text.color(index + 1)}
            indent
            control={
              <SettingsColor
                value={settings[key] || derived[index]}
                ariaLabel={text.color(index + 1)}
                onChange={(color) => set({ [key]: color })}
              />
            }
          />
        ))}
        <SettingsSliderRow
          title={text.colorStrength}
          value={settings.glassColorStrength}
          min={0}
          max={100}
          step={1}
          format={percent}
          defaultValue={DEFAULT_GLASS_SETTINGS.glassColorStrength}
          resetLabel={resetLabel}
          onChange={(glassColorStrength) => set({ glassColorStrength })}
        />
        {showFrostControls && (
          <SettingsAdvanced>
            <SettingsSliderRow
              title={text.blur}
              value={settings.glassBlur}
              min={0}
              max={60}
              step={1}
              format={(value) => `${value} px`}
              defaultValue={DEFAULT_GLASS_SETTINGS.glassBlur}
              resetLabel={resetLabel}
              onChange={(glassBlur) => set({ glassBlur })}
            />
            <SettingsSliderRow
              title={text.saturation}
              value={settings.glassSaturation}
              min={100}
              max={250}
              step={5}
              format={percent}
              defaultValue={DEFAULT_GLASS_SETTINGS.glassSaturation}
              resetLabel={resetLabel}
              onChange={(glassSaturation) => set({ glassSaturation })}
            />
            <SettingsSliderRow
              title={text.noise}
              value={settings.glassNoise}
              min={0}
              max={12}
              step={1}
              format={percent}
              defaultValue={DEFAULT_GLASS_SETTINGS.glassNoise}
              resetLabel={resetLabel}
              onChange={(glassNoise) => set({ glassNoise })}
            />
          </SettingsAdvanced>
        )}
      </SettingsGroup>

      <SettingsGroup title={text.detailsTitle} footer={<SettingsFootnote text={text.pauseHint} />}>
        <SettingsSliderRow
          title={text.flowSpeed}
          value={settings.glassFlowSpeed}
          min={0}
          max={200}
          step={5}
          format={(value) => (value === 0 ? text.still : percent(value))}
          defaultValue={DEFAULT_GLASS_SETTINGS.glassFlowSpeed}
          resetLabel={resetLabel}
          onChange={(glassFlowSpeed) => set({ glassFlowSpeed })}
        />
        <SettingsRow
          title={text.morph}
          control={
            <SettingsChoice
              value={settings.glassMorph}
              options={GLASS_MORPHS.map((value) => ({ value, label: text.morphs[value] }))}
              ariaLabel={text.morph}
              onChange={(glassMorph) => set({ glassMorph })}
            />
          }
        />
        <SettingsAdvanced>
          <SettingsSliderRow
            title={text.blobScale}
            value={settings.glassBlobScale}
            min={60}
            max={160}
            step={5}
            format={percent}
            defaultValue={DEFAULT_GLASS_SETTINGS.glassBlobScale}
            resetLabel={resetLabel}
            onChange={(glassBlobScale) => set({ glassBlobScale })}
          />
          <SettingsRow
            title={text.flowWhen}
            control={
              <SettingsChoice
                value={settings.glassFlowWhen}
                options={GLASS_FLOW_WHEN.map((value) => ({ value, label: text.flowWhens[value] }))}
                ariaLabel={text.flowWhen}
                onChange={(glassFlowWhen) => set({ glassFlowWhen })}
              />
            }
          />
          <SettingsToggleRow title={text.rim} checked={settings.glassRim} onChange={(glassRim) => set({ glassRim })} />
          {settings.glassRim && (
            <SettingsSliderRow
              title={text.rimWidth}
              value={settings.glassRimWidth}
              min={1}
              max={3}
              step={0.5}
              format={(value) => `${value} px`}
              defaultValue={DEFAULT_GLASS_SETTINGS.glassRimWidth}
              resetLabel={resetLabel}
              indent
              onChange={(glassRimWidth) => set({ glassRimWidth })}
            />
          )}
          <SettingsToggleRow title={text.sheen} checked={settings.glassSheen} onChange={(glassSheen) => set({ glassSheen })} />
          <SettingsToggleRow
            title={text.specular}
            description={text.specularHint}
            checked={settings.glassSpecular}
            onChange={(glassSpecular) => set({ glassSpecular })}
          />
          <SettingsToggleRow
            title={text.contrastGuard}
            description={settings.glassContrastGuard ? text.contrastGuardHint : text.contrastGuardOff}
            checked={settings.glassContrastGuard}
            onChange={(glassContrastGuard) => set({ glassContrastGuard })}
          />
        </SettingsAdvanced>
      </SettingsGroup>
    </>
  );
}
