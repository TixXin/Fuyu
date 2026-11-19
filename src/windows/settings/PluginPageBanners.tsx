import { useState, type ReactNode } from "react";
import { Activity, AlertCircle, Download, ExternalLink, LoaderCircle, Power, RefreshCw, ShieldAlert, Unplug } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { exitPluginSafeMode, type HostNodeStatus } from "../../features/plugin-kernel/api";
import type { InstalledEntry } from "./pluginEntries";
import { openPluginDocs } from "./pluginMarketActions";
import type { PluginHostView } from "./usePluginHostStatus";

export type BannerTone = "info" | "warn" | "bad";

export function PluginBanner({ tone, icon, title, children, actions, extra, name }: {
  tone: BannerTone;
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  extra?: ReactNode;
  name: string;
}) {
  return (
    <section className={`plugin-banner plugin-banner--${tone}`} data-banner={name}>
      <span className="plugin-banner__icon" aria-hidden="true">{icon}</span>
      <div className="plugin-banner__title">{title}</div>
      {children ? <div className="plugin-banner__body">{children}</div> : null}
      {extra}
      {actions ? <div className="plugin-banner__actions">{actions}</div> : null}
    </section>
  );
}

function megabytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function RuntimeBanner({ node, onRetry }: { node: HostNodeStatus | null; onRetry: () => void }) {
  const text = useTranslation().settings.pluginsV3.page.banners;
  if (node?.state === "downloading") {
    const percent = node.total ? Math.min(100, Math.round((node.downloaded / node.total) * 100)) : null;
    return (
      <PluginBanner
        name="runtime-downloading"
        tone="info"
        icon={<Download size={16} strokeWidth={2.2} />}
        title={text.runtimeDownloading}
        extra={
          <>
            <div className="plugin-banner__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
              <i style={{ width: `${percent ?? 8}%` }} />
            </div>
            <div className="plugin-banner__meta">
              <span>Node.js</span>
              <span>{node.total ? text.runtimeSize(megabytes(node.downloaded), megabytes(node.total)) : text.runtimeSizeUnknown(megabytes(node.downloaded))}</span>
            </div>
          </>
        }
      >
        {text.runtimeDownloadingBody}
      </PluginBanner>
    );
  }
  if (node?.state === "failed") {
    return (
      <PluginBanner
        name="runtime-failed"
        tone="bad"
        icon={<AlertCircle size={16} strokeWidth={2.2} />}
        title={text.runtimeFailed}
        actions={
          <button className="plugin-btn plugin-btn--primary" type="button" data-action="runtime-retry" onClick={onRetry}>
            <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.retry}
          </button>
        }
      >
        <span className="plugin-banner__error">{node.error}</span> {text.runtimeFailedBody}
      </PluginBanner>
    );
  }
  return null;
}

export function SafeBanner({ view, onFindCulprit }: { view: PluginHostView; onFindCulprit: () => void }) {
  const text = useTranslation().settings.pluginsV3.page.banners;
  const [leaving, setLeaving] = useState(false);
  const mode = view.host?.safe;
  if (!mode) return null;
  const safe = view.safeMode?.mode === mode ? view.safeMode : null;
  const variable = safe?.cause === "variable";
  const cause = safe?.cause === "failures" ? text.safeFailures(safe.failures) : safe?.cause === "shift" ? text.safeShift : variable ? text.safeVariable : null;
  const leave = () => {
    setLeaving(true);
    void exitPluginSafeMode().catch(() => setLeaving(false));
  };
  return (
    <PluginBanner
      name="safe-mode"
      tone="warn"
      icon={<ShieldAlert size={16} strokeWidth={2.2} />}
      title={text.safe}
      actions={
        variable ? (
          <button className="plugin-btn plugin-btn--ghost" type="button" onClick={openPluginDocs}>
            <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.howToRemove}
          </button>
        ) : (
          <>
            {safe ? <button className="plugin-btn" type="button" data-action="leave-safe-mode" disabled={leaving} onClick={leave}>{text.leaveSafe}</button> : null}
            <button className="plugin-btn plugin-btn--ghost" type="button" data-action="find-culprit" onClick={onFindCulprit}>{text.findCulprit}</button>
          </>
        )
      }
    >
      {cause}
      {mode === "minimal" ? ` ${text.safeMinimal}` : null}
    </PluginBanner>
  );
}

