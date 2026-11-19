import { useEffect, useState } from "react";
import { FileText, Power, RotateCw } from "lucide-react";
import { useTranslation } from "../../i18n";
import "./WindowCrashFallback.css";

export type WindowCrashVariant = "island" | "window";

export type WindowCrashActions = {
  reload: () => void;
  autoReload: () => void;
  restart: () => void;
  openLog: () => void;
  close: () => void;
};

type WindowCrashFallbackProps = {
  variant: WindowCrashVariant;
  retried: boolean;
  dev: boolean;
  message: string;
  retryAfterMs?: number;
  actions: WindowCrashActions;
};

export function WindowCrashFallback({ variant, retried, dev, message, retryAfterMs, actions }: WindowCrashFallbackProps) {
  const t = useTranslation();
  const text = t.common.crash;
  const [busy, setBusy] = useState<"reload" | "restart" | null>(null);
  const { autoReload } = actions;

  useEffect(() => {
    if (variant !== "island" || retryAfterMs === undefined) return;
    const timer = window.setTimeout(autoReload, retryAfterMs);
    return () => window.clearTimeout(timer);
  }, [variant, retryAfterMs, autoReload]);

  const restarts = retried && !dev;
  const run = () => {
    setBusy(restarts ? "restart" : "reload");
    if (restarts) actions.restart();
    else actions.reload();
  };
  const primaryLabel = busy === "restart" ? text.restarting : busy === "reload" ? text.reloading : restarts ? text.restart : text.reload;
  const primary = (
    <button type="button" className="window-crash__button window-crash__button--primary" disabled={busy !== null} onClick={run}>
      {restarts ? <Power size={12} strokeWidth={2.4} aria-hidden="true" /> : <RotateCw size={12} strokeWidth={2.4} aria-hidden="true" />}
      {primaryLabel}
    </button>
  );

  if (variant === "island") {
    return (
      <div className="window-crash window-crash--island" role="alert">
        <div className="window-crash__pill" title={message || undefined}>
          <span className="window-crash__text">{dev ? text.devHint : retried ? text.islandRetried : text.island}</span>
          {primary}
          <button type="button" className="window-crash__button window-crash__button--icon" aria-label={text.openLog} title={text.openLog} onClick={actions.openLog}>
            <FileText size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="window-crash window-crash--window" role="alert">
      <div className="window-crash__card">
        <p className="window-crash__title">{text.window}</p>
        <p className="window-crash__detail">{dev ? text.devHint : retried ? text.detailRetried : text.detail}</p>
        {message && <code className="window-crash__error">{message}</code>}
        <div className="window-crash__actions">
          <button type="button" className="window-crash__button window-crash__button--link" onClick={actions.openLog}>
            <FileText size={12} strokeWidth={2.2} aria-hidden="true" />
            {text.openLog}
          </button>
          <button type="button" className="window-crash__button" onClick={actions.close}>
            {t.common.close}
          </button>
          {primary}
        </div>
      </div>
    </div>
  );
}
