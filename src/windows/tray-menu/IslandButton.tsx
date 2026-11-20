import { Eye, EyeOff, Layers } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayCardProps } from "./types";

export function IslandButton({ variant, data, handlers }: TrayCardProps & { variant: "primary" | "pill" | "tile" }) {
  const text = useTranslation().trayMenu;
  const on = data.state.islandVisible;
  const behind = on && data.state.islandBehind;
  const Icon = behind ? Layers : on ? Eye : EyeOff;
  const status = behind ? text.islandBehind : on ? text.islandOn : text.islandOff;
  return (
    <button
      type="button"
      className={`tray-card__${variant}`}
      aria-pressed={on && !behind}
      aria-label={`${text.island}${text.separator}${status}`}
      title={behind ? text.raiseIsland : on ? text.hideIsland : text.showIsland}
      onClick={() => handlers.onAction(behind ? "raise_island" : "toggle_island")}
    >
      <Icon size={variant === "primary" ? 18 : 16} aria-hidden="true" />
      {variant === "primary" ? (
        <span>
          <b>{text.island}</b>
          <small>{behind ? text.islandBehindShort : on ? text.islandOnShort : text.islandOffShort}</small>
        </span>
      ) : (
        <span className="tray-card__label">{text.island}</span>
      )}
    </button>
  );
}
