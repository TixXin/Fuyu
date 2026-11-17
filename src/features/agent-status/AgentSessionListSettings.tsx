import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsChoiceCards } from "../../components/settings/SettingsChoiceCards";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { SessionViewArt } from "./AgentAppearanceGlyphs";
import {
  AGENT_HOST_DISPLAYS,
  AGENT_ARCHIVE_MOTIONS,
  AGENT_CARD_EFFECTS,
  AGENT_SESSION_HOURS,
  AGENT_SESSION_VIEWS,
} from "./agentSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentSessionView } from "./agentSettings";

export function AgentSessionListSettings({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.agent;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  type Toggle = "agentExpandChildren" | "agentHideFinished" | "agentHideClosed" | "agentShowUsage" | "agentShowElapsed" | "agentShowModel" | "agentShowActivity";
  const toggle = (key: Toggle, title: string, description?: string) => (
    <SettingsToggleRow title={title} description={description} checked={settings[key]} onChange={(value) => update({ [key]: value })} />
  );

  return (
    <>
      <SettingsGroup title={text.sessionCardSection}>
        <SettingsRow title={text.sessionView} description={text.sessionViewHint}>
          <SettingsChoiceCards<AgentSessionView>
            value={settings.agentSessionView}
            ariaLabel={text.sessionView}
            options={AGENT_SESSION_VIEWS.map((value) => ({
              value,
              label: text.sessionViewOptions[value],
              hint: text.sessionViewHints[value],
              art: <SessionViewArt view={value} />,
            }))}
            onChange={(agentSessionView) => update({ agentSessionView })}
          />
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
        {toggle("agentShowUsage", text.showUsage, text.showUsageHint)}
      </SettingsGroup>
    </>
  );
}
