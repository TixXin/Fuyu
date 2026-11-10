import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { AgentHooksNotice } from "../../features/agent-status/AgentHooksNotice";
import "../../features/agent-status/AgentHooksSettingsSection.css";
import type { AgentLightStyle, AgentTitleMode, IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";

/**
 * Settings → AI Agent → On the island: the module switch, the title and status light on the
 * collapsed island, and which agents count at all. The Agent page's list, alerts, sounds,
 * approvals and the hooks have their own pages in the group.
 */
export function AgentSettingsPage({
  settings,
  onSettingsChange,
  onOpenConnect,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  /** Opens the Connection page, where the hooks are installed. */
  onOpenConnect: () => void;
}) {
  const t = useTranslation();

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.agents}
        checked={settings.agentStatusEnabled}
        onChange={(agentStatusEnabled) => onSettingsChange({ ...settings, agentStatusEnabled })}
      />
      {/* The hooks live on the Connection page; most of what follows needs them. */}
      <AgentHooksNotice onOpenConnect={onOpenConnect} />
      <SettingsGroup title={t.settings.agent.sessionTitleSection}>
        <SettingsToggleRow
          title={t.settings.agent.sessionTitle}
          description={t.settings.agent.sessionTitleHint}
          checked={settings.agentTitleEnabled}
          onChange={(agentTitleEnabled) => onSettingsChange({ ...settings, agentTitleEnabled })}
        />
        {settings.agentTitleEnabled && (
          <SettingsRow
            indent
            title={t.settings.agent.titleMode}
            description={t.settings.agent.titleModeHint}
            control={
              <SettingsChoice<AgentTitleMode>
                value={settings.agentTitleMode}
                ariaLabel={t.settings.agent.titleMode}
                options={[
                  { value: "changes", label: t.settings.agent.titleModeOptions.changes },
                  { value: "running", label: t.settings.agent.titleModeOptions.running },
                ]}
                onChange={(agentTitleMode) => onSettingsChange({ ...settings, agentTitleMode })}
              />
            }
          />
        )}
        <SettingsRow
          title={t.settings.agent.lightStyle}
          description={t.settings.agent.lightStyleHint}
          control={
            <SettingsChoice<AgentLightStyle>
              value={settings.agentLightStyle}
              ariaLabel={t.settings.agent.lightStyle}
              options={[
                { value: "mark", label: t.settings.agent.lightStyleOptions.mark },
                { value: "dot", label: t.settings.agent.lightStyleOptions.dot },
              ]}
              onChange={(agentLightStyle) => onSettingsChange({ ...settings, agentLightStyle })}
            />
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t.settings.agent.agentsSection} footer={t.settings.agent.showAgentsHint}>
        <SettingsToggleRow
          title={t.settings.agent.showClaudeCode}
          checked={settings.agentShowClaudeCode}
          onChange={(agentShowClaudeCode) => onSettingsChange({ ...settings, agentShowClaudeCode })}
        />
        <SettingsToggleRow
          title={t.settings.agent.showCodex}
          checked={settings.agentShowCodex}
          onChange={(agentShowCodex) => onSettingsChange({ ...settings, agentShowCodex })}
        />
      </SettingsGroup>
    </>
  );
}