export function PluginPageBanners({ view, hostOff, node, onRetryNode, entries, onOpenDiagnostics, onOnlyAttention }: {
  view: PluginHostView;
  hostOff: boolean;
  node: HostNodeStatus | null;
  onRetryNode: () => void;
  entries: readonly InstalledEntry[];
  onOpenDiagnostics: () => void;
  onOnlyAttention: () => void;
}) {
  const text = useTranslation().settings.pluginsV3.page.banners;
  const { locale } = useLocale();
  const diagnostics = (
    <button className="plugin-btn" type="button" data-action="open-diagnostics" onClick={onOpenDiagnostics}>
      <Activity size={13} strokeWidth={2.2} aria-hidden="true" />
      {text.viewDiagnostics}
    </button>
  );
  if (hostOff) {
    return (
      <PluginBanner
        name="host-off"
        tone="warn"
        icon={<Power size={16} strokeWidth={2.2} />}
        title={text.hostOff}
        actions={
          <button className="plugin-btn plugin-btn--ghost" type="button" onClick={openPluginDocs}>
            <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.howToTurnOn}
          </button>
        }
      >
        {text.hostOffBody}
      </PluginBanner>
    );
  }
  const { connection } = view;
  const banners: ReactNode[] = [];
  if (connection === "reconnecting" || connection === "closed") {
    banners.push(
      <PluginBanner key="offline" name="offline" tone="bad" icon={<LoaderCircle className="plugin-spin" size={16} strokeWidth={2.2} />} title={text.offline} actions={diagnostics}>
        {text.offlineBody}
      </PluginBanner>,
    );
  } else if (connection === "failed") {
    banners.push(
      <PluginBanner key="mismatch" name="mismatch" tone="bad" icon={<Unplug size={16} strokeWidth={2.2} />} title={text.mismatch} actions={diagnostics}>
        {text.mismatchBody}
      </PluginBanner>,
    );
  }
  banners.push(<RuntimeBanner key="runtime" node={node} onRetry={onRetryNode} />);
  if (connection === "open") banners.push(<SafeBanner key="safe" view={view} onFindCulprit={onOpenDiagnostics} />);
  const live = connection === "open";
  const broken = live ? entries.filter((entry) => entry.status.dot === "bad") : [];
  const waiting = live ? entries.filter((entry) => entry.status.attention && entry.status.dot !== "bad") : [];
  const updates = entries.filter((entry) => entry.status.note?.kind === "update");
  if (broken.length > 0) {
    banners.push(
      <PluginBanner key="problems" name="problems" tone="bad" icon={<AlertCircle size={16} strokeWidth={2.2} />} title={text.problems(broken.length)} actions={diagnostics}>
        {text.problemsBody}
      </PluginBanner>,
    );
  } else if (waiting.length > 0) {
    banners.push(
      <PluginBanner
        key="attention"
        name="attention"
        tone="warn"
        icon={<ShieldAlert size={16} strokeWidth={2.2} />}
        title={text.attention(waiting.length)}
        actions={<button className="plugin-btn" type="button" data-action="only-attention" onClick={onOnlyAttention}>{text.onlyAttention}</button>}
      >
        {text.attentionBody}
      </PluginBanner>,
    );
  }
  if (updates.length > 0) {
    const names = updates.map((entry) => (entry.status.note?.kind === "update" ? `${entry.title} v${entry.status.note.version}` : entry.title)).join(locale === "en" ? ", " : "、");
    banners.push(
      <PluginBanner key="updates" name="updates" tone="info" icon={<Download size={16} strokeWidth={2.2} />} title={text.updates(updates.length)}>
        {text.updatesBody(names)}
      </PluginBanner>,
    );
  }
  return <>{banners}</>;
}
