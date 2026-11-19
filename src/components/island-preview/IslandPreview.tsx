import type { CSSProperties } from "react";
import claudeCodeIcon from "../../assets/brands/claude-code.png";
import { useTranslation } from "../../i18n";
import { AgentPagePreview } from "./AgentPagePreview";
import { glassPalette, glassPaused, glassVariables } from "../../lib/theme/glassPalette";
import { hexToRgba } from "../../lib/settings/settings";
import { islandInkRgb, notchLook, surfaceThemeColors } from "../../lib/theme/themeMode";
import { isLightIsland } from "../../utils/color";
import type { IslandSettings } from "../../lib/settings/types";
import "./IslandPreview.css";

export function IslandPreview({ settings, compact = false, notch = false }: {
  settings: IslandSettings;
  compact?: boolean;
  notch?: boolean;
}) {
  const text = useTranslation().settings.appearance.preview;
  const glass = settings.appearanceMode === "liquidGlass";
  const style = {
    "--preview-glass": settings.glassIntensity / 100,
    "--preview-radius": `${settings.islandCornerRadius}px`,
    "--preview-radius-px": settings.islandCornerRadius,
    "--preview-corner-shape": settings.islandCornerShape,
    "--preview-pulse-brightness": `${settings.pulseBrightness}%`,
    "--preview-collapsed-scale": settings.collapsedScale,
    "--preview-expanded-scale": settings.expandedScale,
  } as CSSProperties;
  const paused = glassPaused(settings, { mode: "expanded", isTucked: false, quiet: false, hidden: false, reducedMotion: false });
  const panelLook = surfaceThemeColors(settings, "panel");
  const collapsedStyle = surfaceStyle(notch ? notchLook(settings) : surfaceThemeColors(settings, "collapsed"));
  const expandedStyle = surfaceStyle(panelLook);
  const islandClass = [
    "island-preview__island",
    glass && "island-preview__island--glass",
    !notch && settings.marginY > 0 && "island-preview__island--detached",
  ].filter(Boolean).join(" ");
  const collapsedClass = notch ? "island-preview__island island-preview__island--collapsed island-preview__island--notch" : `${islandClass} island-preview__island--collapsed`;
  const expandedClass = `${islandClass} island-preview__island--expanded${notch && !isLightIsland(panelLook.islandBackgroundColor) ? " island-preview__island--under-notch" : ""}`;

  return (
    <figure
      className={`island-preview island-preview--font-${settings.fontFamily}${compact ? " island-preview--compact" : ""}${paused ? " island-preview--glass-paused" : ""}`}
      style={style}
      aria-label={text.label}
    >
      <div className="island-preview__desktop">
        <div className={collapsedClass} style={collapsedStyle}>
          {glass && !notch && <GlassLayers rim={settings.glassRim} />}
          <span className="island-preview__pulse" />
          <img className="island-preview__provider" src={claudeCodeIcon} alt="" draggable={false} />
          {settings.showCollapsedText && !notch && <span className="island-preview__task">{text.sessions.needs.title}</span>}
          <span className="island-preview__ring">1</span>
        </div>
        {compact ? null : <figcaption className="island-preview__caption">{text.collapsed}</figcaption>}
      </div>
      {compact ? null : <div className="island-preview__desktop">
        <div className={expandedClass} style={expandedStyle}>
          {glass && <GlassLayers rim={settings.glassRim} />}
          <AgentPagePreview />
        </div>
        <figcaption className="island-preview__caption">{text.expanded}</figcaption>
      </div>}
    </figure>
  );
}

function GlassLayers({ rim }: { rim: boolean }) {
  return (
    <>
      <span className="island-preview__flow" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {rim && <span className="island-preview__rim" aria-hidden="true" />}
    </>
  );
}

function surfaceStyle(settings: IslandSettings) {
  return {
    "--preview-fill": hexToRgba(settings.islandBackgroundColor, settings.opacity / 100),
    "--preview-pulse": settings.pulseColor,
    "--preview-pulse-glow": hexToRgba(settings.pulseColor, 0.72),
    "--preview-text": settings.taskTextColor,
    "--preview-ink": islandInkRgb(settings),
    ...(settings.islandOpacity < 100 ? { opacity: settings.islandOpacity / 100 } : {}),
    ...(settings.appearanceMode === "liquidGlass" ? glassVariables(settings, glassPalette({
      settings,
      accent: settings.accentMode === "pick" ? settings.accentColor : null,
      cover: null,
      background: settings.islandBackgroundColor,
    })) : {}),
  } as CSSProperties;
}
