import { useCallback, useState, useSyncExternalStore } from "react";
import type { MarketCatalogPlugin, MarketInspectedPackage } from "@fuyu/plugin-services";
import { useErrorText, useLocale } from "../../i18n";
import { openPluginSettingsWindow } from "./api";
import { PluginInstallConfirmModal, type PendingPluginInstall } from "./PluginInstallConfirmModal";
import { PluginInstalledToast, type InstalledNotice } from "./PluginInstalledToast";
import { marketClient } from "./pluginMarketActions";
import { isFirstFromPublisher, localized } from "./pluginMarketModel";
import { marketActionCandidate } from "./pluginRowStatus";
import { latestPluginStatuses, pluginSetupNeed, subscribePluginStatuses } from "./pluginSetupStore";
import type { PluginStatusV3 } from "./usePluginHostStatus";

type PendingAction =
  | { kind: "market"; name: string; title: string; modal: PendingPluginInstall }
  | { kind: "file"; base64: string; title: string; modal: PendingPluginInstall };

export interface PluginInstallFlowOptions {
  plugins?: readonly PluginStatusV3[] | null;
  onOpenSettings?: (id: string) => void;
}

function openSettingsOf(id: string) {
  void openPluginSettingsWindow(id).catch((error: unknown) => console.error(`Failed to open the settings of ${id}`, error));
}

export function usePluginInstallFlow(onInstalled?: () => void, catalog?: { plugins: readonly MarketCatalogPlugin[]; manualAllowed: boolean } | null, options: PluginInstallFlowOptions = {}) {
  const errorText = useErrorText();
  const { locale } = useLocale();
  const seen = useSyncExternalStore(subscribePluginStatuses, latestPluginStatuses);
  const statuses = options.plugins === undefined ? seen : options.plugins;
  const [notice, setNotice] = useState<InstalledNotice | null>(null);
  const dismiss = useCallback(() => setNotice(null), []);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = (plugin: MarketCatalogPlugin) => {
    const action = marketActionCandidate(plugin);
    if (!action) return;
    const { candidate, isUpdate } = action;
    setError(null);
    setNotice(null);
    setPending({
      kind: "market",
      name: plugin.name,
      title: localized(candidate.confirmation.displayName, locale, "") || localized(plugin.displayName, locale, plugin.name),
      modal: {
        id: plugin.name,
        version: candidate.version,
        kind: isUpdate ? "update" : "install",
        fresh: Boolean(candidate.fresh),
        publisher: plugin.publisher.github,
        firstFromPublisher: catalog ? isFirstFromPublisher(plugin, catalog.plugins) : false,
        confirmation: { ...candidate.confirmation, displayName: candidate.confirmation.displayName || plugin.displayName, description: candidate.confirmation.description || plugin.description },
      },
    });
  };

  const offerFile = (inspected: MarketInspectedPackage, base64: string, fileName?: string) => {
    setError(null);
    setPending({
      kind: "file",
      base64,
      title: localized(inspected.confirmation.displayName, locale, inspected.id),
      modal: { id: inspected.id, version: inspected.version, kind: "file", confirmation: inspected.confirmation, fileName, sha256: inspected.sha256, manualAllowed: catalog?.manualAllowed ?? false },
    });
  };

  const run = async (action: PendingAction) => {
    if (action.kind === "market") {
      await marketClient.installMarket({ name: action.name, version: action.modal.version });
      return;
    }
    if (!catalog?.manualAllowed) await marketClient.setManualAllowed({ allowed: true });
    await marketClient.installFile({ base64: action.base64, expectedSha256: action.modal.sha256 });
  };

  const confirm = () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    void run(pending)
      .then(() => {
        const { id, version, kind } = pending.modal;
        setNotice({ id, version, updated: kind === "update", name: pending.title });
        setPending(null);
        onInstalled?.();
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const setup = notice ? pluginSetupNeed(statuses?.find((plugin) => plugin.id === notice.id), true, locale) : null;
  const toast = notice ? (
    <PluginInstalledToast
      notice={notice}
      setup={setup}
      onDismiss={dismiss}
      onOpenSettings={() => {
        setNotice(null);
        (options.onOpenSettings ?? openSettingsOf)(notice.id);
      }}
    />
  ) : null;

  const confirmModal = pending ? (
    <PluginInstallConfirmModal
      pending={pending.modal}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={() => {
        if (!busy) setPending(null);
      }}
    />
  ) : null;

  const modal = confirmModal || toast ? <>{confirmModal}{toast}</> : null;

  return { offer, offerFile, modal };
}
