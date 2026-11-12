import { Bot, Mail, Settings } from "lucide-react";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";

/** Step 4: where settings live, and shortcuts to the setups that need more than a switch. */
export function DoneStep({ settings }: { settings: IslandSettings }) {
  const text = useTranslation().onboarding.done;

  return (
    <div className="onboarding-done">
      <ul className="onboarding-done__tips">
        {text.tips.map((tip) => <li key={tip}>{tip}</li>)}
      </ul>
      <p className="onboarding-done__lead">{text.lead}</p>
      <div className="onboarding-done__links">
        {settings.agentStatusEnabled && (
          <button className="onboarding-done__link" type="button" onClick={() => openSettingsWindow("agentConnect")}>
            <Bot size={16} aria-hidden="true" />
            {text.connectAgents}
          </button>
        )}
        {settings.mailEnabled && (
          <button className="onboarding-done__link" type="button" onClick={() => openSettingsWindow("mail")}>
            <Mail size={16} aria-hidden="true" />
            {text.addMail}
          </button>
        )}
        <button className="onboarding-done__link" type="button" onClick={() => openSettingsWindow()}>
          <Settings size={16} aria-hidden="true" />
          {text.openSettings}
        </button>
      </div>
    </div>
  );
}
