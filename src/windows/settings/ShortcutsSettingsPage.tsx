import type { ReactNode } from "react";
import { PageShortcutSection } from "../../features/appearance/PageShortcutSection";
import type { IslandSettings } from "../../features/appearance/types";
import { APPROVAL_HOTKEYS, type AgentApprovalDecision } from "../../features/agent-status/approvals/api";
import { useClipboardSettings } from "../../features/clipboard/useClipboardSettings";
import { PluginShortcutSection } from "../../features/plugins/PluginShortcutSection";
import { useTranslationSettings } from "../../features/translation/useTranslationSettings";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import type { SettingsCategory } from "./categories";
import { ShortcutFinder } from "./ShortcutFinder";
import { ClipboardShortcutGroup, TranslationShortcutGroup } from "./ShortcutGroups";
import type { ShortcutOwner } from "./shortcutConflicts";
import { useShortcutOwners } from "./useShortcutOwners";
import "./ShortcutsSettingsPage.css";

/** Keys that cannot be changed, listed for reference: one row each, the keys as a keycap. */
function ReferenceSection({ title, rows, footer, action }: { title: string; rows: [string, string][]; footer?: string; action?: ReactNode }) {
  return (
    <SettingsGroup title={title} footer={footer} action={action}>
      {rows.map(([label, keys]) => (
        <SettingsRow key={label} title={label} control={<kbd className="shortcut-keycap">{keys}</kbd>} />
      ))}
    </SettingsGroup>
  );
}

/**
 * Every keyboard shortcut in one place, by the feature it belongs to. The same recorders
 * also sit on each feature's own page; here each group links there, a feature that is off
 * keeps its group with a switch to turn it on, and the finder at the top says what any key
 * combination is used for.
 */
export function ShortcutsSettingsPage({
  settings,
  onSettingsChange,
  onOpenPage,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPage: (page: SettingsCategory) => void;
}) {
  const t = useTranslation();
  const text = t.settings.shortcuts;
  const [clipboardSettings, updateClipboardSettings] = useClipboardSettings();
  const [translationSettings, setTranslationSettings] = useTranslationSettings();
  const { owners, takenBy, refreshPlugins } = useShortcutOwners({ settings, clipboard: clipboardSettings, translation: translationSettings });
  const pageLink = (page: SettingsCategory) => <SettingsLinkButton onClick={() => onOpenPage(page)}>{text.openFeaturePage}</SettingsLinkButton>;

  const approvalLabels: Partial<Record<AgentApprovalDecision, string>> = { allow: t.agent.approval.allow, deny: t.agent.approval.deny, terminal: t.agent.approval.terminal };
  const approvalLabel = (action: AgentApprovalDecision) => approvalLabels[action] ?? action;
  const approvalOwners: ShortcutOwner[] = APPROVAL_HOTKEYS.map(({ action, shortcut }) => ({
    id: `approval:${action}`, label: `${text.approvalTitle} · ${approvalLabel(action)}`, shortcut, home: "agentApprovals",
  }));

  return (
    <>
      <ShortcutFinder owners={[...owners, ...approvalOwners]} onOpenPage={onOpenPage} />
      <TranslationShortcutGroup
        title={t.settings.categories.translation}
        action={pageLink("translation")}
        enabled={settings.translationEnabled}
        translation={translationSettings}
        onTranslationChange={setTranslationSettings}
        takenBy={takenBy}
        onTurnOn={() => onSettingsChange({ ...settings, translationEnabled: true })}
      />
      <ClipboardShortcutGroup
        title={t.settings.categories.clipboard}
        action={pageLink("clipboard")}
        clipboard={clipboardSettings}
        onClipboardChange={updateClipboardSettings}
        takenBy={takenBy}
        onTurnOn={() => updateClipboardSettings({ ...clipboardSettings, enabled: true })}
      />
      <PluginShortcutSection takenBy={takenBy} onChanged={refreshPlugins} action={pageLink("plugins")} />
      <PageShortcutSection settings={settings} onSettingsChange={onSettingsChange} takenBy={takenBy} action={pageLink("behavior")} />
      <ReferenceSection
        title={text.islandTitle}
        rows={[[text.collapse, "Esc"], [text.moveIsland, text.altDrag], [text.resizePanel, text.altDragEdge]]}
      />
      {settings.translationEnabled && (
        <ReferenceSection
          title={text.inputTitle}
          rows={[[text.translate, "Enter"], [text.newLine, "Shift + Enter"], [text.pasteClipboard, "Tab"]]}
        />
      )}
      <ReferenceSection
        title={text.approvalTitle}
        rows={APPROVAL_HOTKEYS.map(({ action, shortcut }) => [approvalLabel(action), shortcut])}
        footer={text.approvalHint}
        action={pageLink("agentApprovals")}
      />
    </>
  );
}

/** A feature page's link to the Shortcuts page, at the end of its shortcut group's title. */
export function AllShortcutsLink({ onOpen }: { onOpen: () => void }) {
  const t = useTranslation();
  return <SettingsLinkButton onClick={onOpen}>{t.settings.shortcuts.allShortcuts}</SettingsLinkButton>;
}
