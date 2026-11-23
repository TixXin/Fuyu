import type { Ref } from "react";
import { ArrowDownUp, Scaling } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { IslandMenuRow } from "./api";
import { handleCardKeys } from "./cardKeys";
import { TraySwitch } from "./TraySwitch";
import "./TrayMenuCard.css";
import "./TrayCardParts.css";
import "./IslandMenuCard.css";

export type IslandMenuHandlers = {
  onToggle: (id: string) => void;
  onArrange: () => void;
  onResize: () => void;
  onClose: () => void;
};

export function IslandMenuCard({
  rows,
  light,
  mac,
  handlers,
  ref,
}: {
  rows: IslandMenuRow[];
  light: boolean;
  mac: boolean;
  handlers: IslandMenuHandlers;
  ref?: Ref<HTMLDivElement>;
}) {
  const t = useTranslation();
  const text = t.trayMenu;
  return (
    <div
      ref={ref}
      className={`tray-card tray-card--island${light ? " tray-card--light" : ""}${mac ? " tray-card--mac" : ""}`}
      role="dialog"
      aria-label={text.islandMenu}
      onKeyDown={(event) => handleCardKeys(event, handlers.onClose)}
    >
      {rows.length > 0 ? (
        <div className="tray-card__island-items" role="group" aria-label={text.islandMenuItems}>
          <span className="tray-card__island-title" aria-hidden="true">{text.islandMenuItems}</span>
          {rows.map((row) => (
            <TraySwitch key={row.id} className="tray-card__island-row" label={row.name} checked={row.shown} onToggle={() => handlers.onToggle(row.id)} />
          ))}
        </div>
      ) : null}
      <div className={rows.length > 0 ? "tray-card__menu" : "tray-card__menu tray-card__menu--alone"}>
        <button type="button" className="tray-card__menu-row" onClick={handlers.onArrange}>
          <ArrowDownUp size={16} aria-hidden="true" />
          <span>{t.island.arrangeItems}</span>
        </button>
        <button type="button" className="tray-card__menu-row" onClick={handlers.onResize}>
          <Scaling size={16} aria-hidden="true" />
          <span>{t.island.resize.menu}</span>
        </button>
      </div>
    </div>
  );
}
