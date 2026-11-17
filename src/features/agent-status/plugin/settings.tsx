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
import { OWNER } from "./owner.ts";

type PageProps = {
  settings: IslandSettings;
  onSettingsChange(settings: IslandSettings): void;
};

function ApprovalShortcutOwners() {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  useReportShortcutOwners("agentApprovals", 100, APPROVAL_HOTKEYS.map(({ action, shortcut }) => ({
    id: `approval:${action}`, label: `${text.approvalTitle} · ${approvalLabel(t, action)}`, shortcut, home: "agentApprovals",
  })), true);
  return null;
}

settingsRunners.add({ id: "agent-status.shortcut-owners", component: ApprovalShortcutOwners }, OWNER);

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

shortcutReferences.add({ id: "shortcutsReference.approvals", category: "shortcutsReference", order: 30, component: ApprovalReference }, OWNER);

const agentPage = (tab: "agents" | "agentAppearance" | "agentRings") =>
  function AgentPage({ settings, onSettingsChange }: PageProps) {
    return <AgentSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

const agentAlertsPage = (tab: "agentAlerts" | "agentPush") =>
  function AgentAlertsTabPage({ settings, onSettingsChange }: PageProps) {
    return <AgentAlertsSettingsPage tab={tab} settings={settings} onSettingsChange={onSettingsChange} />;
  };

addSettingsCategory("agents", agentPage("agents"), OWNER);
addSettingsCategory("agentAppearance", agentPage("agentAppearance"), OWNER);
addSettingsCategory("agentRings", agentPage("agentRings"), OWNER);
addSettingsCategory("agentSessions", ({ settings, onSettingsChange }: PageProps) => <AgentSessionsSettingsPage settings={settings} onSettingsChange={onSettingsChange} />, OWNER);
addSettingsCategory("agentAlerts", agentAlertsPage("agentAlerts"), OWNER);
addSettingsCategory("agentPush", agentAlertsPage("agentPush"), OWNER);
addSettingsCategory("sounds", () => <SoundSettingsSection />, OWNER);
addSettingsCategory("agentApprovals", () => <AgentApprovalSettings />, OWNER);
addSettingsCategory("agentConnect", () => <AgentConnectSettingsPage />, OWNER);
addSettingsCategory("agentRemote", () => <AgentRemoteHostsSettings />, OWNER);
