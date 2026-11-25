import type { ReactNode } from "react";
import "./SettingsCapabilityGrid.css";

export type CapabilityTone = "ok" | "info" | "warn" | "off";

export type CapabilityItem = {
  id: string;
  icon: ReactNode;
  title: string;
  routes: readonly string[];
  badge: string;
  tone: CapabilityTone;
  note?: string;
  action?: ReactNode;
};

export function SettingsCapabilityGrid({ items }: { items: readonly CapabilityItem[] }) {
  return (
    <div className="settings-capability-grid" data-search="off">
      {items.map((item) => (
        <div key={item.id} className="settings-capability-card" data-capability={item.id} data-tone={item.tone}>
          <div className="settings-capability-card__head">
            <span className="settings-capability-card__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="settings-capability-card__title">{item.title}</span>
            <span className="settings-capability-card__badge" data-tone={item.tone}>
              <span className="settings-capability-card__dot" aria-hidden="true" />
              {item.badge}
            </span>
          </div>
          <div className="settings-capability-card__routes">
            {item.routes.map((route) => (
              <code key={route} className="settings-capability-card__route">
                {route}
              </code>
            ))}
          </div>
          {item.note || item.action ? (
            <div className="settings-capability-card__foot">
              {item.note ? <span className="settings-capability-card__note">{item.note}</span> : <span />}
              {item.action ? <span className="settings-capability-card__action">{item.action}</span> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
