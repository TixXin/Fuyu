import { useTranslation } from "../../../i18n";
import { runnerSlot } from "../../../windows/settings/slots/runnerSlot";
import { useReportShortcutOwners } from "../../../windows/settings/useReportShortcutOwners";
import { APPROVAL_HOTKEYS } from "../approvals/api";
import { approvalLabel } from "../approvals/approvalLabel";

function ApprovalShortcutOwners() {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  useReportShortcutOwners("agentApprovals", 100, APPROVAL_HOTKEYS.map(({ action, shortcut }) => ({
    id: `approval:${action}`, label: `${text.approvalTitle} · ${approvalLabel(t, action)}`, shortcut, home: "agentApprovals",
  })), true);
  return null;
}

runnerSlot.add({ id: "agent-status.shortcut-owners", component: ApprovalShortcutOwners });
