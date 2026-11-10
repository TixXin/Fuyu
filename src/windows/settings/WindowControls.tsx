import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Plus, Square, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./WindowControls.css";

const ICON = { size: 8, strokeWidth: 3, "aria-hidden": true } as const;

/**
 * The window's own buttons (it has no Windows title bar): Windows-style at the top right, or mac-
 * style dots for the sidebar card, grey at rest and coloured while the cursor is on them.
 */
export function WindowControls({ style }: { style: "windows" | "mac" }) {
  const text = useTranslation().settings.windowControls;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const window = getCurrentWindow();
    let stop: (() => void) | undefined;
    let cancelled = false;
    const update = () => void window.isMaximized().then((value) => { if (!cancelled) setMaximized(value); }).catch(() => {});
    update();
    void window.onResized(update).then((unlisten) => (cancelled ? unlisten() : (stop = unlisten))).catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const run = (action: (window: ReturnType<typeof getCurrentWindow>) => Promise<void>) => () => {
    void action(getCurrentWindow()).catch((error: unknown) => console.error("Window button failed", error));
  };

  const minimize = run((window) => window.minimize());
  const toggleMaximize = run((window) => window.toggleMaximize());
  const close = run((window) => window.close());
  const maximizeLabel = maximized ? text.restore : text.maximize;

  // Windows for now: minimize, maximize and close at the window's top right, close turning red.
  // The mac dots below stay for when the app runs on macOS (user request 2026-11-10).
  if (style === "windows") {
    return (
      <div className="window-buttons">
        <button className="window-buttons__button" type="button" aria-label={text.minimize} onClick={minimize}>
          <Minus size={14} strokeWidth={1.4} aria-hidden="true" />
        </button>
        <button className="window-buttons__button" type="button" aria-label={maximizeLabel} onClick={toggleMaximize}>
          {maximized ? <Copy size={12} strokeWidth={1.4} aria-hidden="true" /> : <Square size={11} strokeWidth={1.4} aria-hidden="true" />}
        </button>
        <button className="window-buttons__button window-buttons__button--close" type="button" aria-label={text.close} onClick={close}>
          <X size={15} strokeWidth={1.4} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="window-controls" data-tauri-drag-region>
      <div className="window-controls__dots">
        <button className="window-controls__dot window-controls__dot--close" type="button" aria-label={text.close} onClick={close}>
          <X {...ICON} />
        </button>
        <button className="window-controls__dot window-controls__dot--minimize" type="button" aria-label={text.minimize} onClick={minimize}>
          <Minus {...ICON} />
        </button>
        <button className="window-controls__dot window-controls__dot--maximize" type="button" aria-label={maximizeLabel} onClick={toggleMaximize}>
          <Plus {...ICON} />
        </button>
      </div>
    </div>
  );
}
