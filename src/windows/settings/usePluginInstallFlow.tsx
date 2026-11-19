import { useState } from "react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useErrorText } from "../../i18n";
import { PluginInstallConfirmModal, type PendingPluginInstall } from "./PluginInstallConfirmModal";
import { marketClient } from "./pluginMarketActions";
import { marketActionCandidate } from "./pluginRowStatus";

export function usePluginInstallFlow(onInstalled?: () => void) {
  const errorText = useErrorText();
  const [pending, setPending] = useState<{ name: string; modal: PendingPluginInstall } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offer = (plugin: MarketCatalogPlugin) => {
    const action = marketActionCandidate(plugin);
    if (!action) return;
    const { candidate, isUpdate } = action;
    setError(null);
    setPending({
      name: plugin.name,
      modal: { id: plugin.name, version: candidate.version, isUpdate, fresh: Boolean(candidate.fresh), confirmation: candidate.confirmation },
    });
  };

  const confirm = () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    void marketClient
      .installMarket({ name: pending.name, version: pending.modal.version })
      .then(() => {
        setPending(null);
        onInstalled?.();
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const modal = pending ? (
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

  return { offer, modal };
}
