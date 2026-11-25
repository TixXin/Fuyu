import { useState, type Ref } from "react";
import { Timer } from "lucide-react";
import { DELAY_SECONDS } from "../../features/screenshot/settings";
import { useTranslation } from "../../i18n";
import { handleCardKeys } from "./cardKeys";
import { CompactLayout } from "./CompactLayout";
import { EntryLayout } from "./EntryLayout";
import { StatusLayout } from "./StatusLayout";
import type { TrayMenuLayout } from "./storage";
import type { TrayCardProps } from "./types";
import "./TrayMenuCard.css";
import "./TrayCardParts.css";

const LAYOUTS = { entry: EntryLayout, status: StatusLayout, compact: CompactLayout } as const;

export function TrayMenuCard({
  layout,
  light,
  ref,
  ...props
}: TrayCardProps & { layout: TrayMenuLayout; light: boolean; ref?: Ref<HTMLDivElement> }) {
  const text = useTranslation().trayMenu;
  const [delayOpen, setDelayOpen] = useState(false);
  const Layout = LAYOUTS[layout];
  return (
    <div
      ref={ref}
      className={`tray-card tray-card--${layout}${light ? " tray-card--light" : ""}${props.data.state.platform === "macos" ? " tray-card--mac" : ""}`}
      role="dialog"
      aria-label={text.cardName}
      data-layout={layout}
      onClick={() => { if (delayOpen) setDelayOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && delayOpen) {
          event.preventDefault();
          event.stopPropagation();
          setDelayOpen(false);
          return;
        }
        handleCardKeys(event, () => props.handlers.onAction("close"));
      }}
    >
      <Layout {...props} onScreenshotDelayMenu={() => setDelayOpen((open) => !open)} />
      {delayOpen && (
        <div
          className="tray-card__delay-bar"
          role="menu"
          aria-label={text.screenshotDelay}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="tray-card__delay-label">
            <Timer size={13} aria-hidden="true" />
            <span>{text.screenshotDelay}</span>
          </span>
          <div className="tray-card__delay-options">
            {DELAY_SECONDS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                role="menuitem"
                className="tray-card__delay-option"
                onClick={() => {
                  setDelayOpen(false);
                  props.handlers.onAction("screenshot_delayed", String(seconds));
                }}
              >
                {text.screenshotDelayOption(seconds)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
