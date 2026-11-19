import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./WindowCrashFallback.css";

export type WindowCrashVariant = "island" | "window";

type WindowCrashFallbackProps = {
  variant: WindowCrashVariant;
  retryAfterMs?: number;
  onReload: () => void;
  onClose: () => void;
};

export function WindowCrashFallback({ variant, retryAfterMs, onReload, onClose }: WindowCrashFallbackProps) {
  const t = useTranslation();
  const text = t.common.crash;

  useEffect(() => {
    if (variant !== "island" || retryAfterMs === undefined) return;
    const timer = window.setTimeout(onReload, retryAfterMs);
    return () => window.clearTimeout(timer);
  }, [variant, retryAfterMs, onReload]);

  if (variant === "island") {
    return (
      <div className="window-crash window-crash--island" role="alert">
        <div className="window-crash__pill">
          <span className="window-crash__text">{text.island}</span>
          <button type="button" className="window-crash__button window-crash__button--primary" onClick={onReload}>
            <RotateCw size={12} strokeWidth={2.4} aria-hidden="true" />
            {text.reload}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="window-crash window-crash--window" role="alert">
      <div className="window-crash__card">
        <p className="window-crash__title">{text.window}</p>
        <p className="window-crash__detail">{text.detail}</p>
        <div className="window-crash__actions">
          <button type="button" className="window-crash__button" onClick={onClose}>
            {t.common.close}
          </button>
          <button type="button" className="window-crash__button window-crash__button--primary" onClick={onReload}>
            <RotateCw size={12} strokeWidth={2.4} aria-hidden="true" />
            {text.reload}
          </button>
        </div>
      </div>
    </div>
  );
}
