import { useMemo } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { SessionViewArt } from "./AgentAppearanceGlyphs";
import { AgentSessionsPanel } from "./AgentSessionsPanel";
import { AgentStageIsland } from "./AgentStageIsland";
import { SessionLightAlwaysActiveContext, SessionLightStyleContext } from "./SessionLightMark";
import {
  AGENT_ARCHIVE_MOTIONS,
  AGENT_CARD_EFFECTS,
  AGENT_HOST_DISPLAYS,
  AGENT_SESSION_HOURS,
  AGENT_SESSION_VIEWS,
  AGENT_USAGE_SOURCES,
} from "./agentSettings";
import type { AgentSessionSummary } from "./api";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { UsageView } from "./usage";
import { useAgentUsages } from "./useAgentUsages";
import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentSessionView } from "./agentSettings";

function previewSessions(now: number, labels: { waitTitle: string; runTitle: string; doneTitle: string; waitPrompt: string }): AgentSessionSummary[] {
  return [
    {
      provider: "antigravity",
      sessionId: "preview-wait",
      cwd: "~/Projects/Fuyu",
      title: labels.waitTitle,
      model: "gemini-4-neon",
      effort: "high",
      phase: "waiting",
      updatedAt: now - 45_000,
      turnStartedAt: now - 90_000,
      lastMessage: null,
      lastPrompt: labels.waitPrompt,
      currentTool: { name: "run_command", detail: "git grep -n \"AGENTS.md\" scripts/ tests/" },
      host: { name: "Antigravity", exe: null, kind: "editor" },
    },
    {
      provider: "claudeCode",
      sessionId: "preview-run",
      cwd: "~/Projects/Fuyu",
      title: labels.runTitle,
      model: "Opus 4.6",
      effort: "high",
      phase: "running",
      permissionMode: "auto",
      updatedAt: now - 15_000,
      turnStartedAt: now - 78_000,
      lastMessage: null,
      currentTool: { name: "Edit", detail: "src/features/agent-status/AgentSessionsPanel.tsx" },
      todos: { done: 3, total: 5, current: null },
      host: { name: "Terminal", exe: null, kind: "terminal" },
    },
    {
      provider: "claudeCode",
      sessionId: "preview-done",
      cwd: "~/Projects/Fuxi",
      title: labels.doneTitle,
      model: "Sonnet 4.5",
      effort: null,
      phase: "completed",
      updatedAt: now - 23 * 60_000,
      turnStartedAt: null,
      lastMessage: null,
      host: null,
    },
  ];
}

export function AgentSessionListSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.agent;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  type Toggle = "agentExpandChildren" | "agentHideFinished" | "agentHideClosed" | "agentShowElapsed" | "agentShowModel" | "agentShowActivity";
  const toggle = (key: Toggle, title: string, description?: string) => (
    <SettingsToggleRow title={title} description={description} checked={settings[key]} onChange={(value) => update({ [key]: value })} />
  );
  const agentsOff = settings.agentHiddenProviders;
  const usages = useAgentUsages(settings.agentShowUsage, AGENT_USAGE_SOURCES.filter((source) => !agentsOff.includes(source)));
  const usageView: UsageView = {
    hidden: settings.agentUsageHidden,
    tightest: settings.agentUsageTightest,
    reset: settings.agentUsageReset,
    style: settings.agentUsageStyle,
    layout: settings.agentUsageLayout,
    agentsOff,
  };
  const sample = useMemo(() => previewSessions(Date.now(), text.sessionPreviewSample), [text.sessionPreviewSample]);

  return (
    <>
      <SettingsGroup title={text.sessionCardSection}>
        <SettingsRow title={text.sessionView} description={text.sessionViewHint}>
          <div className="agent-stage">
            <SettingsChoiceCards<AgentSessionView>
              value={settings.agentSessionView}
              ariaLabel={text.sessionView}
              columns={3}
              options={AGENT_SESSION_VIEWS.map((value) => ({
                value,
                label: text.sessionViewOptions[value],
                hint: text.sessionViewHints[value],
                art: <SessionViewArt view={value} />,
              }))}
              onChange={(agentSessionView) => update({ agentSessionView })}
            />
            <AgentStageIsland settings={settings} label={text.sessionViewPreview}>
              <div className="agent-stage-island__sessions">
                <SessionLightAlwaysActiveContext.Provider value>
                  <SessionLightStyleContext.Provider value={settings.agentLightStyle}>
                    <AgentSessionsPanel
                      sessions={sample}
                      view={settings.agentSessionView}
                      sort={settings.agentSessionSort}
                      group={settings.agentSessionGroup}
                      cardEffects={settings.agentCardEffects}
                      hostDisplay={settings.agentHostDisplay}
                      showElapsed={settings.agentShowElapsed}
                      showModel={settings.agentShowModel}
                      showActivity={settings.agentShowActivity}
                      showUsage={settings.agentShowUsage}
                      usages={usages}
                      usageView={usageView}
                    />
                  </SessionLightStyleContext.Provider>
                </SessionLightAlwaysActiveContext.Provider>
              </div>
            </AgentStageIsland>
          </div>
        </SettingsRow>
        <SettingsRow
          title={text.cardEffects}
          description={text.cardEffectsHint}
          control={
            <SettingsSelect<AgentCardEffects>
              value={settings.agentCardEffects}
              options={AGENT_CARD_EFFECTS.map((value) => ({ value, label: text.cardEffectsOptions[value] }))}
              ariaLabel={text.cardEffects}
              onChange={(agentCardEffects) => update({ agentCardEffects })}
            />
          }
        />
        <SettingsRow
          title={text.archiveMotion}
          description={text.archiveMotionHint}
          control={
            <SettingsChoice<AgentArchiveMotion>
              value={settings.agentArchiveMotion}
              options={AGENT_ARCHIVE_MOTIONS.map((value) => ({ value, label: text.archiveMotionOptions[value] }))}
              ariaLabel={text.archiveMotion}
              onChange={(agentArchiveMotion) => update({ agentArchiveMotion })}
            />
          }
        />
        <SettingsRow
          title={text.hostDisplay}
          description={isMacOS ? text.hostDisplayHintMac : text.hostDisplayHint}
          control={
            <SettingsSelect<AgentHostDisplay>
              value={settings.agentHostDisplay}
              options={AGENT_HOST_DISPLAYS.map((value) => ({ value, label: text.hostDisplayOptions[value] }))}
              ariaLabel={text.hostDisplay}
              onChange={(agentHostDisplay) => update({ agentHostDisplay })}
            />
          }
        />
        {toggle("agentShowModel", text.showModel)}
        {toggle("agentShowActivity", text.showActivity, text.showActivityHint)}
        {toggle("agentShowElapsed", text.showElapsed, text.showElapsedHint)}
      </SettingsGroup>
      <SettingsGroup title={text.sessionPageSection}>
        <SettingsRow
          title={text.sessionHours}
          description={text.sessionHoursHint}
          control={
            <SettingsSelect
              value={String(settings.agentSessionHours)}
              options={AGENT_SESSION_HOURS.map((hours) => ({ value: String(hours), label: text.sessionHoursOption(hours) }))}
              ariaLabel={text.sessionHours}
              onChange={(hours) => update({ agentSessionHours: Number(hours) })}
            />
          }
        />
        {toggle("agentExpandChildren", text.expandChildren, text.expandChildrenHint)}
        {toggle("agentHideFinished", text.hideFinished, text.hideFinishedHint)}
        {toggle("agentHideClosed", text.hideClosed, text.hideClosedHint)}
      </SettingsGroup>
    </>
  );
}
