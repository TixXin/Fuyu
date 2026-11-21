import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useFlash } from "../../../components/settings/useFlash";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { dockIslandTo, type IslandDockTarget } from "../../../lib/settings/api";
import { PositionDiagram } from "./PositionDiagram";
import { useIslandDockEdge } from "./useIslandDockEdge";
import { useIslandTaskbar } from "./useIslandTaskbar";
import { DEFAULT_SETTINGS } from "../../../lib/settings/settings";
import type { IslandMonitor, IslandSettings, MenuBarPlacement, SideHeightMode, TaskbarLook } from "../../../lib/settings/types";
import { MAX_SIDE_HEIGHT, MIN_SIDE_HEIGHT } from "../../../lib/settings/settingsLimits";

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
  const edge = useIslandDockEdge() ?? "top";
  const taskbar = useIslandTaskbar();
  const dockEdge: IslandDockTarget = taskbar.docked && edge === "bottom" ? "taskbar" : edge;
  const targets: IslandDockTarget[] = taskbar.available ? ["top", "bottom", "left", "right", "taskbar"] : ["top", "bottom", "left", "right"];
  const edgeOptions = targets.map((value) => ({ value, label: t.settings.position.edgeOptions[value] }));
  const changeEdge = (edge: IslandDockTarget) => {
    if (edge === "top") onResetPosition();
    else void dockIslandTo(edge).catch((error) => console.error("Failed to dock the island", error));
  };
  const onSide = dockEdge === "left" || dockEdge === "right";
  const sideHeightOptions = (["panel", "content", "custom"] as const).map((value) => ({ value, label: t.settings.position.sideHeightOptions[value] }));
  const menuBarOptions = (["notch", "below"] as const).map((value) => ({ value, label: t.settings.position.menuBarOptions[value] }));

  return (
    <SettingsGroup title={t.settings.position.title} footer={<SettingsFootnote text={`${t.settings.position.moveHint} ${t.settings.position.monitorHint}`} />}>
      <div className="position-layout">
        <PositionDiagram monitor={settings.islandMonitor} edge={dockEdge} marginY={settings.marginY} menuBar={isMacOS ? settings.menuBarPlacement : null} />
        <div className="position-layout__rows">
      <SettingsRow
        title={t.settings.position.edge}
        control={
          <SettingsSelect<IslandDockTarget>
            value={dockEdge}
            options={edgeOptions}
            ariaLabel={t.settings.position.edge}
            onChange={changeEdge}
          />
        }
        description={dockEdge === "taskbar" && !taskbar.placed ? t.settings.position.taskbarFallback : undefined}
      />
      {dockEdge === "taskbar" && (
        <SettingsRow
          title={t.settings.position.taskbarLook}
          control={
            <SettingsChoice<TaskbarLook>
              value={settings.taskbarLook}
              options={(["transparent", "theme"] as const).map((value) => ({ value, label: t.settings.position.taskbarLookOptions[value] }))}
              ariaLabel={t.settings.position.taskbarLook}
              onChange={(taskbarLook) => onSettingsChange({ ...settings, taskbarLook })}
            />
          }
        />
      )}
      {onSide && (
        <SettingsRow
          title={t.settings.position.sideHeight}
          control={
            <SettingsChoice<SideHeightMode>
              value={settings.sideHeightMode}
              options={sideHeightOptions}
              ariaLabel={t.settings.position.sideHeight}
              onChange={(sideHeightMode) => onSettingsChange({ ...settings, sideHeightMode })}
            />
          }
        />
      )}
      {onSide && settings.sideHeightMode === "custom" && (
        <SettingsSliderRow
          title={t.settings.position.sideHeightCustom}
          value={settings.sideHeight}
          min={MIN_SIDE_HEIGHT}
          max={MAX_SIDE_HEIGHT}
          step={10}
          format={(value) => `${Math.round(value)} px`}
          defaultValue={DEFAULT_SETTINGS.sideHeight}
          resetLabel={t.settings.layout.resetToDefault}
          onChange={(sideHeight) => onSettingsChange({ ...settings, sideHeight })}
        />
      )}
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
          <SettingsChoice<IslandMonitor>
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
            <SettingsChoice<MenuBarPlacement>
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
