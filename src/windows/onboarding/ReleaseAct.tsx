import { Bot, Mail, Settings } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { ActHeading } from "./ActHeading";
import type { OnboardingModule } from "./personas";

export function ReleaseAct({ modules, launchAtStartup, onLaunchAtStartupChange }: {
  modules: ReadonlySet<OnboardingModule>;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
}) {
  const text = useTranslation().onboarding.release;

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <SettingsGroup>
        <SettingsToggleRow title={text.launchAtStartup} description={text.launchAtStartupHint} checked={launchAtStartup} onChange={onLaunchAtStartupChange} />
      </SettingsGroup>
      <p className="onboarding-release__later">{text.later}</p>
      <div className="onboarding-release__links">
        {modules.has("agents") && (
          <button className="onboarding-release__link" type="button" onClick={() => openSettingsWindow("agentConnect")}>
            <Bot size={16} aria-hidden="true" />
            {text.connectAgents}
          </button>
        )}
        {modules.has("mail") && (
          <button className="onboarding-release__link" type="button" onClick={() => openSettingsWindow("mail")}>
            <Mail size={16} aria-hidden="true" />
            {text.addMail}
          </button>
        )}
        <button className="onboarding-release__link" type="button" onClick={() => openSettingsWindow()}>
          <Settings size={16} aria-hidden="true" />
          {text.openSettings}
        </button>
      </div>
    </>
  );
}
