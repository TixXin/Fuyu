import type { CSSProperties } from "react";
import claudeCodeIcon from "../../assets/brands/claude-code.png";
import { useTranslation } from "../../i18n";
import { AgentPagePreview } from "./AgentPagePreview";
import { glassPalette, glassPaused, glassVariables } from "./glassPalette";
import { hexToRgba } from "./settings";
import { islandInkRgb, surfaceThemeColors } from "./themeMode";
import type { IslandSettings } from "./types";
import "./IslandPreview.css";

export function IslandPreview({ settings, compact = false }: {
  settings: IslandSettings;
  compact?: boolean;
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
  const collapsedStyle = surfaceStyle(surfaceThemeColors(settings, "collapsed"));
  const expandedStyle = surfaceStyle(surfaceThemeColors(settings, "panel"));
  const islandClass = [
    "island-preview__island",
    glass && "island-preview__island--glass",
    settings.marginY > 0 && "island-preview__island--detached",
  ].filter(Boolean).join(" ");

  return (
    <figure
      className={`island-preview island-preview--font-${settings.fontFamily}${compact ? " island-preview--compact" : ""}${paused ? " island-preview--glass-paused" : ""}`}
      style={style}
      aria-label={text.label}
    >
      <div className="island-preview__desktop">
        <div className={`${islandClass} island-preview__island--collapsed`} style={collapsedStyle}>
          {glass && <GlassLayers rim={settings.glassRim} />}
          <span className="island-preview__pulse" />
          <img className="island-preview__provider" src={claudeCodeIcon} alt="" draggable={false} />
          {settings.showCollapsedText && <span className="island-preview__task">{text.sessions.needs.title}</span>}
          <span className="island-preview__ring">1</span>
        </div>
        {compact ? null : <figcaption className="island-preview__caption">{text.collapsed}</figcaption>}
      </div>
      {compact ? null : <div className="island-preview__desktop">
        <div className={`${islandClass} island-preview__island--expanded`} style={expandedStyle}>
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
    ...(settings.appearanceMode === "liquidGlass" ? glassVariables(settings, glassPalette({
      settings,
      accent: settings.accentMode === "pick" ? settings.accentColor : null,
      cover: null,
      background: settings.islandBackgroundColor,
    })) : {}),
  } as CSSProperties;
}
