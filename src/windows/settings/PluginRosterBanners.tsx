import { useState } from "react";
import { LoaderCircle, MonitorSmartphone, SlidersHorizontal } from "lucide-react";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { dismissRosterItems, keepLocalConfig, type RosterItem } from "../../lib/plugin-roster/roster";
import { loadRoster, loadRosterLocal, saveRoster, saveRosterLocal } from "../../lib/plugin-roster/storage";
import { PluginBanner } from "./PluginPageBanners";
import { marketClient } from "./pluginMarketActions";
import { localized } from "./pluginMarketModel";
import { applyRosterConfig, installRosterItem, planMissing, type RosterClients } from "./pluginRosterModel";
import { rosterConfigClient, usePluginRoster } from "./usePluginRoster";
import { usePluginMarketCatalog } from "./usePluginMarketCatalog";

const clients: RosterClients = {
  getConfig: (id) => rosterConfigClient.get({ id }),
  setConfig: (id, values) => rosterConfigClient.set({ id, values: values as Parameters<typeof rosterConfigClient.set>[0]["values"] }),
  install: (name) => marketClient.installMarket({ name }),
  setEnabled: (id, enabled) => marketClient.setEnabled({ id, enabled }),
};

type Busy = { kind: "install" | "settings"; done: number; total: number };

export function PluginRosterBanners({ onOpenMarket }: { onOpenMarket?: (name: string) => void }) {
  const text = useTranslation().settings.pluginsV3.page.banners.roster;
  const { locale } = useLocale();
  const errorText = useErrorText();
  const catalog = usePluginMarketCatalog(true);
  const { snapshot } = catalog;
  const { gaps, installed, reload } = usePluginRoster(snapshot);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (!snapshot) return null;

  const titleOf = (id: string) => localized(snapshot.plugins.find((plugin) => plugin.name === id)?.displayName ?? snapshot.installed.find((plugin) => plugin.id === id)?.displayName, locale, id);
  const names = (items: readonly RosterItem[]) => items.map((item) => titleOf(item.id)).join(locale === "en" ? ", " : "、");
  const plan = planMissing(gaps.missing, snapshot.plugins, snapshot.updatedAt !== null);
  const tooLarge = gaps.missing.filter((item) => item.configOmitted === "tooLarge");
  const spinner = <LoaderCircle className="plugin-spin" size={13} strokeWidth={2.2} aria-hidden="true" />;

  const installAll = async () => {
    setFailure(null);
    setBusy({ kind: "install", done: 0, total: plan.install.length });
    const failed: string[] = [];
    try {
      const fresh = snapshot.updatedAt === null ? await marketClient.refresh() : snapshot;
      const ready = planMissing(gaps.missing, fresh.plugins, true).install;
      for (const [index, item] of ready.entries()) {
        setBusy({ kind: "install", done: index, total: ready.length });
        await installRosterItem(clients, item).catch((error: unknown) => failed.push(`${titleOf(item.id)}: ${errorText(error)}`));
      }
    } catch (error) {
      failed.push(errorText(error));
    }
    catalog.reload();
    setFailure(failed.length > 0 ? failed.join(locale === "en" ? "; " : "；") : null);
    setBusy(null);
  };

  const dismissMissing = () => saveRosterLocal(dismissRosterItems(loadRosterLocal(), [...gaps.missing, ...gaps.manual].map((item) => item.id)));

  const keepMine = (ids: readonly string[], plugins = installed) => saveRoster(keepLocalConfig(loadRoster(), plugins, ids));

  const takeTheirs = async () => {
    setFailure(null);
    const failed: string[] = [];
    const ids = gaps.differing.map((item) => item.id);
    for (const [index, item] of gaps.differing.entries()) {
      setBusy({ kind: "settings", done: index, total: ids.length });
      const running = installed.find((plugin) => plugin.id === item.id)?.enabled === true;
      await applyRosterConfig(clients, item, running).catch((error: unknown) => failed.push(`${titleOf(item.id)}: ${errorText(error)}`));
    }
    const now = await Promise.all(installed.map(async (plugin) => (ids.includes(plugin.id) ? { ...plugin, config: (await clients.getConfig(plugin.id).catch(() => null))?.values ?? plugin.config } : plugin)));
    keepMine(ids, now);
    reload();
    catalog.reload();
    setFailure(failed.length > 0 ? failed.join(locale === "en" ? "; " : "；") : null);
    setBusy(null);
  };

  const missingCount = gaps.missing.length + gaps.manual.length;
  return (
    <>
      {missingCount > 0 ? (
        <PluginBanner
          name="roster-missing"
          tone="info"
          icon={<MonitorSmartphone size={16} strokeWidth={2.2} />}
          title={text.missing(missingCount)}
          actions={
            <>
              {plan.install.length > 0 ? (
                <button className="plugin-btn plugin-btn--primary" type="button" data-action="roster-install" disabled={busy !== null} onClick={() => void installAll()}>
                  {busy?.kind === "install" ? <>{spinner}{text.installing(busy.done + 1, busy.total)}</> : text.installAll(plan.install.length)}
                </button>
              ) : null}
              {plan.review.length > 0 && onOpenMarket ? (
                <button className="plugin-btn" type="button" data-action="roster-review" disabled={busy !== null} onClick={() => onOpenMarket(plan.review[0].id)}>{text.openMarket}</button>
              ) : null}
              <button className="plugin-btn plugin-btn--ghost" type="button" data-action="roster-dismiss" disabled={busy !== null} onClick={dismissMissing}>{text.dismiss}</button>
            </>
          }
        >
          {plan.install.length > 0 ? <span data-roster="install">{text.installBody(names(plan.install))} </span> : null}
          {plan.review.length > 0 ? <span data-roster="review">{text.review(names(plan.review))} </span> : null}
          {plan.unavailable.length > 0 ? <span data-roster="unavailable">{text.unavailable(names(plan.unavailable))} </span> : null}
          {gaps.manual.length > 0 ? <span data-roster="manual">{text.manual(names(gaps.manual))} </span> : null}
          {tooLarge.length > 0 ? <span data-roster="too-large">{text.tooLarge(names(tooLarge))} </span> : null}
          {failure && busy === null ? <span className="plugin-banner__error" role="alert">{text.failed(failure)}</span> : null}
        </PluginBanner>
      ) : null}
      {gaps.differing.length > 0 ? (
        <PluginBanner
          name="roster-settings"
          tone="info"
          icon={<SlidersHorizontal size={16} strokeWidth={2.2} />}
          title={text.settings(gaps.differing.length)}
          actions={
            <>
              <button className="plugin-btn plugin-btn--primary" type="button" data-action="roster-use-theirs" disabled={busy !== null} onClick={() => void takeTheirs()}>
                {busy?.kind === "settings" ? <>{spinner}{text.applying}</> : text.useTheirs}
              </button>
              <button className="plugin-btn plugin-btn--ghost" type="button" data-action="roster-keep-mine" disabled={busy !== null} onClick={() => keepMine(gaps.differing.map((item) => item.id))}>{text.keepMine}</button>
            </>
          }
        >
          {text.settingsBody(names(gaps.differing))}
          {failure && busy === null && missingCount === 0 ? <span className="plugin-banner__error" role="alert"> {text.failed(failure)}</span> : null}
        </PluginBanner>
      ) : null}
    </>
  );
}
