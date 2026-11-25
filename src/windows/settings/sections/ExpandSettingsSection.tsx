import { useTranslation } from "../../../i18n";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsChoiceCards } from "../../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
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
} from "../../../lib/settings/settings";
import { IslandGlyph } from "../../../components/settings/IslandGlyph";
import { IslandMotionRow } from "./IslandMotionRow";
import { IslandHoverRow } from "./IslandHoverRow";
import { WidgetEntranceRow } from "./WidgetEntranceRow";
import { PageSwitchGroup } from "./PageSwitchGroup";
import type { ExpandTrigger, IslandSettings } from "../../../lib/settings/types";

export function ExpandSettingsSection({
  settings,
  onSettingsChange,
  onOpenPageKeys,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPageKeys?: () => void;
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
              { value: "preview", label: expand.preview, hint: expand.previewHint, art: <IslandGlyph state="collapsed" pointer /> },
            ]}
            onChange={(expandTrigger) => update({ expandTrigger })}
          />
        </SettingsRow>
        {(settings.expandTrigger === "hover" || settings.expandTrigger === "preview") && (
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
        )}
        {settings.expandTrigger === "preview" && (
          <SettingsRow
            indent
            title={expand.previewAutoExpand}
            description={expand.previewAutoExpandHint}
            control={
              <SettingsChoice<string>
                value={String(settings.previewAutoExpandMs)}
                ariaLabel={expand.previewAutoExpand}
                options={[
                  { value: "0", label: expand.previewAutoExpandOff },
                  { value: "1000", label: layout.seconds(1) },
                  { value: "1500", label: layout.seconds(1.5) },
                  { value: "2500", label: layout.seconds(2.5) },
                ]}
                onChange={(value) => update({ previewAutoExpandMs: Number(value) })}
              />
            }
          />
        )}
        {(settings.expandTrigger === "click" || settings.expandTrigger === "preview") && (
          <SettingsToggleRow
            indent
            title={expand.clickCollapseOnLeave}
            description={expand.clickCollapseOnLeaveHint}
            checked={settings.clickCollapseOnLeave}
            onChange={(clickCollapseOnLeave) => update({ clickCollapseOnLeave })}
          />
        )}
        {(settings.expandTrigger === "hover" || settings.clickCollapseOnLeave) && (
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
        <SettingsToggleRow
          title={expand.wheelSwitchPage}
          description={expand.wheelSwitchPageHint}
          checked={settings.wheelSwitchPage}
          onChange={(wheelSwitchPage) => update({ wheelSwitchPage })}
        />
        {onOpenPageKeys && (
          <SettingsRow
            searchable={false}
            title={expand.pageKeys}
            description={expand.pageKeysHint}
            control={<SettingsLinkButton onClick={onOpenPageKeys}>{expand.pageKeysOpen}</SettingsLinkButton>}
          />
        )}
      </SettingsGroup>
      <SettingsGroup title={expand.motion}>
        <IslandMotionRow
          value={settings.islandMotion}
          bounce={settings.islandBounce}
          showBounce={settings.islandMotion === "pop"}
          islandColor={settings.islandBackgroundColor}
          onChange={(islandMotion) => update({ islandMotion })}
          onBounceChange={(islandBounce) => update({ islandBounce })}
        />
        <IslandHoverRow value={settings.islandHover} bounce={settings.islandBounce} islandColor={settings.islandBackgroundColor} onChange={(islandHover) => update({ islandHover })} />
        <WidgetEntranceRow value={settings.widgetEntrance} onChange={(widgetEntrance) => update({ widgetEntrance })} />
        <SettingsToggleRow
          title={expand.widgetData}
          description={expand.widgetDataHint}
          checked={settings.widgetDataMotion}
          onChange={(widgetDataMotion) => update({ widgetDataMotion })}
        />
      </SettingsGroup>
      <PageSwitchGroup settings={settings} update={update} />
    </>
  );
}
