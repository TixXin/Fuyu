import { useTranslation } from "../../i18n";
import "./FuyuTextIcon.css";

type TextIconProps = { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; className?: string };

export function FuyuTextIcon({ size = 16, className }: TextIconProps) {
  const name = useTranslation().island.appName;
  const px = typeof size === "number" ? size : Number.parseFloat(size) || 16;
  return (
    <span className={className ? `panel-text-icon ${className}` : "panel-text-icon"} style={{ fontSize: Math.round(px * 0.8) }} aria-hidden="true">
      {name}
    </span>
  );
}
