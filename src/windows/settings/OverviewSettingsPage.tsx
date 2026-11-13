import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { THEME_MODES } from "../../features/appearance/themeMode";
import type { IslandSettings, ThemeMode } from "../../features/appearance/types";
import { LOCALE_CODES, TRANSLATIONS, isLocaleCode, useTranslation, type LocaleCode } from "../../i18n";
import { isMacOS, type PlatformFeature } from "../../lib/platform";
import { openOnboardingWindow } from "../onboarding/api";
import { FEATURE_PAGES, isCategoryAvailable, SETTINGS_FEATURES, type SettingsCategory, type SettingsFeature } from "./categories";
import { CATEGORY_ICONS } from "./SettingsSidebar";
import type { FeatureSwitch, FeatureSwitches } from "./useFeatureSwitches";
import { useLaunchAtStartup } from "./useLaunchAtStartup";
import "./OverviewSettingsPage.css";

const LOCALE_OPTIONS = LOCALE_CODES.map((code) => ({ value: code, label: TRANSLATIONS[code].localeLabel }));

export function OverviewSettingsPage({
  settings,
  locale,
  features,
  unsupported,
  onLocaleChange,
  onSettingsChange,
  onOpenPage,
}: {
  settings: IslandSettings;
  locale: LocaleCode;
  features: FeatureSwitches;
  unsupported: ReadonlySet<PlatformFeature>;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const t = useTranslation();
  const text = t.settings.overview;
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const offered = SETTINGS_FEATURES.filter((feature) => isCategoryAvailable(FEATURE_PAGES[feature][0], unsupported));

  return (
    <div className="settings-overview" data-search="off">
      <p className="settings-overview__intro">{text.intro}</p>
      <SettingsGroup title={text.basicsTitle}>
        <SettingsRow
          title={text.tone}
          description={text.toneHint}
          control={
            <SettingsChoice<ThemeMode>
              value={settings.themeMode}
              ariaLabel={text.tone}
              options={THEME_MODES.map((mode) => ({ value: mode, label: t.settings.colors.modes[mode] }))}
              onChange={(themeMode) => onSettingsChange({ ...settings, themeMode })}
            />
          }
        />
        <SettingsRow
          title={t.settings.language.label}
          control={
            <SettingsSelect
              value={locale}
              options={LOCALE_OPTIONS}
              ariaLabel={t.settings.language.label}
              onChange={(next) => {
                if (isLocaleCode(next)) onLocaleChange(next);
              }}
            />
          }
        />
        <SettingsToggleRow
          title={isMacOS ? t.settings.layout.launchAtStartupMac : t.settings.layout.launchAtStartup}
          checked={launchAtStartup}
          onChange={updateLaunchAtStartup}
        />
      </SettingsGroup>

      <section className="settings-group">
        <div className="settings-group__header">
          <h2 className="settings-group__title">{text.featuresTitle}</h2>
        </div>
        <ul className="settings-overview__features">
          {offered.map((feature) => (
            <FeatureCard key={feature} feature={feature} state={features[feature]} onOpen={() => onOpenPage(FEATURE_PAGES[feature][0])} />
          ))}
          <MessagesCard onOpen={() => onOpenPage("messages")} />
        </ul>
        <div className="settings-group__footer">
          <p>{text.featuresFooter}</p>
        </div>
      </section>

      <SettingsGroup title={text.nextTitle}>
        <NextRow title={text.look} hint={text.lookHint} onGo={() => onOpenPage("appearance")} />
        <NextRow title={text.themes} hint={text.themesHint} onGo={() => onOpenPage("themeMarket")} />
        <NextRow title={text.shortcuts} hint={text.shortcutsHint} onGo={() => onOpenPage("shortcuts")} />
        <NextRow title={text.guide} hint={text.guideHint} onGo={openOnboardingWindow} />
      </SettingsGroup>
    </div>
  );
}

function FeatureCard({ feature, state, onOpen }: { feature: SettingsFeature; state: FeatureSwitch; onOpen: () => void }) {
  const t = useTranslation();
  const id = useId();
  const page = FEATURE_PAGES[feature][0];
  const name = feature === "agents" ? t.settings.categories.groups.agents : t.settings.categories[page];
  const Icon = CATEGORY_ICONS[page];
  return (
    <li className={`settings-overview__feature${state.on ? " settings-overview__feature--on" : ""}`} data-feature={feature}>
      <span className="settings-overview__feature-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="settings-overview__feature-text">
        <label className="settings-overview__feature-name" htmlFor={id}>{name}</label>
        <span className="settings-overview__feature-hint">{t.settings.overview.features[feature]}</span>
      </span>
      <span className="settings-overview__feature-side">
        <SettingsSwitch id={id} checked={state.on} onChange={state.set} />
        {state.on && <OpenLink label={t.settings.overview.open} onClick={onOpen} />}
      </span>
    </li>
  );
}

function MessagesCard({ onOpen }: { onOpen: () => void }) {
  const t = useTranslation();
  const Icon = CATEGORY_ICONS.messages;
  return (
    <li className="settings-overview__feature settings-overview__feature--on" data-feature="messages">
      <span className="settings-overview__feature-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="settings-overview__feature-text">
        <span className="settings-overview__feature-name">{t.settings.categories.messages}</span>
        <span className="settings-overview__feature-hint">{t.settings.overview.features.messages}</span>
      </span>
      <span className="settings-overview__feature-side">
        <OpenLink label={t.settings.overview.messagesAction} onClick={onOpen} />
      </span>
    </li>
  );
}

function OpenLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="settings-overview__open" type="button" onClick={onClick}>
      {label}
      <ChevronRight size={13} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function NextRow({ title, hint, onGo }: { title: string; hint: string; onGo: () => void }) {
  const go = useTranslation().settings.overview.go;
  return <SettingsRow title={title} description={hint} control={<SettingsLinkButton onClick={onGo}>{go}</SettingsLinkButton>} />;
}
