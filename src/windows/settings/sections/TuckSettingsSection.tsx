import { useTranslation } from "../../../i18n";
import type { TuckHold } from "../../../i18n/sections/settings/expand";
import { isMacOS } from "../../../lib/platform";
import { SettingsAdvanced } from "../../../components/settings/SettingsAdvanced";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsMultiChoice } from "../../../components/settings/SettingsMultiChoice";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsThumbStrip } from "../../../components/settings/SettingsThumbStrip";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { DEFAULT_AUTO_TUCK_RETRACT_DELAY_MS, MAX_AUTO_TUCK_RETRACT_DELAY_MS, MIN_AUTO_TUCK_RETRACT_DELAY_MS } from "../../../lib/settings/settings";
import { TuckHintRows } from "./TuckHintRows";
import { useThumbPointer } from "./useThumbPointer";
import { TuckMock } from "./tuck/TuckMock";
import { TuckPreview } from "./tuck/TuckPreview";
import { tuckHintPaint, tuckHintRing } from "./tuck/tuckHintPaint";
import type { IslandSettings, MinimizeAction, TuckedHoverAction, TuckStyle } from "../../../lib/settings/types";
import "./TuckSettingsSection.css";

const IDLE_SECONDS = [5, 10, 15, 30, 60, 120, 300, 600];
const TUCK_STYLES = ["edge", "line", "hidden"] as const satisfies readonly TuckStyle[];
const HOLDS = ["todo", "agent", "music", "messages"] as const satisfies readonly TuckHold[];
const HOLD_KEYS = {
  todo: "autoTuckHoldTodo",
  agent: "autoTuckHoldAgent",
  music: "autoTuckHoldMusic",
  messages: "autoTuckHoldMessages",
} as const satisfies Record<TuckHold, keyof IslandSettings>;

export function TuckSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const { pointed, handlers } = useThumbPointer();
  const layout = t.settings.layout;
  const expand = t.settings.expand;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const delay = (ms: number) => (ms === 0 ? expand.instant : layout.seconds(Number((ms / 1000).toFixed(2))));
  const idleLabel = (value: number) => (value >= 60 && value % 60 === 0 ? layout.minutes(value / 60) : layout.seconds(value));
  const idleOptions = [...new Set([...IDLE_SECONDS, settings.autoTuckSeconds])]
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: idleLabel(value) }));
  const tuckedHoverActions: { value: TuckedHoverAction; label: string }[] = [
    { value: "reveal", label: expand.tuckedHoverReveal },
    { value: "expand", label: expand.tuckedHoverExpand },
  ];
  const minimizeActions: { value: MinimizeAction; label: string }[] = [
    { value: "tray", label: isMacOS ? layout.minimizeToMenuBar : layout.minimizeToTray },
    { value: "tuck", label: layout.minimizeToTop },
  ];
  const styleLabels: Record<TuckStyle, string> = { edge: expand.tuckStyleEdge, line: expand.tuckStyleLine, hidden: expand.tuckStyleHidden };
  const paint = tuckHintPaint(settings.tuckHintColor, settings);
  const hint = { style: settings.tuckHintStyle, paint, ring: tuckHintRing(settings.tuckHintColor, paint), breathe: false };

  return (
    <>
      <SettingsGroup title={expand.tuckLookTitle}>
        <TuckPreview settings={settings} label={expand.tuckPreviewLabel} tryLabel={expand.tuckTry} tryHint={expand.tuckTryHint} />
        <SettingsRow className="tuck-settings__strip-row" title={expand.tuckStyle} description={expand.tuckStyleHint}>
          <div className="tuck-settings__strip" {...handlers}>
            <SettingsThumbStrip<TuckStyle>
              options={TUCK_STYLES.map((value) => ({ value, label: styleLabels[value], hint: expand.tuckStyleHints[value] }))}
              value={settings.tuckStyle}
              ariaLabel={expand.tuckStyle}
              onChange={(tuckStyle) => update({ tuckStyle })}
              renderArt={(value) => (
                <TuckMock tuckStyle={value} hint={{ ...hint, breathe: pointed === value && settings.tuckHintBreathe }} islandColor={settings.islandBackgroundColor} scale={0.6} />
              )}
            />
          </div>
        </SettingsRow>
        {settings.tuckStyle === "hidden" && <TuckHintRows settings={settings} update={update} />}
      </SettingsGroup>

      <SettingsGroup title={expand.tuckWhenTitle}>
        <SettingsToggleRow
          title={layout.autoTuck}
          description={layout.autoTuckHint}
          checked={settings.autoTuck}
          onChange={(autoTuck) => update({ autoTuck })}
        />
        {settings.autoTuck && (
          <>
            <SettingsRow
              indent
              title={layout.autoTuckSeconds}
              control={
                <SettingsSelect
                  value={String(settings.autoTuckSeconds)}
                  options={idleOptions}
                  ariaLabel={layout.autoTuckSeconds}
                  onChange={(value) => update({ autoTuckSeconds: Number(value) })}
                />
              }
            />
            <SettingsRow indent className="tuck-settings__holds" title={expand.holds} description={expand.holdsHint}>
              <SettingsMultiChoice<TuckHold>
                values={HOLDS.filter((hold) => settings[HOLD_KEYS[hold]])}
                options={HOLDS.map((value) => ({ value, label: expand.holdChips[value] }))}
                ariaLabel={expand.holds}
                onToggle={(hold, selected) => update({ [HOLD_KEYS[hold]]: selected } as Partial<IslandSettings>)}
              />
            </SettingsRow>
            <SettingsAdvanced indent>
              <SettingsToggleRow
                indent
                title={layout.autoTuckRetract}
                checked={settings.autoTuckRetract}
                onChange={(autoTuckRetract) => update({ autoTuckRetract })}
              />
              {settings.autoTuckRetract && (
                <SettingsSliderRow
                  indent
                  title={layout.autoTuckRetractDelay}
                  value={settings.autoTuckRetractDelayMs}
                  min={MIN_AUTO_TUCK_RETRACT_DELAY_MS}
                  max={MAX_AUTO_TUCK_RETRACT_DELAY_MS}
                  step={100}
                  format={delay}
                  defaultValue={DEFAULT_AUTO_TUCK_RETRACT_DELAY_MS}
                  resetLabel={layout.resetToDefault}
                  onChange={(autoTuckRetractDelayMs) => update({ autoTuckRetractDelayMs })}
                />
              )}
            </SettingsAdvanced>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title={expand.revealTitle}>
        <SettingsRow
          title={expand.tuckedHover}
          control={
            <SettingsChoice
              value={settings.tuckedHoverAction}
              options={tuckedHoverActions}
              ariaLabel={expand.tuckedHover}
              onChange={(tuckedHoverAction) => update({ tuckedHoverAction })}
            />
          }
        />
        <SettingsToggleRow
          title={expand.revealOnMessage}
          checked={settings.revealOnMessage}
          onChange={(revealOnMessage) => update({ revealOnMessage })}
        />
        <SettingsRow
          title={layout.minimizeAction}
          description={isMacOS ? layout.minimizeHintMac : layout.minimizeHint}
          control={
            <SettingsChoice
              value={settings.minimizeAction}
              options={minimizeActions}
              ariaLabel={layout.minimizeAction}
              onChange={(minimizeAction) => update({ minimizeAction })}
            />
          }
        />
      </SettingsGroup>
    </>
  );
}
