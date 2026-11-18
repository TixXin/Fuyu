import { ShortcutKeys } from "../../../components/controls/ShortcutKeys";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { shortcutLabel } from "../../../lib/shortcut/shortcut";
import { APPROVAL_HOTKEYS } from "./api";
import { approvalLabel } from "./approvalLabel";
import { useAgentApprovalSettings } from "./useAgentApprovalSettings";

export function AgentApprovalSettings() {
  const t = useTranslation();
  const text = t.settings.agent.approval;
  const shortcutsText = t.settings.shortcuts;
  const [settings, setSettings] = useAgentApprovalSettings();

  return (
    <>
      <SettingsGroup title={text.title} footer={<SettingsFootnote text={isMacOS ? text.hintMac : text.hint} />}>
        <SettingsToggleRow title={text.onIsland} checked={settings.onIsland} onChange={(onIsland) => setSettings({ ...settings, onIsland })} />
        {settings.onIsland && (
          <SettingsToggleRow
            indent
            title={text.whenInFront}
            description={text.whenInFrontHint}
            checked={settings.whenInFront}
            onChange={(whenInFront) => setSettings({ ...settings, whenInFront })}
          />
        )}
      </SettingsGroup>
      <SettingsGroup title={shortcutsText.approvalTitle} footer={<SettingsFootnote text={shortcutsText.approvalHint} />}>
        {APPROVAL_HOTKEYS.map(({ action, shortcut }) => (
          <SettingsRow
            key={action}
            searchable={false}
            title={approvalLabel(t, action)}
            control={<ShortcutKeys label={shortcutLabel(shortcut)} />}
          />
        ))}
      </SettingsGroup>
    </>
  );
}
