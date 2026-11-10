import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Plus, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./WindowControls.css";

const ICON = { size: 8, strokeWidth: 3, "aria-hidden": true } as const;

/**
 * Close, minimize and maximize, as three dots on the sidebar card (the window has no Windows
 * title bar). Grey at rest, their colours and signs while the cursor is on the group. The space
 * after them drags the window; a double click there maximizes, as on a title bar.
 */
export function WindowControls() {
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

  return (
    <div className="window-controls" data-tauri-drag-region>
      <div className="window-controls__dots">
        <button className="window-controls__dot window-controls__dot--close" type="button" aria-label={text.close} onClick={run((window) => window.close())}>
          <X {...ICON} />
        </button>
        <button className="window-controls__dot window-controls__dot--minimize" type="button" aria-label={text.minimize} onClick={run((window) => window.minimize())}>
          <Minus {...ICON} />
        </button>
        <button
          className="window-controls__dot window-controls__dot--maximize"
          type="button"
          aria-label={maximized ? text.restore : text.maximize}
         
          onClick={run((window) => window.toggleMaximize())}
        >
          <Plus {...ICON} />
        </button>
      </div>
    </div>
  );
}
