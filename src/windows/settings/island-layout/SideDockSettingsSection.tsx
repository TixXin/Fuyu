import { useTranslation } from "../../../i18n";
import type { IslandPagesLayout } from "../../../lib/settings/islandPages";
import {
  handleRadiusFor,
  innerRadiusFor,
  SIDE_DOCK_LIMITS,
  type SideDocksSettings,
} from "../../../lib/settings/sideDocks";
import { useIslandSettings } from "../../../lib/settings/useIslandSettings";
import { useSideDocks } from "../../../lib/settings/useSideDocks";
import { surfaceThemeColors } from "../../../lib/theme/themeMode";
import { useResolvedTheme } from "../../../lib/theme/useResolvedTheme";
import { isLightIsland } from "../../../utils/color";
import { SideDockMonitorStage } from "./SideDockMonitorStage";
import { SideDockSpatialBoard } from "./SideDockSpatialBoard";
import type { IslandPageRow } from "./useIslandPageRows";
import "./SideDockSettings.css";

type SideDockSettingsSectionProps = {
  rows: readonly IslandPageRow[];
  layout: IslandPagesLayout;
  save: (next: IslandPagesLayout) => void;
};

const RADIUS_PRESETS = [
  { value: 8, key: "sharp" },
  { value: 14, key: "balanced" },
  { value: 18, key: "soft" },
] as const;

