import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayCardProps } from "./types";

export function IslandButton({ variant, data, handlers }: TrayCardProps & { variant: "primary" | "pill" | "tile" }) {
  const text = useTranslation().trayMenu;
  const on = data.state.islandVisible;
  const Icon = on ? Eye : EyeOff;
  return (
    <button
      type="button"
      className={`tray-card__${variant}`}
      aria-pressed={on}
      aria-label={`${text.island}${text.separator}${on ? text.islandOn : text.islandOff}`}
      title={on ? text.hideIsland : text.showIsland}
      onClick={() => handlers.onAction("toggle_island")}
    >
      <Icon size={variant === "primary" ? 18 : 16} aria-hidden="true" />
      {variant === "primary" ? (
        <span>
          <b>{text.island}</b>
          <small>{on ? text.islandOnShort : text.islandOffShort}</small>
        </span>
      ) : (
        <span className="tray-card__label">{text.island}</span>
      )}
    </button>
  );
}
