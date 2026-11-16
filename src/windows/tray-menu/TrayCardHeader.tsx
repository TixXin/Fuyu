import { Settings } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayCardProps } from "./types";

function FuyuMark() {
  return (
    <svg className="tray-card__mark" viewBox="11 21 42 22" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M22 21h20a11 11 0 0 1 0 22H22a11 11 0 0 1 0-22Z M22 28a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z M33 30h10a2 2 0 0 1 0 4H33a2 2 0 0 1 0-4Z"
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
