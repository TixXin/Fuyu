import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { AGENT_ARCHIVE_MOTIONS, AGENT_CARD_EFFECTS, AGENT_SESSION_VIEWS, DEFAULT_AGENT_SETTINGS, type AgentSessionView } from "../../features/agent-status/agentSettings";
import type { IslandSettings } from "../../lib/settings/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import "./AgentCardsAct.css";

function LayoutThumb({ view }: { view: AgentSessionView }) {
  if (view === "focused") {
    return (
      <span className="agent-layout-thumb agent-layout-thumb--focused" aria-hidden="true">
        <span className="agent-layout-thumb__hero" />
        <span className="agent-layout-thumb__row" />
        <span className="agent-layout-thumb__row" />
      </span>
    );
  }
  if (view === "split") {
    return (
      <span className="agent-layout-thumb agent-layout-thumb--split" aria-hidden="true">
        <span className="agent-layout-thumb__col">
          <span className="agent-layout-thumb__row" />
          <span className="agent-layout-thumb__row" />
        </span>
        <span className="agent-layout-thumb__hero" />
      </span>
    );
  }
  if (view === "bento") {
    return (
      <span className="agent-layout-thumb agent-layout-thumb--bento" aria-hidden="true">
        <span className="agent-layout-thumb__tile" />
        <span className="agent-layout-thumb__tile" />
        <span className="agent-layout-thumb__tile" />
        <span className="agent-layout-thumb__tile" />
      </span>
    );
  }
  if (view === "projects") {
    return (
      <span className="agent-layout-thumb agent-layout-thumb--projects" aria-hidden="true">
        <span className="agent-layout-thumb__bar" />
        <span className="agent-layout-thumb__row" />
        <span className="agent-layout-thumb__bar" />
        <span className="agent-layout-thumb__row" />
      </span>
    );
  }
  return (
    <span className="agent-layout-thumb agent-layout-thumb--minimal" aria-hidden="true">
      <span className="agent-layout-thumb__line" />
      <span className="agent-layout-thumb__line" />
      <span className="agent-layout-thumb__line" />
    </span>
  );
}

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
      <div className="agent-cards-act__grid" role="radiogroup" aria-label={text.sessionView}>
        {AGENT_SESSION_VIEWS.map((view) => {
          const chosen = settings.agentSessionView === view;
          const isRecommended = view === DEFAULT_AGENT_SETTINGS.agentSessionView;
          return (
            <button
              key={view}
              type="button"
              role="radio"
              aria-checked={chosen}
              data-session-view={view}
              className={chosen ? "agent-cards-act__option agent-cards-act__option--chosen" : "agent-cards-act__option"}
              onClick={() => update({ agentSessionView: view })}
            >
              <LayoutThumb view={view} />
              <span className="agent-cards-act__name">
                <span>{text.sessionViewOptions[view]}</span>
                {isRecommended && <span className="agent-cards-act__badge">{act.recommendedBadge}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <SettingsGroup>
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
        {settings.agentSessionView !== "minimal" && (
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
