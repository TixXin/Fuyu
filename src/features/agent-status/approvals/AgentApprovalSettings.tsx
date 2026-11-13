import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { useAgentApprovalSettings } from "./useAgentApprovalSettings";
import { isMacOS } from "../../../lib/platform";

export function AgentApprovalSettings() {
  const text = useTranslation().settings.agent.approval;
  const [settings, setSettings] = useAgentApprovalSettings();

  return (
    <SettingsGroup title={text.title} footer={isMacOS ? text.hintMac : text.hint}>
      <SettingsToggleRow title={text.onIsland} checked={settings.onIsland} onChange={(onIsland) => setSettings({ ...settings, onIsland })} />
      {settings.onIsland && (
        <SettingsToggleRow
          title={text.whenInFront}
          description={text.whenInFrontHint}
          checked={settings.whenInFront}
          onChange={(whenInFront) => setSettings({ ...settings, whenInFront })}
        />
      )}
    </SettingsGroup>
  );
}
