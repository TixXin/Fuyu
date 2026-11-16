import { useTranslation } from "../../../i18n";
import { settingsRunners } from "../../plugin-kernel/settingsSlots";
import { useReportShortcutOwners } from "../../../lib/shortcut/useReportShortcutOwners";
import { APPROVAL_HOTKEYS } from "../approvals/api";
import { approvalLabel } from "../approvals/approvalLabel";
import { shortcutLabel } from "../../../lib/shortcut/shortcut";
import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { FeaturePageLink } from "../../../components/settings/FeaturePageLink";
import { ShortcutReferenceGroup } from "../../../components/settings/ShortcutReferenceGroup";
import { shortcutReferences, type ShortcutsSectionProps } from "../../plugin-kernel/settingsSlots";
import { AgentAlertsSettingsPage } from "../AgentAlertsSettingsPage";
import { AgentConnectSettingsPage } from "../AgentConnectSettingsPage";
import { AgentRemoteHostsSettings } from "../AgentRemoteHostsSettings";
import { AgentSessionsSettingsPage } from "../AgentSessionsSettingsPage";
import { AgentSettingsPage } from "../AgentSettingsPage";
import { AgentApprovalSettings } from "../approvals/AgentApprovalSettings";
import { SoundSettingsSection } from "../sounds/SoundSettingsSection";
import type { IslandSettings } from "../../../lib/settings/types";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
  onShowPage(page: string): void;
};

function ApprovalShortcutOwners() {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  useReportShortcutOwners("agentApprovals", 100, APPROVAL_HOTKEYS.map(({ action, shortcut }) => ({
    id: `approval:${action}`, label: `${text.approvalTitle} · ${approvalLabel(t, action)}`, shortcut, home: "agentApprovals",
  })), true);
  return null;
}

settingsRunners.add({ id: "agent-status.shortcut-owners", component: ApprovalShortcutOwners });

function ApprovalReference({ onOpenPage }: ShortcutsSectionProps) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  return (
    <ShortcutReferenceGroup
      title={text.approvalTitle}
      rows={APPROVAL_HOTKEYS.map(({ action, shortcut }) => [approvalLabel(t, action), shortcutLabel(shortcut)])}
      footer={text.approvalHint}
      action={<FeaturePageLink page="agentApprovals" onOpenPage={onOpenPage} />}
    />
  );
}

shortcutReferences.add({ id: "shortcutsReference.approvals", category: "shortcutsReference", order: 30, component: ApprovalReference });

addSettingsCategory("agents", ({ settings, onSettingsChange, onShowPage }: PageProps) => <AgentSettingsPage settings={settings} onSettingsChange={onSettingsChange} onOpenConnect={() => onShowPage("agentConnect")} />);
addSettingsCategory("agentSessions", ({ settings, onSettingsChange }: PageProps) => <AgentSessionsSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
addSettingsCategory("agentAlerts", ({ settings, onSettingsChange }: PageProps) => <AgentAlertsSettingsPage settings={settings} onSettingsChange={onSettingsChange} />);
addSettingsCategory("sounds", () => <SoundSettingsSection />);
addSettingsCategory("agentApprovals", () => <AgentApprovalSettings />);
addSettingsCategory("agentConnect", () => <AgentConnectSettingsPage />);
addSettingsCategory("agentRemote", () => <AgentRemoteHostsSettings />);
