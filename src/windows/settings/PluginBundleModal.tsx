import { useState } from "react";
import { Check, Info, Layers, LoaderCircle, ShieldCheck, X } from "lucide-react";
import type { MarketBundleInstallResult, MarketBundleMember, MarketCatalogBundle, MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { OfficialMark } from "./OfficialMark";
import { bundleSummary, outsidePublishers, withInstalled } from "./pluginBundles";
import { iconSources } from "./pluginIconSources";
import { PluginLogo } from "./PluginLogo";
import { marketClient } from "./pluginMarketActions";
import { PluginMarketDialog } from "./PluginMarketDialog";
import { localized } from "./pluginMarketModel";
import "./PluginPage.css";
import "./PluginMarketBundles.css";

type Failure = MarketBundleInstallResult["failed"][number];

export function PluginBundleModal({ bundle: listed, plugins, onClose, onInstalled }: {
  bundle: MarketCatalogBundle;
  plugins: readonly MarketCatalogPlugin[];
  onClose: () => void;
  onInstalled?: () => void;
}) {
  const { locale } = useLocale();
  const page = useTranslation().settings.pluginsV3.marketPage;
  const text = page.bundles;
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [error, setError] = useState<string | null>(null);

  const bundle = withInstalled(listed, done);
  const summary = bundleSummary(bundle);
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  const name = localized(bundle.displayName, locale, bundle.id);
  const description = localized(bundle.description, locale, "");
  const title = summary.action === "done" ? name : text.title(name);
  const outside = outsidePublishers(bundle, plugins);
  const fresh = bundle.members.some((member) => member.state === "available" && byName.get(member.name)?.install?.fresh);
  const failureOf = (member: MarketBundleMember) => (member.state === "available" ? failures.find((item) => item.name === member.name) : undefined);
  const stateText = (member: MarketBundleMember) => {
    if (member.state === "available") return text.willInstall;
    if (member.state === "installed") return page.card.installed;
    if (member.state === "disabled") return text.disabled;
    if (member.reason === "platform") return page.card.platform;
    if (member.reason === "engines") return page.card.needsNewerFuyu;
    if (member.reason === "revoked") return page.card.revoked;
    if (member.reason === "warned") return text.warned;
    return page.card.unavailable;
  };

  const install = () => {
    setBusy(true);
    setError(null);
    void marketClient
      .installBundle({ id: bundle.id })
      .then((result) => {
        setDone((current) => [...current, ...result.installed.map((item) => item.name)]);
        setFailures(result.failed);
        if (result.installed.length > 0) onInstalled?.();
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  return (
    <PluginMarketDialog label={title} size="small" busy={busy} onClose={onClose} data={{ "data-bundle-modal": bundle.id, "data-bundle-action": summary.action }}>
      <div className="plugin-dialog__head">
        <span className="plugin-icon plugin-icon--lg" aria-hidden="true"><Layers size={22} strokeWidth={1.8} /></span>
        <div className="plugin-dialog__heading">
          <span className="plugin-dialog__title market-dialog__title">{title}</span>
          <span className="plugin-dialog__sub">{summary.owned > 0 ? text.owned(summary.owned, summary.total) : text.count(summary.total)}</span>
        </div>
        <div className="plugin-dialog__head-actions">
          <button className="plugin-icon-btn" type="button" disabled={busy} aria-label={page.detail.close} title={page.detail.close} onClick={onClose}>
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="plugin-dialog__body">
        {description ? <p className="plugin-dialog__desc">{description}</p> : null}
        <ul className="plugin-card market-bundle__members">
          {bundle.members.map((member) => {
            const plugin = byName.get(member.name);
            const memberName = plugin ? localized(plugin.displayName, locale, member.name) : member.name;
            const failure = failureOf(member);
            const sub = plugin ? [plugin.official ? null : plugin.publisher.github, localized(plugin.description, locale, "")].filter(Boolean).join(" · ") : member.name;
            return (
              <li key={member.name} className="market-bundle__member" data-bundle-member={member.name} data-state={failure ? "failed" : member.state}>
                <PluginLogo sources={iconSources(plugin?.icon)} title={memberName} size="sm" dim={member.state === "unavailable"} />
                <div className="market-bundle__member-text">
                  <span className="market-bundle__member-name"><span title={memberName}>{memberName}</span>{plugin?.official ? <OfficialMark /> : null}</span>
                  {sub ? <span className="market-bundle__member-sub" title={sub}>{sub}</span> : null}
                </div>
                <span className={`market-bundle__state market-bundle__state--${failure ? "failed" : member.state}`}>{failure ? text.failed : stateText(member)}</span>
                {failure ? <p className="market-bundle__member-error" role="alert">{errorText(failure)}</p> : null}
              </li>
            );
          })}
        </ul>
        {done.length > 0 ? (
          <p className="plugin-callout plugin-callout--info" role="status" data-callout="installed">
            <Check size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{text.installedResult(done.length)}</span>
          </p>
        ) : null}
        {outside.length > 0 ? (
          <p className="plugin-callout plugin-callout--info" data-callout="outside">
            <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{text.outside(outside.join(locale === "en" ? ", " : "、"))}</span>
          </p>
        ) : null}
        {fresh ? (
          <p className="plugin-callout" data-callout="fresh">
            <Info size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{text.fresh}</span>
          </p>
        ) : null}
        <p className="plugin-foot" data-bundle-note>{summary.available > 0 ? `${page.confirm.securityNote}${locale === "en" ? " " : ""}${text.note}` : text.note}</p>
        {error ? <p className="plugin-callout plugin-callout--bad" role="alert">{error}</p> : null}
      </div>
      <div className="plugin-dialog__foot">
        <span className="plugin-dialog__grow" />
        <button className="plugin-btn" type="button" disabled={busy} data-autofocus data-action="close-bundle" onClick={onClose}>
          {summary.available > 0 ? page.confirm.cancel : text.close}
        </button>
        {summary.available > 0 ? (
          <button className="plugin-btn plugin-btn--primary" type="button" disabled={busy} data-action="confirm-bundle" onClick={install}>
            {busy ? <LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" /> : null}
            {busy ? page.confirm.installing : failures.length > 0 ? text.retry : text.confirm(summary.available)}
          </button>
        ) : null}
      </div>
    </PluginMarketDialog>
  );
}
