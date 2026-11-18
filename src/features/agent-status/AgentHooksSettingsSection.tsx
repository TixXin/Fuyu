import { Activity, CircleAlert, CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import type { AgentHooksInstallResult, AgentHooksState, AgentHooksUninstallResult, AgentStatusSnapshot } from "./api";
import { RemoteResultLines } from "./RemoteResultLines";
import {
  getAgentHooksNotice,
  getAgentStatusLabel,
  getAgentVisualState,
  hasInstalledAgentHooks,
  type AgentHooksInstallState,
  type AgentHooksUninstallState,
  type AgentVisualState,
} from "./status";
import "./AgentHooksSettingsSection.css";

type HooksCardTone = "muted" | "ok" | "warn" | "busy" | "error";

function resolveCardTone(
  installState: AgentHooksInstallState,
  uninstallState: AgentHooksUninstallState,
  hooksNotice: "update" | "install" | null,
  visualState: AgentVisualState,
  hooksState: AgentHooksState | null,
): HooksCardTone {
  if (installState === "error" || uninstallState === "error") return "error";
  if (installState === "installing" || uninstallState === "uninstalling") return "busy";
  if (hooksNotice !== null || visualState === "attention") return "warn";
  if (visualState === "running" || installState === "installed" || hooksState !== null) return "ok";
  return "muted";
}

function HooksStatusIcon({
  installState,
  uninstallState,
  hooksNotice,
  visualState,
}: {
  installState: AgentHooksInstallState;
  uninstallState: AgentHooksUninstallState;
  hooksNotice: "update" | "install" | null;
  visualState: AgentVisualState;
}) {
  const props = { size: 20, strokeWidth: 1.9, "aria-hidden": true } as const;
  if (installState === "installing" || uninstallState === "uninstalling") {
    return <LoaderCircle className="agent-hooks-card__spinner" {...props} />;
  }
  if (installState === "error" || uninstallState === "error") return <TriangleAlert {...props} />;
  if (hooksNotice !== null || visualState === "attention") return <CircleAlert {...props} />;
  if (visualState === "running") return <Activity {...props} />;
  return <CircleCheck {...props} />;
}

export function AgentHooksSettingsSection({
  agentStatus,
  agentHooksInstallState,
  agentHooksInstallResult,
  agentHooksInstallError,
  agentHooksUninstallState = "idle",
  agentHooksUninstallResult = null,
  agentHooksUninstallError = "",
  agentHooksState,
  onInstallAgentHooks,
  onUninstallAgentHooks,
}: {
  agentStatus: AgentStatusSnapshot;
  clearingAgentProvider?: string | null;
  agentHooksInstallState: AgentHooksInstallState;
  agentHooksInstallResult: AgentHooksInstallResult | null;
  agentHooksInstallError: string;
  agentHooksUninstallState?: AgentHooksUninstallState;
  agentHooksUninstallResult?: AgentHooksUninstallResult | null;
  agentHooksUninstallError?: string;
  agentHooksState: AgentHooksState | null;
  onClearAgentStatus?: (provider: string) => void;
  onInstallAgentHooks: () => void;
  onUninstallAgentHooks?: () => void;
}) {
  const t = useTranslation();
  const text = t.settings.agent;
  const devBuild = useDevBuild();
  const hooksNotice = getAgentHooksNotice(agentHooksState);
  const visualState = getAgentVisualState(agentStatus);
  const tone = resolveCardTone(
    agentHooksInstallState,
    agentHooksUninstallState,
    hooksNotice,
    visualState,
    agentHooksState,
  );
  const busy = agentHooksInstallState === "installing" || agentHooksUninstallState === "uninstalling";
  const showUninstall =
    !devBuild &&
    Boolean(onUninstallAgentHooks) &&
    (hasInstalledAgentHooks(agentHooksState) || agentHooksUninstallState === "uninstalling");
  const installLabel =
    agentHooksInstallState === "installing"
      ? text.installing
      : agentHooksInstallState === "installed"
        ? text.installed
        : text.install;
  const uninstallLabel =
    agentHooksUninstallState === "uninstalling"
      ? text.uninstalling
      : agentHooksUninstallState === "uninstalled"
        ? text.uninstalled
        : text.uninstall;
  const actionError =
    agentHooksInstallState === "error"
      ? agentHooksInstallError
      : agentHooksUninstallState === "error"
        ? agentHooksUninstallError
        : "";

  const statusNote = actionError ? (
    <span className="agent-hooks-message agent-hooks-message--error" role="alert">
      {actionError}
    </span>
  ) : hooksNotice ? (
    <span className="agent-hooks-message agent-hooks-message--attention" role="status">
      <CircleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
      {hooksNotice === "update" ? text.hooksOutdated : text.hooksMissing}
    </span>
  ) : devBuild ? (
    <span className="agent-hooks-message" role="status">
      {text.hooksDevBuild}
    </span>
  ) : (
    <span className="agent-hooks-message" role="status">
      {text.hooksReady}
    </span>
  );

  return (
    <SettingsGroup title={text.title}>
      <div className={`agent-hooks-card agent-hooks-card--${tone}`}>
        <div className="agent-hooks-card__row">
          <span className="agent-hooks-card__icon">
            <HooksStatusIcon
              installState={agentHooksInstallState}
              uninstallState={agentHooksUninstallState}
              hooksNotice={hooksNotice}
              visualState={visualState}
            />
          </span>
          <div className="agent-hooks-card__copy">
            <div className="agent-hooks-card__headline">
              <span className="agent-hooks-card__label">{text.currentStatus}</span>
              <strong className={visualState === "attention" ? "agent-hooks-value agent-hooks-value--attention" : "agent-hooks-value"}>
                {getAgentStatusLabel(agentStatus, t)}
              </strong>
            </div>
            {statusNote}
          </div>
          <div className="agent-hooks-card__actions">
            {showUninstall ? (
              <button
                type="button"
                className="settings-link-button agent-hooks-card__button agent-hooks-card__button--secondary"
                disabled={busy}
                onClick={onUninstallAgentHooks}
              >
                {uninstallLabel}
              </button>
            ) : null}
            <button
              type="button"
              className={
                hooksNotice
                  ? "settings-link-button agent-hooks-card__button agent-hooks-card__button--primary"
                  : "settings-link-button agent-hooks-card__button"
              }
              disabled={busy}
              onClick={onInstallAgentHooks}
            >
              {installLabel}
            </button>
          </div>
        </div>
        {agentHooksInstallState === "installed" && agentHooksInstallResult ? (
          <div className="agent-hooks-card__result">
            <span className="agent-hooks-message">
              <span>
                {text.scriptsDir} <code>{agentHooksInstallResult.scriptsDir}</code>
                <RemoteResultLines results={agentHooksInstallResult.remotes} />
                {agentHooksInstallResult.dshBridge ? (
                  <span>
                    <br />
                    {text.dshBridge}
                    <code className="agent-hooks-snippet">{agentHooksInstallResult.dshBridge}</code>
                  </span>
                ) : null}
              </span>
            </span>
          </div>
        ) : null}
        {agentHooksUninstallState === "uninstalled" && agentHooksUninstallResult ? (
          <div className="agent-hooks-card__result">
            <span className="agent-hooks-message" role="status">
              <span>
                {text.hooksRemoved}
                <RemoteResultLines results={agentHooksUninstallResult.remotes} />
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </SettingsGroup>
  );
}
