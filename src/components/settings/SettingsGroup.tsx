import { createContext, type ReactNode } from "react";
import "./SettingsGroup.css";

export const SettingsGroupTitleContext = createContext("");
export const SettingsDisabledContext = createContext(false);

export function SettingsGroup({
  title,
  action,
  footer,
  plain = false,
  children,
}: {
  title?: string;
  action?: ReactNode;
  footer?: ReactNode;
  plain?: boolean;
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
      <SettingsGroupTitleContext.Provider value={title ?? ""}>
        {plain ? children : <div className="settings-group__card">{children}</div>}
      </SettingsGroupTitleContext.Provider>
      {footer ? <div className="settings-group__footer">{footer}</div> : null}
    </section>
  );
}

export function SettingsDisabledArea({
  disabled,
  children,
}: {
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <SettingsDisabledContext.Provider value={disabled}>
      <div
        className={disabled ? "settings-disabled-area settings-disabled-area--disabled" : "settings-disabled-area"}
        aria-disabled={disabled || undefined}
        inert={disabled || undefined}
      >
        {children}
      </div>
    </SettingsDisabledContext.Provider>
  );
}