export function SideDockSettingsSection({ rows, layout, save }: SideDockSettingsSectionProps) {
  const text = useTranslation().settings.islandPages.sideDocks;
  const [storedIsland] = useIslandSettings();
  const islandSettings = useResolvedTheme(storedIsland);
  const { settings: sideDocks, save: saveSideDocks } = useSideDocks();

  const patch = (partial: Partial<SideDocksSettings>) => saveSideDocks({ ...sideDocks, ...partial });

  const modeKey = sideDocks.stages === 2 ? "two" : sideDocks.autoDrawer === "hover-item" ? "three-hover" : "three-auto";
  const navKey = sideDocks.headerStyle === "minimal" ? "minimal" : sideDocks.headerStyle === "icons" ? "icons" : "full";
  const twoStage = sideDocks.stages === 2;
  const clickOnly = sideDocks.trigger === "click";
  const panelLook = surfaceThemeColors(islandSettings, "panel");
  const mainToneLabel = isLightIsland(panelLook.islandBackgroundColor) ? text.fine.light : text.fine.dark;
  const mainMaterialLabel = islandSettings.appearanceMode === "liquidGlass" ? text.fine.glass : text.fine.solid;

  return (
    <section className="sd-section">
      <SideDockSpatialBoard
        rows={rows}
        layout={layout}
        saveLayout={save}
        sideDocks={sideDocks}
        saveSideDocks={saveSideDocks}
      />

      <SideDockMonitorStage sideDocks={sideDocks} saveSideDocks={saveSideDocks} />

      <div className="sd-block">
        <div className="sd-block__head">
          <div>
            <h4 className="sd-block__subtitle">{text.mode.title}</h4>
            <p className="sd-block__hint">{text.mode.hint}</p>
          </div>
        </div>
        <div className="sd-cards">
          <button
            type="button"
            className="sd-vcard"
            data-on={modeKey === "three-auto"}
            onClick={() => patch({ stages: 3, autoDrawer: "auto" })}
          >
            <div className="sd-vcard__art" aria-hidden="true">
              <div className="sd-art-drawer"><i /><i /></div>
              <div className="sd-art-strip"><i /><i /><i /></div>
            </div>
            <span className="sd-vcard__title">
              {text.mode.threeAuto}
              <span className="sd-badge">{text.mode.recommended}</span>
            </span>
            <span className="sd-vcard__desc">{text.mode.threeAutoDesc}</span>
          </button>

          <button
            type="button"
            className="sd-vcard"
            data-on={modeKey === "three-hover"}
            onClick={() => patch({ stages: 3, autoDrawer: "hover-item" })}
          >
            <div className="sd-vcard__art" aria-hidden="true">
              <div className="sd-art-drawer sd-art-drawer--muted"><i /></div>
              <div className="sd-art-strip"><i /><i /><i /></div>
            </div>
            <span className="sd-vcard__title">{text.mode.threeHover}</span>
            <span className="sd-vcard__desc">{text.mode.threeHoverDesc}</span>
          </button>

          <button
            type="button"
            className="sd-vcard"
            data-on={modeKey === "two"}
            onClick={() => patch({ stages: 2, autoDrawer: "auto" })}
          >
            <div className="sd-vcard__art sd-vcard__art--flush" aria-hidden="true">
              <div className="sd-art-drawer sd-art-drawer--wide"><i /><i /></div>
            </div>
            <span className="sd-vcard__title">{text.mode.twoDirect}</span>
            <span className="sd-vcard__desc">{text.mode.twoDirectDesc}</span>
          </button>
        </div>
      </div>

      <div className="sd-block">
        <div className="sd-block__head">
          <h4 className="sd-block__subtitle">{text.nav.title}</h4>
        </div>
        <div className="sd-cards">
          <button
            type="button"
            className="sd-vcard"
            data-on={navKey === "full"}
            onClick={() => patch({ stripStyle: "label", headerStyle: "full" })}
          >
            <span className="sd-vcard__title">{text.nav.full}</span>
            <span className="sd-vcard__desc">{text.nav.fullDesc}</span>
          </button>
          <button
            type="button"
            className="sd-vcard"
            data-on={navKey === "minimal"}
            onClick={() => patch({ stripStyle: "icon", headerStyle: "minimal" })}
          >
            <span className="sd-vcard__title">{text.nav.minimal}</span>
            <span className="sd-vcard__desc">{text.nav.minimalDesc}</span>
          </button>
          <button
            type="button"
            className="sd-vcard"
            data-on={navKey === "icons"}
            onClick={() => patch({ stripStyle: "label", headerStyle: "icons" })}
          >
            <span className="sd-vcard__title">{text.nav.icons}</span>
            <span className="sd-vcard__desc">{text.nav.iconsDesc}</span>
          </button>
        </div>
      </div>

      <div className="sd-block">
        <div className="sd-block__head">
          <h4 className="sd-block__subtitle">{text.radius.title}</h4>
          <span className="sd-block__hint">
            {text.radius.summary(sideDocks.outerRadius, innerRadiusFor(sideDocks.outerRadius), handleRadiusFor(sideDocks.outerRadius))}
          </span>
        </div>
        <div className="sd-cards sd-cards--four">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className="sd-vcard"
              data-on={sideDocks.outerRadius === preset.value}
              onClick={() => patch({ outerRadius: preset.value })}
            >
              <div className="sd-vcard__art" aria-hidden="true">
                <div className="sd-art-corner" style={{ borderTopLeftRadius: `${preset.value}px` }} />
              </div>
              <span className="sd-vcard__title">{text.radius[preset.key]}</span>
            </button>
          ))}
          <div className="sd-vcard sd-vcard--static">
            <span className="sd-vcard__title">{text.radius.custom}</span>
            <div className="sd-range">
              <input
                type="range"
                min={SIDE_DOCK_LIMITS.outerRadius[0]}
                max={SIDE_DOCK_LIMITS.outerRadius[1]}
                step={1}
                value={sideDocks.outerRadius}
                aria-label={text.radius.title}
                onChange={(event) => patch({ outerRadius: Number(event.target.value) })}
              />
              <span>{sideDocks.outerRadius}px</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sd-block">
        <div className="sd-block__head">
          <div>
            <h4 className="sd-block__subtitle">{text.appearance.title}</h4>
            <p className="sd-block__hint">{text.appearance.hint}</p>
          </div>
          <div className="sd-seg">
            <button
              type="button"
              className="sd-seg__btn"
              data-on={sideDocks.appearance === "follow"}
              onClick={() => patch({ appearance: "follow" })}
            >
              {text.appearance.follow}
            </button>
            <button
              type="button"
              className="sd-seg__btn"
              data-on={sideDocks.appearance === "custom"}
              onClick={() => patch({ appearance: "custom" })}
            >
              {text.appearance.custom}
            </button>
          </div>
        </div>
        {sideDocks.appearance === "follow" ? (
          <div className="sd-appearance-summary">
            {text.appearance.followSummary(mainToneLabel, mainMaterialLabel, islandSettings.opacity)}
          </div>
        ) : (
          <div className="sd-fine-grid">
            <div className="sd-fine-row">
              <span>{text.fine.theme}</span>
              <div className="sd-seg">
                <button type="button" className="sd-seg__btn" data-on={sideDocks.theme === "dark"} onClick={() => patch({ theme: "dark" })}>{text.fine.dark}</button>
                <button type="button" className="sd-seg__btn" data-on={sideDocks.theme === "light"} onClick={() => patch({ theme: "light" })}>{text.fine.light}</button>
              </div>
            </div>
            <div className="sd-fine-row">
              <span>{text.fine.material}</span>
              <div className="sd-seg">
                <button type="button" className="sd-seg__btn" data-on={sideDocks.material === "glass"} onClick={() => patch({ material: "glass" })}>{text.fine.glass}</button>
                <button type="button" className="sd-seg__btn" data-on={sideDocks.material === "solid"} onClick={() => patch({ material: "solid" })}>{text.fine.solid}</button>
              </div>
            </div>
            {sideDocks.material === "glass" && (
              <div className="sd-fine-row">
                <span>{text.appearance.glassOpacity}</span>
                <div className="sd-range">
                  <input type="range" min={SIDE_DOCK_LIMITS.surfaceOpacity[0]} max={SIDE_DOCK_LIMITS.surfaceOpacity[1]} step={5} value={sideDocks.surfaceOpacity} aria-label={text.appearance.glassOpacity} onChange={(event) => patch({ surfaceOpacity: Number(event.target.value) })} />
                  <span>{sideDocks.surfaceOpacity}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sd-block">
        <div className="sd-block__head">
          <h4 className="sd-block__subtitle">{text.fine.title}</h4>
        </div>
        <div className="sd-fine-grid">
          <div className="sd-fine-row">
            <span>{text.fine.trigger}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" data-on={sideDocks.trigger === "hover"} onClick={() => patch({ trigger: "hover" })}>{text.fine.hover}</button>
              <button type="button" className="sd-seg__btn" data-on={sideDocks.trigger === "click"} onClick={() => patch({ trigger: "click" })}>{text.fine.click}</button>
            </div>
          </div>
          <div className="sd-fine-row" data-disabled={twoStage}>
            <span>{text.fine.stripStyle}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" disabled={twoStage} data-on={sideDocks.stripStyle === "label"} onClick={() => patch({ stripStyle: "label" })}>{text.fine.stripLabel}</button>
              <button type="button" className="sd-seg__btn" disabled={twoStage} data-on={sideDocks.stripStyle === "icon"} onClick={() => patch({ stripStyle: "icon" })}>{text.fine.stripIcon}</button>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.density}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" data-on={sideDocks.density === "cozy"} onClick={() => patch({ density: "cozy" })}>{text.fine.cozy}</button>
              <button type="button" className="sd-seg__btn" data-on={sideDocks.density === "compact"} onClick={() => patch({ density: "compact" })}>{text.fine.compact}</button>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.handleDot}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" data-on={sideDocks.handleDot} onClick={() => patch({ handleDot: true })}>{text.zones.enabled}</button>
              <button type="button" className="sd-seg__btn" data-on={!sideDocks.handleDot} onClick={() => patch({ handleDot: false })}>{text.zones.disabled}</button>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.drawerWidth}</span>
            <div className="sd-range">
              <input type="range" min={SIDE_DOCK_LIMITS.drawerWidth[0]} max={SIDE_DOCK_LIMITS.drawerWidth[1]} step={10} value={sideDocks.drawerWidth} aria-label={text.fine.drawerWidth} onChange={(event) => patch({ drawerWidth: Number(event.target.value) })} />
              <span>{sideDocks.drawerWidth}px</span>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.drawerHeight}</span>
            <div className="sd-range">
              <input type="range" min={SIDE_DOCK_LIMITS.drawerHeight[0]} max={SIDE_DOCK_LIMITS.drawerHeight[1]} step={10} value={sideDocks.drawerHeight} aria-label={text.fine.drawerHeight} onChange={(event) => patch({ drawerHeight: Number(event.target.value) })} />
              <span>{sideDocks.drawerHeight}px</span>
            </div>
          </div>
          <div className="sd-fine-row" data-disabled={clickOnly}>
            <span>{text.fine.hoverDelay}</span>
            <div className="sd-range">
              <input type="range" disabled={clickOnly} min={SIDE_DOCK_LIMITS.hoverDelayMs[0]} max={SIDE_DOCK_LIMITS.hoverDelayMs[1]} step={20} value={sideDocks.hoverDelayMs} aria-label={text.fine.hoverDelay} onChange={(event) => patch({ hoverDelayMs: Number(event.target.value) })} />
              <span>{sideDocks.hoverDelayMs}ms</span>
            </div>
          </div>
          <div className="sd-fine-row" data-disabled={clickOnly}>
            <span>{text.fine.leaveDelay}</span>
            <div className="sd-range">
              <input type="range" disabled={clickOnly} min={SIDE_DOCK_LIMITS.leaveDelayMs[0]} max={SIDE_DOCK_LIMITS.leaveDelayMs[1]} step={30} value={sideDocks.leaveDelayMs} aria-label={text.fine.leaveDelay} onChange={(event) => patch({ leaveDelayMs: Number(event.target.value) })} />
              <span>{sideDocks.leaveDelayMs}ms</span>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.handleWidth}</span>
            <div className="sd-range">
              <input type="range" min={SIDE_DOCK_LIMITS.handleWidth[0]} max={SIDE_DOCK_LIMITS.handleWidth[1]} step={1} value={sideDocks.handleWidth} aria-label={text.fine.handleWidth} onChange={(event) => patch({ handleWidth: Number(event.target.value) })} />
              <span>{sideDocks.handleWidth}px</span>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.handleHeight}</span>
            <div className="sd-range">
              <input type="range" min={SIDE_DOCK_LIMITS.handleHeight[0]} max={SIDE_DOCK_LIMITS.handleHeight[1]} step={4} value={sideDocks.handleHeight} aria-label={text.fine.handleHeight} onChange={(event) => patch({ handleHeight: Number(event.target.value) })} />
              <span>{sideDocks.handleHeight}px</span>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.handleOpacity}</span>
            <div className="sd-range">
              <input type="range" min={SIDE_DOCK_LIMITS.handleOpacity[0]} max={SIDE_DOCK_LIMITS.handleOpacity[1]} step={5} value={sideDocks.handleOpacity} aria-label={text.fine.handleOpacity} onChange={(event) => patch({ handleOpacity: Number(event.target.value) })} />
              <span>{sideDocks.handleOpacity}%</span>
            </div>
          </div>
          <div className="sd-fine-row" data-disabled={twoStage}>
            <span>{text.fine.gap}</span>
            <div className="sd-range">
              <input type="range" disabled={twoStage} min={SIDE_DOCK_LIMITS.gap[0]} max={SIDE_DOCK_LIMITS.gap[1]} step={2} value={sideDocks.gap} aria-label={text.fine.gap} onChange={(event) => patch({ gap: Number(event.target.value) })} />
              <span>{sideDocks.gap}px</span>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.dragDropShelf}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" data-on={sideDocks.dragDropShelf} onClick={() => patch({ dragDropShelf: true })}>{text.zones.enabled}</button>
              <button type="button" className="sd-seg__btn" data-on={!sideDocks.dragDropShelf} onClick={() => patch({ dragDropShelf: false })}>{text.zones.disabled}</button>
            </div>
          </div>
          <div className="sd-fine-row">
            <span>{text.fine.hideInFullscreen}</span>
            <div className="sd-seg">
              <button type="button" className="sd-seg__btn" data-on={sideDocks.hideInFullscreen} onClick={() => patch({ hideInFullscreen: true })}>{text.zones.enabled}</button>
              <button type="button" className="sd-seg__btn" data-on={!sideDocks.hideInFullscreen} onClick={() => patch({ hideInFullscreen: false })}>{text.zones.disabled}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
