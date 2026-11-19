import { useState } from "react";
import type { MarketCatalogPlugin, MarketInspectedPackage } from "@fuyu/plugin-services";
import { useErrorText, useLocale } from "../../i18n";
import { PluginInstallConfirmModal, type PendingPluginInstall } from "./PluginInstallConfirmModal";
import { marketClient } from "./pluginMarketActions";
import { isFirstFromPublisher, localized } from "./pluginMarketModel";
import { marketActionCandidate } from "./pluginRowStatus";

type PendingAction =
  | { kind: "market"; name: string; modal: PendingPluginInstall }
  | { kind: "file"; base64: string; modal: PendingPluginInstall };

export function usePluginInstallFlow(onInstalled?: () => void, catalog?: { plugins: readonly MarketCatalogPlugin[]; manualAllowed: boolean } | null) {
  const errorText = useErrorText();
  const { locale } = useLocale();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = (plugin: MarketCatalogPlugin) => {
    const action = marketActionCandidate(plugin);
    if (!action) return;
    const { candidate, isUpdate } = action;
    setError(null);
    setPending({
      kind: "market",
      name: plugin.name,
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
        setPending(null);
        onInstalled?.();
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const nameOf = (id: string) => {
    const found = catalog?.plugins.find((plugin) => plugin.name === id);
    return found ? localized(found.displayName, locale, id) : id;
  };

  const modal = pending ? (
    <PluginInstallConfirmModal
      pending={pending.modal}
      busy={busy}
      error={error}
      nameOf={nameOf}
      onConfirm={confirm}
      onCancel={() => {
        if (!busy) setPending(null);
      }}
    />
  ) : null;

  return { offer, offerFile, modal };
}
