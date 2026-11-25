import { Bot, Check, ChevronRight, Layers, Mail, Settings } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useLocale, useTranslation } from "../../i18n";
import { bundleText, type RecommendedBundle } from "../../lib/onboarding-bundle/recommend";
import { isMacOS, useDevBuild } from "../../lib/platform";
import type { SettingsFocusSection } from "../settings/storage";
import { ActHeading } from "./ActHeading";
import type { OnboardingExtensionSpec } from "./flow";
import "./ReleaseAct.css";

export function ReleaseAct({
  extensions,
  bundle,
  agentSetupDone,
  launchAtStartup,
  onLaunchAtStartupChange,
  onOpenAgentSetup,
  onLeaveForSettings,
}: {
  extensions: readonly OnboardingExtensionSpec[];
  bundle: RecommendedBundle | null;
  agentSetupDone: boolean;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
  onOpenAgentSetup: () => void;
  onLeaveForSettings: (section?: SettingsFocusSection, bundleId?: string) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.release;
  const devText = t.settings.devBuild;
  const { locale } = useLocale();
  const devBuild = useDevBuild();
  const bundleDesc = bundle ? bundleText(bundle.description, locale) : "";

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <SettingsGroup>
        <SettingsToggleRow
          title={isMacOS ? text.launchAtStartupMac : text.launchAtStartup}
          description={devBuild ? devText.launchAtStartupOff : isMacOS ? text.launchAtStartupHintMac : text.launchAtStartupHint}
          checked={launchAtStartup}
          disabled={devBuild}
          onChange={onLaunchAtStartupChange}
        />
      </SettingsGroup>
      {extensions.length > 0 && (
        <section className="release-act__section" aria-label={text.extensionsTitle}>
          <div className="release-act__section-head">
            <h2 className="release-act__section-title">{text.extensionsTitle}</h2>
            <span className="release-act__section-hint">{text.extensionsHint}</span>
          </div>
          <div className="release-act__cards">
            {extensions.map((extension) => {
              if (extension.id === "agentSetup") {
                return (
                  <button
                    key={extension.id}
                    type="button"
                    className="release-act__card"
                    data-extension="agentSetup"
                    onClick={onOpenAgentSetup}
                  >
                    <span className="release-act__card-icon" aria-hidden="true">
                      <Bot size={16} />
                    </span>
                    <span className="release-act__card-body">
                      <span className="release-act__card-title">
                        {text.agentSetupTitle}
                        {agentSetupDone && (
                          <span className="release-act__done-badge">
                            <Check size={11} aria-hidden="true" />
                            {text.agentSetupDone}
                          </span>
                        )}
                      </span>
                      <span className="release-act__card-desc">{text.agentSetupDesc}</span>
                    </span>
                    <span className="release-act__card-action">
                      {agentSetupDone ? text.agentSetupActionAgain : text.agentSetupAction}
                      <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </button>
                );
              }
              if (extension.id === "bundle" && bundle) {
                return (
                  <div key={extension.id} className="release-act__bundle" data-onboarding-bundle={bundle.id}>
                    <div className="release-act__bundle-top">
                      <span className="release-act__card-icon" aria-hidden="true">
                        <Layers size={16} />
                      </span>
                      <div className="release-act__card-body">
                        <span className="release-act__card-title">{bundleText(bundle.displayName, locale)}</span>
                        {bundleDesc && <span className="release-act__card-desc">{bundleDesc}</span>}
                      </div>
                      <button
                        type="button"
                        className="onboarding__button"
                        data-action="onboarding-bundle-open"
                        onClick={() => onLeaveForSettings("pluginMarket", bundle.id)}
                      >
                        {text.bundleAction}
                      </button>
                    </div>
                    <ul className="release-act__members" aria-label={t.onboarding.bundle.contains}>
                      {bundle.members.map((member) => (
                        <li key={member.name} className="release-act__member">
                          {bundleText(member.displayName, locale)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (extension.id === "mail") {
                return (
                  <button
                    key={extension.id}
                    type="button"
                    className="release-act__card"
                    data-extension="mail"
                    onClick={() => onLeaveForSettings("mail")}
                  >
                    <span className="release-act__card-icon" aria-hidden="true">
                      <Mail size={16} />
                    </span>
                    <span className="release-act__card-body">
                      <span className="release-act__card-title">{text.mailTitle}</span>
                      <span className="release-act__card-desc">{text.mailDesc}</span>
                    </span>
                    <span className="release-act__card-action">
                      {text.mailAction}
                      <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </button>
                );
              }
              return null;
            })}
          </div>
        </section>
      )}
      <div className="release-act__bottom">
        <button className="onboarding-release__link" type="button" onClick={() => onLeaveForSettings()}>
          <Settings size={15} aria-hidden="true" />
          {text.openSettings}
        </button>
        <p className="release-act__find-later">{isMacOS ? text.findLaterMac : text.findLater}</p>
      </div>
    </>
  );
}
