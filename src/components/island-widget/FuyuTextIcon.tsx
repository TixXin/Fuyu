import { useTranslation } from "../../i18n";
import { FUYU_PAGE_ID } from "../../lib/settings/customPanels";
import { customPageName } from "../../lib/settings/islandPages";
import { useIslandPages } from "../../lib/settings/useIslandPages";
import "./FuyuTextIcon.css";

type TextIconProps = { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string };

export function FuyuTextIcon({ size = 16, className }: TextIconProps) {
  const fallback = useTranslation().island.homePage;
  const name = customPageName(useIslandPages().layout, FUYU_PAGE_ID) ?? fallback;
  const px = typeof size === "number" ? size : Number.parseFloat(size) || 16;
  return (
    <span className={className ? `panel-text-icon ${className}` : "panel-text-icon"} style={{ fontSize: Math.round(px * 0.8) }} aria-hidden="true">
      {name}
    </span>
  );
}
