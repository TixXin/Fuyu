import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../components/settings/SettingsSliderRow";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { DEFAULT_SETTINGS, MAX_COLLAPSED_WIDTH_EXTRA, MAX_ISLAND_CORNER_RADIUS, MAX_MAX_PANEL_HEIGHT, MAX_PANEL_WIDTH, MAX_TOP_FILLET_RADIUS, MIN_COLLAPSED_WIDTH_EXTRA, MIN_ISLAND_CORNER_RADIUS, MIN_MAX_PANEL_HEIGHT, MIN_PANEL_WIDTH, MIN_TOP_FILLET_RADIUS } from "./settings";
import type { IslandCornerShape, IslandSettings } from "./types";

const scale = (value: number) => `${value.toFixed(2)}x`;
const pixels = (value: number) => `${Math.round(value)} px`;
const signedPixels = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)} px`;

type LayoutSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onPreviewIsland?: (expanded: boolean) => void;
};

function changeWith({ onSettingsChange, onPreviewIsland }: LayoutSectionProps) {
  return (next: IslandSettings, previewExpanded?: boolean) => {
    onSettingsChange(next);
    if (previewExpanded !== undefined) {
      onPreviewIsland?.(previewExpanded);
    }
  };
}

export function SizeSettingsSection(props: LayoutSectionProps) {
  const { settings } = props;
  const text = useTranslation().settings.layout;
  const change = changeWith(props);

  return (
      <>
      <SettingsGroup title={text.collapsedSizeTitle}>
        <SettingsSliderRow
          title={text.collapsedScale}
          value={settings.collapsedScale}
          min={0.75}
          max={1.4}
          step={0.01}
          format={scale}
          defaultValue={DEFAULT_SETTINGS.collapsedScale}
          resetLabel={text.resetToDefault}
          onChange={(collapsedScale) => change({ ...settings, collapsedScale }, false)}
        />
        <SettingsSliderRow
          title={text.collapsedWidthExtra}
          description={isMacOS ? text.collapsedWidthHintMac : text.collapsedWidthHint}
          value={settings.collapsedWidthExtra}
          min={MIN_COLLAPSED_WIDTH_EXTRA}
          max={MAX_COLLAPSED_WIDTH_EXTRA}
          step={1}
          format={signedPixels}
          defaultValue={DEFAULT_SETTINGS.collapsedWidthExtra}
          resetLabel={text.resetToDefault}
          onChange={(collapsedWidthExtra) => change({ ...settings, collapsedWidthExtra }, false)}
        />
      </SettingsGroup>
      <SettingsGroup title={text.expandedSizeTitle}>
        <SettingsSliderRow
          title={text.expandedScale}
          value={settings.expandedScale}
          min={0.75}
          max={1.4}
          step={0.01}
          format={scale}
          defaultValue={DEFAULT_SETTINGS.expandedScale}
          resetLabel={text.resetToDefault}
          onChange={(expandedScale) => change({ ...settings, expandedScale }, true)}
        />
        <SettingsSliderRow
          title={text.panelWidth}
          description={isMacOS ? text.panelSizeHintMac : text.panelSizeHint}
          value={settings.panelWidth}
          min={MIN_PANEL_WIDTH}
          max={MAX_PANEL_WIDTH}
          step={1}
          format={pixels}
          defaultValue={DEFAULT_SETTINGS.panelWidth}
          resetLabel={text.resetToDefault}
          onChange={(panelWidth) => change({ ...settings, panelWidth }, true)}
        />
        <SettingsSliderRow
          title={text.maxPanelHeight}
          value={settings.maxPanelHeight}
          min={MIN_MAX_PANEL_HEIGHT}
          max={MAX_MAX_PANEL_HEIGHT}
          step={1}
          format={pixels}
          defaultValue={DEFAULT_SETTINGS.maxPanelHeight}
          resetLabel={text.resetToDefault}
          onChange={(maxPanelHeight) => change({ ...settings, maxPanelHeight }, true)}
        />
      </SettingsGroup>
      </>
  );
}

export function CornerSettingsRows(props: LayoutSectionProps) {
  const { settings } = props;
  const text = useTranslation().settings.layout;
  const change = changeWith(props);
  const shapes = [
    { value: "squircle", label: text.cornerShapeSquircle },
    { value: "round", label: text.cornerShapeRound },
  ] as const;

  return (
      <>
        <SettingsRow
          title={text.islandCornerShape}
          control={
            <SettingsChoice<IslandCornerShape>
              value={settings.islandCornerShape}
              options={shapes}
              ariaLabel={text.islandCornerShape}
              onChange={(islandCornerShape) => change({ ...settings, islandCornerShape }, true)}
            />
          }
        />
        <SettingsSliderRow
          title={text.islandCornerRadius}
          value={settings.islandCornerRadius}
          min={MIN_ISLAND_CORNER_RADIUS}
          max={MAX_ISLAND_CORNER_RADIUS}
          step={1}
          format={pixels}
          defaultValue={DEFAULT_SETTINGS.islandCornerRadius}
          resetLabel={text.resetToDefault}
          onChange={(islandCornerRadius) => change({ ...settings, islandCornerRadius }, true)}
        />
        <SettingsSliderRow
          title={text.topFilletRadius}
          value={settings.topFilletRadius}
          min={MIN_TOP_FILLET_RADIUS}
          max={MAX_TOP_FILLET_RADIUS}
          step={1}
          format={pixels}
          defaultValue={DEFAULT_SETTINGS.topFilletRadius}
          resetLabel={text.resetToDefault}
          onChange={(topFilletRadius) => change({ ...settings, topFilletRadius })}
        />
      </>
  );
}
