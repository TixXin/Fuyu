import type { ComponentType, ReactNode } from "react";
import { useTranslation } from "../../i18n";
import "./FeatureHeader.css";

export type HeaderFeature = "todos" | "calendar" | "music" | "translation" | "clipboard" | "shelf" | "screenshot" | "voiceInput" | "agents" | "messages";

export function FeatureHeader({
  feature,
  icon: Icon,
  status,
  aside,
  off = false,
}: {
  feature: HeaderFeature;
  icon: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  status?: ReactNode;
  aside?: ReactNode;
  off?: boolean;
}) {
  const settings = useTranslation().settings;

  return (
    <section className="settings-group">
      <div className={off ? "feature-header feature-header--off" : "feature-header"}>
        <div className="settings-row feature-header__row" data-search="off">
          <span className="feature-header__icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
          <div className="feature-header__text">
            <strong className="feature-header__name">{settings.categories[feature]}</strong>
            <span className="settings-row__description">{settings.overview.features[feature]}</span>
            {status && !off ? <span className="feature-header__status">{status}</span> : null}
          </div>
          {aside ? <span className="feature-header__aside">{aside}</span> : null}
        </div>
      </div>
    </section>
  );
}
