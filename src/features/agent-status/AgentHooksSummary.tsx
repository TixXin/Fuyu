import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import type { AgentHooksState } from "./api";
import { anyHookInstalled, hookWork, repairTargets } from "./hookPlan";
import { getAgentProviderLabel } from "./status";
import "./AgentHooksSettingsSection.css";

export function AgentHooksSummary({
  providers,
  hidden,
  agentHooksState,
  hookBusy,
  hookErrors,
  hookDone,
  dshBridge,
  busy: bulkBusy,
  onInstallHooks,
  onInstallAll,
}: {
  providers: readonly string[];
  hidden: readonly string[];
  agentHooksState: AgentHooksState | null;
  hookBusy: ReadonlySet<string>;
  hookErrors: Record<string, string>;
  hookDone: string[];
  dshBridge: string | null;
  busy: boolean;
  onInstallHooks: (providers: string[]) => void;
  onInstallAll: () => void;
}) {
  const t = useTranslation().settings.agent;
  const text = t.hooks;
  const devBuild = useDevBuild();
  const names = (list: readonly string[]) => list.map(getAgentProviderLabel).join(text.listJoin);
  if (!agentHooksState) return null;
  const work = hookWork(agentHooksState, providers, hidden);
  const repair = repairTargets(agentHooksState, providers, hidden);
  const missing = !anyHookInstalled(agentHooksState, providers) && work.install.length > 0;
  const busy = bulkBusy || hookBusy.size > 0;
  const errors = Object.entries(hookErrors);
  const done = hookDone.filter((provider) => !hookErrors[provider]);

  const bar = repair.length > 0 ? (
    <div className="agent-hooks-summary agent-hooks-summary--warn" role="status">
      <CircleAlert size={16} strokeWidth={2.2} aria-hidden="true" />
      <span className="agent-hooks-summary__text">
        {work.fix.length > 0 ? text.summaryFix(work.fix.length, names(work.fix)) : text.summaryScripts}
      </span>
      <button type="button" className="agent-hook-action agent-hook-action--fix" disabled={busy} onClick={() => onInstallHooks(repair)}>
        {busy ? text.working : text.fixAll}
      </button>
    </div>
  ) : missing ? (
    <div className="agent-hooks-summary agent-hooks-summary--warn" role="status">
      <CircleAlert size={16} strokeWidth={2.2} aria-hidden="true" />
      <span className="agent-hooks-summary__text">{text.summaryMissing}</span>
      <button type="button" className="agent-hook-action agent-hook-action--fix" disabled={busy} onClick={onInstallAll}>
        {busy ? text.working : text.installAll}
      </button>
    </div>
  ) : null;

  const lines = (
    <>
      {errors.map(([provider, error]) => (
        <span key={provider} className="agent-hooks-message agent-hooks-message--error" role="alert">
          <TriangleAlert size={13} strokeWidth={2.4} aria-hidden="true" />
          {text.failed(getAgentProviderLabel(provider), error)}
        </span>
      ))}
      {!busy && done.length > 0 ? (
        <span className="agent-hooks-message" role="status">
          <CircleCheck size={13} strokeWidth={2.4} aria-hidden="true" />
          {text.done(names(done))}
        </span>
      ) : null}
      {dshBridge ? (
        <span className="agent-hooks-message agent-hooks-message--attention">
          <span>
            {t.dshBridge}
            <code className="agent-hooks-snippet">{dshBridge}</code>
          </span>
        </span>
      ) : null}
      {devBuild ? <span className="agent-hooks-message">{t.hooksDevBuild}</span> : null}
    </>
  );

  if (!bar && errors.length === 0 && done.length === 0 && !dshBridge && !devBuild) return null;
  return (
    <div className="agent-hooks-summary-stack">
      {bar}
      {lines}
    </div>
  );
}
