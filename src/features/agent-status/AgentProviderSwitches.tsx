import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import type { IslandSettings } from "../../lib/settings/types";
import { AGENTS } from "./agents";
import { AgentProviderIcon } from "./AgentProviderIcon";
import type {
  AgentHooksState,
  AgentStatusSnapshot,
  AgentTaskStatus,
  ExternalAgentStatus,
  HookInstallState,
  SessionProvider,
} from "./api";
import {
  AGENT_PROVIDER_LABELS,
  DEFAULT_AGENT_STATUS,
  DEFAULT_AGENT_TASK_STATUS,
  getAgentPhaseLabel,
  isAgentAttentionPhase,
  partitionAgentProviders,
} from "./status";
import "./AgentHooksSettingsSection.css";

const SHOWN_PROVIDERS = Object.keys(AGENT_PROVIDER_LABELS) as SessionProvider[];

type DotTone = "idle" | "running" | "waiting" | "attention" | "done";

function resolveDotTone(status: AgentTaskStatus, hookState: HookInstallState | undefined): DotTone {
  if (status.phase === "running") return "running";
  if (status.phase === "waiting") return "waiting";
  if (isAgentAttentionPhase(status.phase) || hookState === "outdated" || hookState === "notInstalled") return "attention";
  if (status.phase === "completed") return "done";
  return "idle";
}

