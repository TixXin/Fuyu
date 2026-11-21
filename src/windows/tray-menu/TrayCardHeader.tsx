import { Settings } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayCardProps } from "./types";

function FuyuMark() {
  return (
    <svg className="tray-card__mark" viewBox="3 6 58 40.5" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H51.88A6.6 6.6 0 0 1 41.35 43.68A6.6 6.6 0 0 1 32 43.63A6.6 6.6 0 0 1 22.65 43.68A6.6 6.6 0 0 1 12.12 36H10.4C7.4 36 5 33.5 5 30.5ZM24 19.6a3.6 5 0 1 0 0 10a3.6 5 0 1 0 0-10ZM40 19.6a3.6 5 0 1 0 0 10a3.6 5 0 1 0 0-10Z"
      />
    </svg>
  );
}

export function TrayCardHeader({ data, handlers }: TrayCardProps) {
  const text = useTranslation().trayMenu;
  const version = `v${data.state.version}`;
  const update = data.state.updateAvailable;
  return (
    <div className="tray-card__head">
      <FuyuMark />
      <span className="tray-card__name">{text.appName}</span>
      {update ? (
        <button
          type="button"
          className="tray-card__ver"
          aria-label={`${version}${text.separator}${text.updateLabel(update)}`}
          title={text.updateLabel(update)}
          onClick={() => handlers.onAction("update")}
        >
          <span className="tray-card__ver-text">{version}</span>
          <span className="tray-card__badge">{text.updateBadge}</span>
        </button>
      ) : (
        <span className="tray-card__ver">
          <span className="tray-card__ver-text">{version}</span>
        </span>
      )}
      <span className="tray-card__spacer" />
      <button
        type="button"
        className="tray-card__icon-button"
        aria-label={text.settings}
        title={text.settings}
        onClick={() => handlers.onAction("open_settings")}
      >
        <Settings size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
