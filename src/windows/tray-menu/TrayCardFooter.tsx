import type { ReactNode } from "react";
import { Power, RotateCcw } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayCardHandlers } from "./types";

export function TrayCardFooter({ lead, handlers }: { lead?: ReactNode; handlers: TrayCardHandlers }) {
  const text = useTranslation().trayMenu;
  return (
    <div className="tray-card__foot">
      {lead}
      <span className="tray-card__spacer" />
      <button type="button" className="tray-card__foot-button" aria-label={text.restart} onClick={() => handlers.onAction("restart")}>
        <RotateCcw size={16} aria-hidden="true" />
        <span className="tray-card__foot-text">{text.restart}</span>
      </button>
      <button
        type="button"
        className="tray-card__foot-button tray-card__foot-button--danger"
        aria-label={text.quit}
        onClick={() => handlers.onAction("quit")}
      >
        <Power size={16} aria-hidden="true" />
        <span className="tray-card__foot-text">{text.quit}</span>
      </button>
    </div>
  );
}
