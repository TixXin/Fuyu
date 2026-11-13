import { useId, type ReactNode } from "react";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { CATEGORY_ICONS } from "./SettingsSidebar";
import "./FeatureHeader.css";

type Feature = "todos" | "calendar" | "music" | "translation" | "clipboard" | "shelf" | "screenshot" | "messages";

const SWITCH_LABELS = { todos: "todo", calendar: "calendar", music: "music", translation: "translation", clipboard: "clipboard", shelf: "shelf", screenshot: "screenshot" } as const;

export function FeatureHeader({
  feature,
  status,
  checked,
  aside,
  onChange,
}: {
  feature: Feature;
  status?: ReactNode;
  checked?: boolean;
  aside?: ReactNode;
  onChange?: (checked: boolean) => void;
}) {
  const settings = useTranslation().settings;
  const Icon = CATEGORY_ICONS[feature];
  const name = settings.categories[feature];
  const description = settings.overview.features[feature];
  const switchLabel = feature === "messages" ? undefined : settings.modules[SWITCH_LABELS[feature]];
  const id = useId();
  const text = settings.modules;
  const off = checked === false;

  return (
    <section className="settings-group">
      <div className={off ? "feature-header feature-header--off" : "feature-header"}>
        <div className="settings-row feature-header__row" data-search={switchLabel ? undefined : "off"}>
          <span className="feature-header__icon" aria-hidden="true"><Icon size={22} strokeWidth={1.8} /></span>
          <div className="feature-header__text">
            <strong className="feature-header__name">{name}</strong>
            {switchLabel ? <label className="settings-row__title feature-header__label" htmlFor={id}>{switchLabel}</label> : null}
            <span className="settings-row__description">{description}</span>
            {status && !off ? <span className="feature-header__status">{status}</span> : null}
          </div>
          {switchLabel && onChange ? <SettingsSwitch id={id} checked={checked === true} onChange={onChange} /> : aside ? <span className="feature-header__aside">{aside}</span> : null}
        </div>
      </div>
      {off ? <p className="feature-header__off-note">{text.offNote}</p> : null}
    </section>
  );
}
