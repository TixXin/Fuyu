import type { ReactNode } from "react";
import "./SettingsGroup.css";

export function SettingsGroup({
  title,
  action,
  footer,
  children,
}: {
  title?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-group">
      {title || action ? (
        <div className="settings-group__header">
          {title ? <h2 className="settings-group__title">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className="settings-group__card">{children}</div>
      {footer ? <div className="settings-group__footer">{footer}</div> : null}
    </section>
  );
}
