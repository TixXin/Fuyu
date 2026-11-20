import { useEffect, useState, type ReactNode } from "react";
import { Activity, AlertCircle, CircleCheck, Download, ExternalLink, LoaderCircle, Power, RefreshCw, ShieldAlert, Unplug } from "lucide-react";
import type { MarketAutoUpdatedPlugin } from "@fuyu/plugin-services";
import { Markdown } from "../../components/markdown/Markdown";
import { useLocale, useTranslation } from "../../i18n";
import { exitPluginSafeMode, type HostNodeStatus } from "../../features/plugin-kernel/api";
import { changelogBetween } from "./marketAutoUpdated";
import type { InstalledEntry } from "./pluginEntries";
import { marketClient, openHttpUrl, openPluginDocs } from "./pluginMarketActions";
import { formatMarketTime, localized } from "./pluginMarketModel";
import type { PluginHostView } from "./usePluginHostStatus";
import { PluginRosterBanners } from "./PluginRosterBanners";
import { usePluginMarketCatalog } from "./usePluginMarketCatalog";

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
    const disk = node.cause === "disk";
    const body = disk ? text.runtimeDiskFailedBody : node.cause === "other" ? text.runtimeOtherFailedBody : text.runtimeFailedBody;
    return (
      <PluginBanner
        name="runtime-failed"
        tone="bad"
        icon={<AlertCircle size={16} strokeWidth={2.2} />}
        title={disk ? text.runtimeDiskFailed : text.runtimeFailed}
        actions={
          <button className="plugin-btn plugin-btn--primary" type="button" data-action="runtime-retry" onClick={onRetry}>
            <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
            {text.retry}
          </button>
        }
      >
        {body} <span className="plugin-banner__error">{node.error}</span>
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

function AutoUpdatedChanges({ item, title }: { item: MarketAutoUpdatedPlugin; title: string }) {
  const text = useTranslation().settings.pluginsV3.page.banners;
  const { locale } = useLocale();
  const [changes, setChanges] = useState<{ body: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void marketClient
      .details({ name: item.name, locale })
      .then((details) => (cancelled ? undefined : setChanges({ body: changelogBetween(details.changelog, item.from, item.to) })))
      .catch(() => (cancelled ? undefined : setChanges({ body: null })));
    return () => {
      cancelled = true;
    };
  }, [item.name, item.from, item.to, locale]);
  return (
    <div className="plugin-banner__update" data-auto-updated={item.name}>
      <div className="plugin-banner__update-head">
        <b>{title}</b>
        <span>{item.from} → {item.to}</span>
      </div>
      {changes === null ? (
        <p className="plugin-banner__update-note">{text.autoUpdatedLoading}</p>
      ) : changes.body ? (
        <Markdown className="plugin-banner__changes" text={changes.body} onOpenLink={openHttpUrl} />
      ) : (
        <p className="plugin-banner__update-note">{text.autoUpdatedNoChanges}</p>
      )}
    </div>
  );
}

export function AutoUpdatedBanner() {
  const text = useTranslation().settings.pluginsV3.page.banners;
  const { locale } = useLocale();
  const { snapshot } = usePluginMarketCatalog(true);
  const [open, setOpen] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const batch = snapshot?.autoUpdated ?? null;
  if (!batch || batch.plugins.length === 0 || (dismissedAt !== null && batch.at <= dismissedAt)) return null;
  const titleOf = (item: MarketAutoUpdatedPlugin) => localized(item.displayName ?? snapshot?.installed.find((plugin) => plugin.id === item.name)?.displayName, locale, item.name);
  const names = batch.plugins.map((item) => `${titleOf(item)} ${item.from} → ${item.to}`).join(locale === "en" ? ", " : "、");
  const dismiss = () => {
    setDismissedAt(batch.at);
    void marketClient.dismissAutoUpdated({ at: batch.at }).catch(() => setDismissedAt(null));
  };
  return (
    <PluginBanner
      name="auto-updated"
      tone="info"
      icon={<CircleCheck size={16} strokeWidth={2.2} />}
      title={text.autoUpdated(batch.plugins.length)}
      extra={open ? <div className="plugin-banner__updates">{batch.plugins.map((item) => <AutoUpdatedChanges key={item.name} item={item} title={titleOf(item)} />)}</div> : null}
      actions={
        <>
          <button className="plugin-btn" type="button" data-action="auto-updated-changes" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? text.autoUpdatedHide : text.autoUpdatedShow}
          </button>
          <button className="plugin-btn plugin-btn--ghost" type="button" data-action="auto-updated-dismiss" onClick={dismiss}>{text.autoUpdatedDismiss}</button>
        </>
      }
    >
      {text.autoUpdatedBody(names, formatMarketTime(batch.at, locale))}
    </PluginBanner>
  );
}

export function PluginPageBanners({ view, hostOff, node, onRetryNode, entries, onOpenDiagnostics, onOnlyAttention, onOpenMarket }: {
  view: PluginHostView;
  hostOff: boolean;
  node: HostNodeStatus | null;
  onRetryNode: () => void;
  entries: readonly InstalledEntry[];
  onOpenDiagnostics: () => void;
  onOnlyAttention: () => void;
  onOpenMarket?: (name: string) => void;
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
  if (live) banners.push(<AutoUpdatedBanner key="auto-updated" />);
  if (live) banners.push(<PluginRosterBanners key="roster" onOpenMarket={onOpenMarket} />);
  return <>{banners}</>;
}
