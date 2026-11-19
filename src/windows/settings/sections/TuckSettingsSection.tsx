import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { SettingsAdvanced } from "../../../components/settings/SettingsAdvanced";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { DEFAULT_AUTO_TUCK_RETRACT_DELAY_MS, MAX_AUTO_TUCK_RETRACT_DELAY_MS, MIN_AUTO_TUCK_RETRACT_DELAY_MS } from "../../../lib/settings/settings";
import { IslandGlyph } from "../../../components/settings/IslandGlyph";
import type { IslandSettings, MinimizeAction, TuckedHoverAction, TuckStyle } from "../../../lib/settings/types";
import "./TuckSettingsSection.css";

const IDLE_SECONDS = [5, 10, 15, 30, 60, 120, 300, 600];

export function TuckSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
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
  const tuckStyles: { value: TuckStyle; label: string }[] = [
    { value: "edge", label: expand.tuckStyleEdge },
    { value: "line", label: expand.tuckStyleLine },
    { value: "hidden", label: expand.tuckStyleHidden },
  ];

  return (
    <>
      <div className="tuck-intro">
        <span className="tuck-intro__art" aria-hidden="true">
          <IslandGlyph state="collapsed" />
          <span className="tuck-intro__arrow">→</span>
          <IslandGlyph state="tucked" />
        </span>
        <p>{expand.tuckIntro}</p>
      </div>
      <SettingsGroup title={expand.tuckTitle}>
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
            <SettingsAdvanced indent>
              <SettingsToggleRow indent title={expand.holdTodo} description={expand.holdTodoHint} checked={settings.autoTuckHoldTodo} onChange={(autoTuckHoldTodo) => update({ autoTuckHoldTodo })} />
              <SettingsToggleRow indent title={expand.holdAgent} description={expand.holdAgentHint} checked={settings.autoTuckHoldAgent} onChange={(autoTuckHoldAgent) => update({ autoTuckHoldAgent })} />
              <SettingsToggleRow indent title={expand.holdMusic} description={expand.holdMusicHint} checked={settings.autoTuckHoldMusic} onChange={(autoTuckHoldMusic) => update({ autoTuckHoldMusic })} />
              <SettingsToggleRow indent title={expand.holdMessages} description={expand.holdMessagesHint} checked={settings.autoTuckHoldMessages} onChange={(autoTuckHoldMessages) => update({ autoTuckHoldMessages })} />
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
        <SettingsRow
          title={expand.tuckStyle}
          description={expand.tuckStyleHint}
          control={
            <SettingsChoice
              value={settings.tuckStyle}
              options={tuckStyles}
              ariaLabel={expand.tuckStyle}
              onChange={(tuckStyle) => update({ tuckStyle })}
            />
          }
        />
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
      </SettingsGroup>
    </>
  );
}
