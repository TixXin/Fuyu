import type { ReactNode } from "react";
import "./SettingsStatusCard.css";

export type StatusCardTone = "ok" | "warn" | "off" | "error";

export function SettingsStatusCard({
  icon,
  title,
  badge,
  description,
  meta,
  control,
  alert,
  tone = "off",
}: {
  icon: ReactNode;
  title: string;
  badge?: { label: string; tone: StatusCardTone };
  description?: ReactNode;
  meta?: ReactNode;
  control?: ReactNode;
  alert?: ReactNode;
  tone?: StatusCardTone;
}) {
  return (
    <section className="settings-group">
      <div className={`settings-status-card settings-status-card--${tone}`} data-search="off">
        <div className="settings-status-card__main">
          <span className="settings-status-card__icon" aria-hidden="true">
            {icon}
          </span>
          <div className="settings-status-card__body">
            <div className="settings-status-card__heading">
              <strong className="settings-status-card__title">{title}</strong>
              {badge ? (
                <span className="settings-status-card__badge" data-tone={badge.tone} role="status">
                  <span className="settings-status-card__dot" aria-hidden="true" />
                  {badge.label}
                </span>
              ) : null}
            </div>
            {description ? <span className="settings-status-card__desc">{description}</span> : null}
            {meta ? <div className="settings-status-card__meta">{meta}</div> : null}
          </div>
          {control ? <div className="settings-status-card__control">{control}</div> : null}
        </div>
        {alert ? (
          <p className="settings-status-card__alert" role="alert">
            {alert}
          </p>
        ) : null}
      </div>
    </section>
  );
}