function ExternalTile({
  entry,
  clearing,
  onClearStatus,
}: {
  entry: ExternalAgentStatus;
  clearing: boolean;
  onClearStatus?: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.agent;
  const attention = isAgentAttentionPhase(entry.phase);
  const active = entry.phase === "running" || entry.phase === "waiting";
  const dotTone = resolveDotTone(entry, undefined);
  const cardClass = [
    "agent-provider-card",
    attention ? "agent-provider-card--attention" : "",
    active ? "agent-provider-card--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} data-provider={entry.id}>
      <span className="agent-provider-card__icon" aria-hidden="true">
        <AgentProviderIcon provider={entry.agent ?? entry.id} />
      </span>
      <div className="agent-provider-card__body">
        <span className="agent-provider-card__name">{entry.name}</span>
        <div className="agent-provider-card__meta">
          <span className={`agent-provider-card__dot agent-provider-card__dot--${dotTone}`} aria-hidden="true" />
          <span className={attention ? "agent-hooks-value agent-hooks-value--attention" : "agent-hooks-value"}>
            {getAgentPhaseLabel(entry.phase, t)}
          </span>
          {attention && onClearStatus ? (
            <SettingsLinkButton disabled={clearing} onClick={onClearStatus}>
              {clearing ? text.clearing : text.clearStatus}
            </SettingsLinkButton>
          ) : null}
        </div>
      </div>
      <div className="agent-provider-card__side">
        <span className="agent-provider-card__tag">{text.externalBadge}</span>
      </div>
    </div>
  );
}

function ProviderTile({
  provider,
  shown,
  status,
  hookState,
  devBuild,
  clearing,
  onToggle,
  onClearStatus,
}: {
  provider: SessionProvider;
  shown: boolean;
  status: AgentTaskStatus;
  hookState: HookInstallState | undefined;
  devBuild: boolean;
  clearing: boolean;
  onToggle: (shown: boolean) => void;
  onClearStatus?: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.agent;
  const switchId = useId();
  const attention = isAgentAttentionPhase(status.phase);
  const active = status.phase === "running" || status.phase === "waiting";
  const dotTone = resolveDotTone(status, hookState);
  const needsHookAttention = status.phase === "idle" && (hookState === "outdated" || hookState === "notInstalled");
  const statusText =
    status.phase !== "idle"
      ? getAgentPhaseLabel(status.phase, t)
      : !AGENTS[provider].statusLight
        ? text.sessionOnlyBadge
        : hookState === "outdated"
          ? text.hookBadgeOutdated
          : hookState === "notInstalled"
            ? text.hookBadgeNotInstalled
            : hookState === "absent"
              ? text.notDetectedBadge
              : getAgentPhaseLabel("idle", t);

  const cardClass = [
    "agent-provider-card",
    shown ? "" : "agent-provider-card--off",
    shown && attention ? "agent-provider-card--attention" : "",
    shown && active ? "agent-provider-card--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClass} data-provider={provider}>
      <span className="agent-provider-card__icon" aria-hidden="true">
        <AgentProviderIcon provider={provider} />
      </span>
      <div className="agent-provider-card__body">
        <label className="agent-provider-card__name" htmlFor={switchId}>
          {AGENT_PROVIDER_LABELS[provider]}
        </label>
        <div className="agent-provider-card__meta">
          <span className={`agent-provider-card__dot agent-provider-card__dot--${dotTone}`} aria-hidden="true" />
          <span className={attention || needsHookAttention ? "agent-hooks-value agent-hooks-value--attention" : "agent-hooks-value"}>
            {statusText}
          </span>
          {attention && !devBuild && onClearStatus ? (
            <SettingsLinkButton disabled={clearing} onClick={onClearStatus}>
              {clearing ? text.clearing : text.clearStatus}
            </SettingsLinkButton>
          ) : null}
        </div>
      </div>
      <div className="agent-provider-card__side">
        <SettingsSwitch id={switchId} checked={shown} onChange={onToggle} />
      </div>
    </div>
  );
}

export function AgentProviderSwitches({
  settings,
  onSettingsChange,
  agentStatus = DEFAULT_AGENT_STATUS,
  agentHooksState = null,
  clearingAgentProvider = null,
  onClearAgentStatus,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  agentStatus?: AgentStatusSnapshot;
  agentHooksState?: AgentHooksState | null;
  clearingAgentProvider?: string | null;
  onClearAgentStatus?: (provider: string) => void;
}) {
  const text = useTranslation().settings.agent;
  const devBuild = useDevBuild();
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, more } = partitionAgentProviders(SHOWN_PROVIDERS, agentStatus, agentHooksState);
  const externals = agentStatus.others ?? [];
  const enabledCount = SHOWN_PROVIDERS.filter((provider) => !settings.agentHiddenProviders.includes(provider)).length;

  const setProviderShown = (provider: SessionProvider, shown: boolean) => {
    onSettingsChange({
      ...settings,
      agentHiddenProviders: shown
        ? settings.agentHiddenProviders.filter((hidden) => hidden !== provider)
        : [...settings.agentHiddenProviders, provider],
    });
  };

  const renderTile = (provider: SessionProvider) => {
    const status = (agentStatus as Partial<Record<SessionProvider, AgentTaskStatus>>)[provider] ?? DEFAULT_AGENT_TASK_STATUS;
    const hookState = (agentHooksState as Partial<Record<SessionProvider, HookInstallState>> | null)?.[provider];
    return (
      <ProviderTile
        key={provider}
        provider={provider}
        shown={!settings.agentHiddenProviders.includes(provider)}
        status={status}
        hookState={hookState}
        devBuild={devBuild}
        clearing={clearingAgentProvider === provider}
        onToggle={(shown) => setProviderShown(provider, shown)}
        onClearStatus={onClearAgentStatus ? () => onClearAgentStatus(provider) : undefined}
      />
    );
  };

  return (
    <section className="settings-group agent-providers-group">
      <div className="settings-group__header">
        <h2 className="settings-group__title">{text.agentsSection}</h2>
        <span className="agent-providers__summary">{text.agentsEnabledCount(enabledCount, SHOWN_PROVIDERS.length)}</span>
      </div>
      <div className="agent-provider-grid">
        {primary.map(renderTile)}
        {externals.map((entry) => (
          <ExternalTile
            key={entry.id}
            entry={entry}
            clearing={clearingAgentProvider === entry.id}
            onClearStatus={onClearAgentStatus ? () => onClearAgentStatus(entry.id) : undefined}
          />
        ))}
      </div>
      {more.length > 0 ? (
        <div className="agent-providers__more">
          <button
            type="button"
            className={`agent-providers__more-toggle${moreOpen ? " agent-providers__more-toggle--open" : ""}`}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <ChevronDown className="agent-providers__more-chevron" size={14} strokeWidth={2} aria-hidden="true" />
            <span>{text.moreAgents(more.length)}</span>
          </button>
          {moreOpen ? <div className="agent-provider-grid agent-provider-grid--more">{more.map(renderTile)}</div> : null}
        </div>
      ) : null}
      <div className="settings-group__footer">
        <SettingsFootnote text={text.showAgentsHint} />
      </div>
    </section>
  );
}
