import { Bot, Mail, Settings } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { ActHeading } from "./ActHeading";
import { MiniDesk } from "./MiniDesk";
import { MiniIsland } from "./MiniIsland";
import type { OnboardingModule } from "./personas";

/** Act 5: starting with Windows, the setups that need more than a switch, and then the guide flies home. */
export function ReleaseAct({ shown, modules, launchAtStartup, onLaunchAtStartupChange }: {
  shown: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  launchAtStartup: boolean;
  onLaunchAtStartupChange: (enabled: boolean) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.release;

  return (
    <>
      <MiniDesk island={<MiniIsland settings={shown} modules={modules} label={t.onboarding.islandWelcome} live />} />
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
