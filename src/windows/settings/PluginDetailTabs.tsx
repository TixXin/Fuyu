import { useEffect, useState } from "react";
import { Copy, RotateCcw } from "lucide-react";
import { commandsV1, type CommandItem, type MarketPluginDetails } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { windowServices } from "../../features/plugin-kernel/services";
import type { InstalledEntry } from "./pluginEntries";
import { milliseconds } from "./pluginDisplay";
import { marketClient } from "./pluginMarketActions";
import { PluginCapabilities } from "./PluginCapabilities";
import { PluginCommandRow, type RunBlock } from "./PluginCommandRow";
import { PluginSchemaForm } from "./PluginSchemaForm";
import { PluginSettingsSections } from "./PluginSettingsSections";
import { stateOf } from "./pluginServiceStatus";
import { PluginWindowRulesGroup } from "./PluginWindowRulesGroup";

const commandsClient = windowServices.get(commandsV1);

export function PluginSettingsTab({ entry }: { entry: InstalledEntry }) {
  const text = useTranslation().settings.pluginsV3.page.detail;
  const running = stateOf(entry.plugin) === "running";
  return (
    <div className="plugin-detail__settings">
      <PluginSettingsSections pluginId={entry.id} />
      <PluginSchemaForm pluginId={entry.id} />
      {running ? <p className="plugin-callout plugin-detail__no-settings">{text.noSettings}</p> : <p className="plugin-callout" data-settings-off>{text.settingsOff}</p>}
    </div>
  );
}

function runBlock(entry: InstalledEntry, stale: boolean): RunBlock | null {
  if (stale) return "offline";
  if (!entry.enabled) return "off";
  return stateOf(entry.plugin) === "running" ? null : "notRunning";
}

export function PluginCommandsTab({ entry, stale, onOpenShortcuts }: { entry: InstalledEntry; stale: boolean; onOpenShortcuts?: () => void }) {
  const text = useTranslation().settings.pluginsV3.page.detail;
  const [items, setItems] = useState<CommandItem[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => void commandsClient.list().then((res) => live && setItems(res.items)).catch(() => undefined);
    load();
    const offWatch = windowServices.watch(load);
    const offChanged = commandsClient.on("changed", (next) => live && setItems(next.items));
    return () => {
      live = false;
      offWatch();
      void offChanged();
    };
  }, []);
  const mine = (items ?? []).filter((item) => item.pluginId === entry.id);
  if (mine.length === 0) return <p className="plugin-callout">{text.commandsEmpty}</p>;
  const block = runBlock(entry, stale);
  return (
    <>
      {block ? <p className="plugin-callout" data-run-blocked={block}>{text.runBlocked[block]}</p> : null}
      <div className="plugin-card plugin-detail__rows">
        {mine.map((item) => <PluginCommandRow key={item.id} item={item} block={block} onOpenShortcuts={onOpenShortcuts} />)}
      </div>
      {onOpenShortcuts ? (
        <p className="plugin-foot">
          {text.shortcutsBefore}
          <button className="plugin-link" type="button" onClick={onOpenShortcuts}>{text.shortcutsLink}</button>
          {text.shortcutsAfter}
        </p>
      ) : null}
    </>
  );
}

export function PluginOverviewExtras({ entry }: { entry: InstalledEntry }) {
  const { locale } = useLocale();
  const [details, setDetails] = useState<MarketPluginDetails | null>(null);
  useEffect(() => {
    if (!entry.market) return;
    let live = true;
    void marketClient
      .details({ name: entry.id, locale })
      .then((res) => live && setDetails(res))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [entry.id, entry.market, locale]);
  return (
    <>
      {details ? <PluginCapabilities caps={details} /> : null}
      <PluginWindowRulesGroup plugin={entry.plugin} />
    </>
  );
}

export function PluginActivityTab({ entry, onRestart, restartDisabled }: { entry: InstalledEntry; onRestart: () => void; restartDisabled: boolean }) {
  const t = useTranslation().settings.pluginsV3;
  const text = t.page.detail;
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);
  const usage = entry.plugin.usage;
  const lastError = entry.plugin.lastError;
  const errorText = lastError?.text ?? entry.plugin.error ?? null;
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copy = () => {
    if (!errorText) return;
    void navigator.clipboard?.writeText(errorText).then(() => setCopied(true)).catch(() => undefined);
  };
  return (
    <>
      {usage ? (
        <div className="plugin-metrics">
          <div className="plugin-metric"><span>{t.cpu}</span><b title={t.calls(usage.calls)}>{milliseconds(usage.cpuMs)}</b></div>
          <div className="plugin-metric"><span>{t.apply}</span><b>{usage.applyMs === null ? "–" : milliseconds(usage.applyMs)}</b></div>
          <div className="plugin-metric"><span>{`${t.timers} · ${t.listeners}`}</span><b>{`${usage.timers} · ${usage.listeners}`}</b></div>
          <div className="plugin-metric"><span>{`${t.services} · ${t.clients}`}</span><b>{`${usage.services} · ${usage.clients}`}</b></div>
          <div className={`plugin-metric${usage.errors > 0 ? " plugin-metric--bad" : ""}`}><span>{t.errors}</span><b>{usage.errors}</b></div>
        </div>
      ) : null}
      <h3 className="plugin-page__heading">
        {text.lastError}
        {lastError ? <span className="plugin-page__heading-meta">{new Date(lastError.at).toLocaleTimeString(locale === "en" ? "en" : "zh-CN")}</span> : null}
      </h3>
      {errorText ? (
        <>
          <pre className="plugin-log" data-last-error>{errorText}</pre>
          <div className="plugin-detail__buttons">
            <button className="plugin-btn plugin-btn--sm" type="button" data-action="copy-error" onClick={copy}>
              <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
              {copied ? text.copied : text.copy}
            </button>
            <button className="plugin-btn plugin-btn--sm" type="button" data-action="restart-plugin" disabled={restartDisabled} onClick={onRestart}>
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden="true" />
              {text.restartPlugin}
            </button>
          </div>
        </>
      ) : (
        <p className="plugin-callout">{text.noErrors}</p>
      )}
      <p className="plugin-foot">{text.activityNote}</p>
    </>
  );
}
