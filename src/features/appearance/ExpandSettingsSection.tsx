import { useTranslation } from "../../i18n";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import {
  DEFAULT_HOVER_COLLAPSE_DELAY_MS,
  DEFAULT_HOVER_EXPAND_DELAY_MS,
  DEFAULT_HOVER_SWITCH_DELAY_MS,
  MAX_HOVER_COLLAPSE_DELAY_MS,
  MAX_HOVER_EXPAND_DELAY_MS,
  MAX_HOVER_SWITCH_DELAY_MS,
  MIN_HOVER_COLLAPSE_DELAY_MS,
  MIN_HOVER_EXPAND_DELAY_MS,
  MIN_HOVER_SWITCH_DELAY_MS,
} from "./settings";
import { IslandGlyph } from "./IslandGlyph";
import { IslandMotionRow } from "./IslandMotionRow";
import type { ExpandTrigger, IslandSettings } from "./types";

export function ExpandSettingsSection({
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

  return (
    <>
      <SettingsGroup title={expand.title}>
        <SettingsRow title={expand.trigger}>
          <SettingsChoiceCards<ExpandTrigger>
            value={settings.expandTrigger}
            ariaLabel={expand.trigger}
            options={[
              { value: "click", label: expand.click, hint: expand.clickHint, art: <IslandGlyph state="collapsed" pointer="click" /> },
              { value: "hover", label: expand.hover, hint: expand.hoverHint, art: <IslandGlyph state="expanded" pointer /> },
            ]}
            onChange={(expandTrigger) => update({ expandTrigger })}
          />
        </SettingsRow>
        {settings.expandTrigger === "hover" && (
          <>
            <SettingsSliderRow
              indent
              title={expand.hoverDelay}
              value={settings.hoverExpandDelayMs}
              min={MIN_HOVER_EXPAND_DELAY_MS}
              max={MAX_HOVER_EXPAND_DELAY_MS}
              step={50}
              format={delay}
              defaultValue={DEFAULT_HOVER_EXPAND_DELAY_MS}
              resetLabel={layout.resetToDefault}
              onChange={(hoverExpandDelayMs) => update({ hoverExpandDelayMs })}
            />
            <SettingsSliderRow
              indent
              title={expand.hoverCollapseDelay}
              value={settings.hoverCollapseDelayMs}
              min={MIN_HOVER_COLLAPSE_DELAY_MS}
              max={MAX_HOVER_COLLAPSE_DELAY_MS}
              step={50}
              format={delay}
              defaultValue={DEFAULT_HOVER_COLLAPSE_DELAY_MS}
              resetLabel={layout.resetToDefault}
              onChange={(hoverCollapseDelayMs) => update({ hoverCollapseDelayMs })}
            />
          </>
        )}
        <SettingsToggleRow
          title={expand.hoverSwitchPage}
          description={expand.hoverSwitchPageHint}
          checked={settings.hoverSwitchPage}
          onChange={(hoverSwitchPage) => update({ hoverSwitchPage })}
        />
        {settings.hoverSwitchPage && (
          <SettingsSliderRow
            indent
            title={expand.hoverSwitchDelay}
            value={settings.hoverSwitchDelayMs}
            min={MIN_HOVER_SWITCH_DELAY_MS}
            max={MAX_HOVER_SWITCH_DELAY_MS}
            step={50}
            format={delay}
            defaultValue={DEFAULT_HOVER_SWITCH_DELAY_MS}
            resetLabel={layout.resetToDefault}
            onChange={(hoverSwitchDelayMs) => update({ hoverSwitchDelayMs })}
          />
        )}
      </SettingsGroup>
      <SettingsGroup title={expand.motion}>
        <IslandMotionRow value={settings.islandMotion} onChange={(islandMotion) => update({ islandMotion })} />
      </SettingsGroup>
    </>
  );
}
