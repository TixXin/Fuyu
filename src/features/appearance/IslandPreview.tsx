import type { CSSProperties } from "react";
import claudeCodeIcon from "../../assets/brands/claude-code.png";
import { useTranslation } from "../../i18n";
import { inkOn } from "../../utils/color";
import { AgentPagePreview } from "./AgentPagePreview";
import { hexToRgba } from "./settings";
import type { IslandSettings } from "./types";
import "./IslandPreview.css";

export function IslandPreview({ settings, compact = false }: {
  settings: IslandSettings;
  compact?: boolean;
}) {
  const text = useTranslation().settings.appearance.preview;
  const glass = settings.appearanceMode === "liquidGlass";
  const style = {
    "--preview-fill": hexToRgba(settings.islandBackgroundColor, settings.opacity / 100),
    "--preview-glass": settings.glassIntensity / 100,
    "--preview-radius": `${settings.islandCornerRadius}px`,
    "--preview-radius-px": settings.islandCornerRadius,
    "--preview-corner-shape": settings.islandCornerShape,
    "--preview-pulse": settings.pulseColor,
    "--preview-pulse-glow": hexToRgba(settings.pulseColor, 0.72),
    "--preview-pulse-brightness": `${settings.pulseBrightness}%`,
    "--preview-text": settings.taskTextColor,
    "--preview-ink": inkOn(settings.islandBackgroundColor),
    "--preview-collapsed-scale": settings.collapsedScale,
    "--preview-expanded-scale": settings.expandedScale,
  } as CSSProperties;
  const islandClass = [
    "island-preview__island",
    glass && "island-preview__island--glass",
    settings.marginY > 0 && "island-preview__island--detached",
  ].filter(Boolean).join(" ");

  return (
    <figure
      className={`island-preview island-preview--font-${settings.fontFamily}${compact ? " island-preview--compact" : ""}`}
      style={style}
      aria-label={text.label}
    >
      <div className="island-preview__desktop">
        <div className={`${islandClass} island-preview__island--collapsed`}>
          <span className="island-preview__pulse" />
          <img className="island-preview__provider" src={claudeCodeIcon} alt="" draggable={false} />
          {settings.showCollapsedText && <span className="island-preview__task">{text.sessions.needs.title}</span>}
          <span className="island-preview__ring">1</span>
        </div>
        {compact ? null : <figcaption className="island-preview__caption">{text.collapsed}</figcaption>}
      </div>
      {compact ? null : <div className="island-preview__desktop">
        <div className={`${islandClass} island-preview__island--expanded`}>
          <AgentPagePreview />
        </div>
        <figcaption className="island-preview__caption">{text.expanded}</figcaption>
      </div>}
    </figure>
  );
}
