import { useId, useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { useTranslation } from "../../i18n";
import { AGENTS } from "./agents";
import { AgentProviderIcon } from "./AgentProviderIcon";
import { AgentProviderMenu, type AgentProviderMenuItem } from "./AgentProviderMenu";
import type { AgentTaskStatus, HookInstallState, SessionProvider } from "./api";
import { isHookInstalled } from "./hookPlan";
import { AGENT_PROVIDER_LABELS, getAgentPhaseLabel, isAgentAttentionPhase } from "./status";

type DotTone = "idle" | "running" | "waiting" | "attention" | "done";

export function resolveDotTone(status: AgentTaskStatus, hookState: HookInstallState | undefined): DotTone {
  if (status.phase === "running") return "running";
  if (status.phase === "waiting") return "waiting";
  if (isAgentAttentionPhase(status.phase) || hookState === "outdated") return "attention";
  if (status.phase === "completed") return "done";
  return "idle";
}

export function AgentProviderTile({
  provider,
  shown,
  status,
  hookState,
  busy,
  clearing,
  canRemoveHooks,
  onToggle,
  onInstallHooks,
  onRemoveHooks,
  onClearStatus,
}: {
  provider: SessionProvider;
  shown: boolean;
  status: AgentTaskStatus;
  hookState: HookInstallState | undefined;
  busy: boolean;
  clearing: boolean;
  canRemoveHooks: boolean;
  onToggle: (shown: boolean) => void;
  onInstallHooks: () => void;
  onRemoveHooks: () => void;
  onClearStatus?: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.agent;
  const switchId = useId();
  const [confirming, setConfirming] = useState(false);
  const name = AGENT_PROVIDER_LABELS[provider];
  const attention = isAgentAttentionPhase(status.phase);
  const active = status.phase === "running" || status.phase === "waiting";
  const hasHooks = hookState !== undefined && hookState !== "absent";
  const outdated = shown && hookState === "outdated";
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

  const toggle = (next: boolean) => {
    if (!next && canRemoveHooks && isHookInstalled(hookState)) {
      setConfirming(true);
      return;
    }
    onToggle(next);
    if (next && (hookState === "notInstalled" || hookState === "outdated")) onInstallHooks();
  };

  const menu: AgentProviderMenuItem[] = [];
  if (hasHooks) menu.push({ key: "install", label: isHookInstalled(hookState) ? text.hooks.menuReinstall : text.hooks.menuInstall, disabled: busy, onSelect: onInstallHooks });
  if (attention && onClearStatus) menu.push({ key: "clear", label: clearing ? text.clearing : text.clearStatus, disabled: clearing, onSelect: onClearStatus });
  const tip = text.hooks.tips[provider as keyof typeof text.hooks.tips];

  const action = busy ? (
    <span className="agent-hook-action agent-hook-action--busy" role="status">
      <LoaderCircle className="agent-hooks-card__spinner" size={12} strokeWidth={2.4} aria-hidden="true" />
      {text.hooks.working}
    </span>
  ) : !shown || !hasHooks ? null : hookState === "current" ? (
    <span className="agent-hook-action agent-hook-action--ok" title={text.hooks.connectedTitle} aria-label={text.hooks.connected}>
      <CircleCheck size={15} strokeWidth={2.2} aria-hidden="true" />
    </span>
  ) : (
    <button type="button" className={`agent-hook-action agent-hook-action--${outdated ? "fix" : "install"}`} onClick={onInstallHooks}>
      {outdated ? text.hooks.fix : text.hooks.install}
    </button>
  );

  const cardClass = [
    "agent-provider-card",
    shown ? "" : "agent-provider-card--off",
    shown && (attention || outdated) ? "agent-provider-card--attention" : "",
    shown && active ? "agent-provider-card--active" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={cardClass} data-provider={provider} data-hook-state={hookState ?? "none"}>
      <span className="agent-provider-card__icon" aria-hidden="true">
        <AgentProviderIcon provider={provider} />
      </span>
      <div className="agent-provider-card__body">
        <label className="agent-provider-card__name" htmlFor={switchId}>{name}</label>
        <div className="agent-provider-card__meta">
          <span className={`agent-provider-card__dot agent-provider-card__dot--${resolveDotTone(status, shown ? hookState : undefined)}`} aria-hidden="true" />
          <span className={attention || outdated ? "agent-hooks-value agent-hooks-value--attention" : "agent-hooks-value"}>{statusText}</span>
        </div>
      </div>
      <div className="agent-provider-card__side">
        {action}
        {menu.length > 0 || tip ? <AgentProviderMenu label={text.hooks.menu(name)} items={menu} hint={tip} /> : null}
        <SettingsSwitch id={switchId} checked={shown} onChange={toggle} />
      </div>
      {confirming ? (
        <div className="agent-provider-card__confirm" role="alertdialog" aria-label={text.hooks.turnOff(name)}>
          <span className="agent-provider-card__confirm-text">{text.hooks.turnOff(name)}</span>
          <SettingsLinkButton onClick={() => setConfirming(false)}>{t.common.cancel}</SettingsLinkButton>
          <SettingsLinkButton onClick={() => { setConfirming(false); onToggle(false); }}>{text.hooks.turnOffKeep}</SettingsLinkButton>
          <SettingsLinkButton tone="danger" onClick={() => { setConfirming(false); onToggle(false); onRemoveHooks(); }}>{text.hooks.turnOffRemove}</SettingsLinkButton>
        </div>
      ) : null}
    </div>
  );
}
