import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import { dockIslandTo, type IslandDockEdge } from "./api";
import { PositionDiagram } from "./PositionDiagram";
import { useIslandDockEdge } from "./useIslandDockEdge";
import { DEFAULT_SETTINGS } from "./settings";
import type { IslandMonitor, IslandSettings, MenuBarPlacement } from "./types";

export function PositionSettingsSection({
  settings,
  onSettingsChange,
  onResetPosition,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onResetPosition: () => void;
}) {
  const t = useTranslation();
  const [done, flash] = useFlash<true>();
  const monitorOptions = (["primary", "cursor", "foreground"] as const).map((value) => ({ value, label: t.settings.position.monitorOptions[value] }));
  const dockEdge: IslandDockEdge = useIslandDockEdge() ?? "top";
  const edgeOptions = (["top", "bottom", "left", "right"] as const).map((value) => ({ value, label: t.settings.position.edgeOptions[value] }));
  const changeEdge = (edge: IslandDockEdge) => {
    if (edge === "top") onResetPosition();
    else void dockIslandTo(edge).catch((error) => console.error("Failed to dock the island", error));
  };
  const onSide = dockEdge === "left" || dockEdge === "right";
  const menuBarOptions = (["notch", "below"] as const).map((value) => ({ value, label: t.settings.position.menuBarOptions[value] }));

  return (
    <SettingsGroup title={t.settings.position.title} footer={<SettingsFootnote text={`${isMacOS ? t.settings.position.moveHintMac : t.settings.position.moveHint} ${t.settings.position.monitorHint}`} />}>
      <div className="position-layout">
        <PositionDiagram monitor={settings.islandMonitor} edge={dockEdge} marginY={settings.marginY} menuBar={isMacOS ? settings.menuBarPlacement : null} />
        <div className="position-layout__rows">
      <SettingsRow
        title={t.settings.position.edge}
        control={
          <SettingsSelect<IslandDockEdge>
            value={dockEdge}
            options={edgeOptions}
            ariaLabel={t.settings.position.edge}
            onChange={changeEdge}
          />
        }
      />
      {onSide && (
        <SettingsToggleRow
          title={t.settings.position.sideMusicCover}
          checked={settings.sideMusicCover}
          onChange={(sideMusicCover) => onSettingsChange({ ...settings, sideMusicCover })}
        />
      )}
      <SettingsRow
        title={t.settings.position.monitor}
        control={
          <SettingsSelect<IslandMonitor>
            value={settings.islandMonitor}
            options={monitorOptions}
            ariaLabel={t.settings.position.monitor}
            onChange={(islandMonitor) => onSettingsChange({ ...settings, islandMonitor })}
          />
        }
      />
      {isMacOS && (
        <SettingsRow
          title={t.settings.position.menuBar}
          searchable={false}
          control={
            <SettingsSelect<MenuBarPlacement>
              value={settings.menuBarPlacement}
              options={menuBarOptions}
              ariaLabel={t.settings.position.menuBar}
              onChange={(menuBarPlacement) => onSettingsChange({ ...settings, menuBarPlacement })}
            />
          }
        />
      )}
      <SettingsSliderRow
        title={t.settings.layout.marginY}
        value={settings.marginY}
        min={0}
        max={160}
        step={1}
        format={(value) => `${Math.round(value)} px`}
        defaultValue={DEFAULT_SETTINGS.marginY}
        resetLabel={t.settings.layout.resetToDefault}
        onChange={(marginY) => onSettingsChange({ ...settings, marginY })}
      />
      <SettingsRow
        title={t.settings.position.resetRow}
        control={
          <SettingsLinkButton onClick={() => { onResetPosition(); flash(true); }}>
            <span role="status">{done ? t.settings.position.resetDone : t.settings.position.reset}</span>
          </SettingsLinkButton>
        }
      />
        </div>
      </div>
    </SettingsGroup>
  );
}
