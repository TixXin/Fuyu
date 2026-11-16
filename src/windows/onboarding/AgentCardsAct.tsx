import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { AGENT_ARCHIVE_MOTIONS, AGENT_CARD_EFFECTS, AGENT_SESSION_VIEWS, DEFAULT_AGENT_SETTINGS } from "../../features/agent-status/agentSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";

export function AgentCardsAct({ settings, onSettingsChange }: { settings: IslandSettings; onSettingsChange: (settings: IslandSettings) => void }) {
  const t = useTranslation();
  const text = t.settings.agent;
  const act = t.onboarding.agentCards;
  const update = (patch: Partial<IslandSettings>) => onSettingsChange({ ...settings, ...patch });
  const options = <T extends string>(values: readonly T[], labels: Record<T, string>, recommended: T) =>
    values.map((value) => ({ value, label: value === recommended ? act.recommended(labels[value]) : labels[value] }));

  return (
    <>
      <ActHeading title={act.title} lead={act.lead} />
      <SettingsGroup>
        <SettingsRow
          title={text.sessionView}
          description={text.sessionViewHint}
          control={
            <SettingsSelect
              value={settings.agentSessionView}
              options={options(AGENT_SESSION_VIEWS, text.sessionViewOptions, DEFAULT_AGENT_SETTINGS.agentSessionView)}
              ariaLabel={text.sessionView}
              onChange={(agentSessionView) => update({ agentSessionView })}
            />
          }
        />
        <SettingsRow
          title={text.archiveMotion}
          description={text.archiveMotionHint}
          control={
            <SettingsSelect
              value={settings.agentArchiveMotion}
              options={options(AGENT_ARCHIVE_MOTIONS, text.archiveMotionOptions, DEFAULT_AGENT_SETTINGS.agentArchiveMotion)}
              ariaLabel={text.archiveMotion}
              onChange={(agentArchiveMotion) => update({ agentArchiveMotion })}
            />
          }
        />
        {settings.agentSessionView !== "list" && (
          <SettingsRow
            indent
            title={text.cardEffects}
            description={text.cardEffectsHint}
            control={
              <SettingsSelect
                value={settings.agentCardEffects}
                options={options(AGENT_CARD_EFFECTS, text.cardEffectsOptions, DEFAULT_AGENT_SETTINGS.agentCardEffects)}
                ariaLabel={text.cardEffects}
                onChange={(agentCardEffects) => update({ agentCardEffects })}
              />
            }
          />
        )}
      </SettingsGroup>
    </>
  );
}
