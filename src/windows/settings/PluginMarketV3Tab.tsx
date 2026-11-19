import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { marketV1, type MarketCatalogPlugin, type MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { PluginInstallConfirmModal, type PendingPluginInstall } from "./PluginInstallConfirmModal";
import { PluginMarketCard } from "./PluginMarketCard";
import { PluginMarketDetailModal } from "./PluginMarketDetailModal";
import "./PluginMarketV3Tab.css";

export interface OpenedPluginPackage {
  seq: number;
  fileName: string;
  base64: string;
}

type PendingAction =
  | { kind: "market"; name: string; version: string; modal: PendingPluginInstall }
  | { kind: "file"; base64: string; sha256: string; modal: PendingPluginInstall };

const marketClient = windowServices.get(marketV1);

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function matchesMarketQuery(plugin: MarketCatalogPlugin, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!q) return true;
  const haystack = [
    plugin.name,
    plugin.publisher.github,
    plugin.displayName["zh-CN"],
    plugin.displayName.en,
    plugin.description["zh-CN"],
    plugin.description.en,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return haystack.includes(q);
}

function useOpenedPluginPackage(
  connected: boolean,
  openedPackage: OpenedPluginPackage | null | undefined,
  onConsume: ((seq: number) => void) | undefined,
  openFileConfirm: (base64: string) => Promise<void>,
  onError: (message: string) => void,
) {
  const errorText = useErrorText();
  const handledSeqRef = useRef(0);
  useEffect(() => {
    if (!connected || !openedPackage || handledSeqRef.current === openedPackage.seq) return;
    let cancelled = false;
    let busy = false;
    const run = () => {
      if (cancelled || busy || handledSeqRef.current === openedPackage.seq) return;
      busy = true;
      void openFileConfirm(openedPackage.base64)
        .then(() => {
          if (cancelled) return;
          handledSeqRef.current = openedPackage.seq;
          onConsume?.(openedPackage.seq);
        })
        .catch((failure: unknown) => {
          busy = false;
          if (cancelled) return;
          const code = (failure as { code?: unknown } | null)?.code;
          if (code === "not-ready" || code === "no-provider") return;
          handledSeqRef.current = openedPackage.seq;
          onConsume?.(openedPackage.seq);
          onError(errorText(failure));
        });
    };
    run();
    const offWatch = windowServices.watch(run);
    return () => {
      cancelled = true;
      offWatch();
    };
  }, [connected, errorText, onConsume, onError, openFileConfirm, openedPackage]);
}

export function PluginMarketV3Tab({
  connected,
  query,
  openedPackage,
  openedError,
  onConsumeOpenedPackage,
}: {
  connected: boolean;
  query: string;
  openedPackage?: OpenedPluginPackage | null;
  openedError?: string | null;
  onConsumeOpenedPackage?: (seq: number) => void;
}) {
  const text = useTranslation().settings.pluginsV3;
  const copy = text.market;
  const { locale } = useLocale();
  const errorText = useErrorText();
  const manualSwitchId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [snapshot, setSnapshot] = useState<MarketCatalogSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingManual, setTogglingManual] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [detailName, setDetailName] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadCatalog = useCallback(() => {
    if (!connected) return;
    void marketClient
      .catalog()
      .then((next) => {
        setSnapshot(next);
        setBannerError(next.error);
      })
      .catch((failure: unknown) => setBannerError(errorText(failure)));
  }, [connected, errorText]);

  const openFileConfirm = useCallback(async (base64: string) => {
    const inspected = await marketClient.inspectPackage({ base64 });
    setBannerError(null);
    setModalError(null);
    setPending({
      kind: "file",
      base64,
      sha256: inspected.sha256,
      modal: { id: inspected.id, version: inspected.version, confirmation: inspected.confirmation },
    });
  }, []);

  useEffect(() => {
    if (!connected) return;
    loadCatalog();
    const offWatch = windowServices.watch(loadCatalog);
    const offChanged = marketClient.on("changed", loadCatalog);
    return () => {
      offWatch();
      void offChanged();
    };
  }, [connected, loadCatalog]);

  useOpenedPluginPackage(connected, openedPackage, onConsumeOpenedPackage, openFileConfirm, setBannerError);

  if (!connected) {
    return (
      <div className="plugins-v3__market">
        <p className="plugins-v3__empty">{copy.hostDisconnected}</p>
      </div>
    );
  }

  const refresh = () => {
    setRefreshing(true);
    setBannerError(null);
    void marketClient
      .refresh()
      .then((next) => {
        setSnapshot(next);
        setBannerError(next.error);
      })
      .catch((failure: unknown) => setBannerError(errorText(failure)))
      .finally(() => setRefreshing(false));
  };

  const toggleManual = (allowed: boolean) => {
    setTogglingManual(true);
    setBannerError(null);
    void marketClient
      .setManualAllowed({ allowed })
      .then((res) => setSnapshot((prev) => (prev ? { ...prev, manualAllowed: res.manualAllowed } : prev)))
      .catch((failure: unknown) => setBannerError(errorText(failure)))
      .finally(() => setTogglingManual(false));
  };

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBannerError(null);
    void file
      .arrayBuffer()
      .then((buf) => openFileConfirm(bytesToBase64(new Uint8Array(buf))))
      .catch((failure: unknown) => setBannerError(errorText(failure)));
  };

  const chooseMarketInstall = (plugin: MarketCatalogPlugin, version: string, isUpdate: boolean) => {
    const candidate =
      plugin.install?.version === version
        ? plugin.install
        : plugin.manual?.version === version
        ? plugin.manual
        : plugin.autoUpdate?.version === version
        ? plugin.autoUpdate
        : null;
    if (!candidate) return;
    setModalError(null);
    setPending({
      kind: "market",
      name: plugin.name,
      version: candidate.version,
      modal: {
        id: plugin.name,
        version: candidate.version,
        isUpdate,
        fresh: Boolean(candidate.fresh),
        confirmation: candidate.confirmation,
      },
    });
  };

  const plugins = snapshot?.plugins ?? [];
  const filtered = plugins.filter((item) => matchesMarketQuery(item, query));
  const detailPlugin = detailName ? (plugins.find((item) => item.name === detailName) ?? null) : null;
  const manualAllowed = snapshot?.manualAllowed === true;
  const shownBannerError = bannerError ?? openedError ?? null;

  const confirmInstall = () => {
    if (!pending) return;
    setInstalling(true);
    setModalError(null);
    const run = async () => {
      if (pending.kind === "market") {
        await marketClient.installMarket({ name: pending.name, version: pending.version });
        return;
      }
      if (!manualAllowed) {
        const res = await marketClient.setManualAllowed({ allowed: true });
        setSnapshot((prev) => (prev ? { ...prev, manualAllowed: res.manualAllowed } : prev));
      }
      await marketClient.installFile({ base64: pending.base64, expectedSha256: pending.sha256 });
    };
    void run()
      .then(() => {
        setPending(null);
        loadCatalog();
      })
      .catch((failure: unknown) => setModalError(errorText(failure)))
      .finally(() => setInstalling(false));
  };

  return (
    <div className="plugins-v3__market">
      <section className="plugins-v3__market-bar settings-group" aria-label={text.tabs.market}>
        <div className="plugins-v3__market-bar-row">
          <div className="plugins-v3__market-meta">
            <strong>{copy.count(plugins.length)}</strong>
            {snapshot?.updatedAt ? (
              <span>{copy.updatedAt(new Date(snapshot.updatedAt).toLocaleString(locale === "en" ? "en" : "zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }))}</span>
            ) : null}
            <button
              className="plugins-v3__btn"
              type="button"
              disabled={refreshing}
              data-action="market-refresh"
              onClick={refresh}
            >
              <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
              <span>{refreshing ? copy.refreshing : copy.refresh}</span>
            </button>
          </div>

        </div>
      </section>

      <details className="plugins-v3__manual">
        <summary>{copy.installFromFile}</summary>
        <div className="plugins-v3__manual-body">
          <div className="plugins-v3__manual-toggle">
            <label htmlFor={manualSwitchId}>{copy.manualAllow}</label>
            <SettingsSwitch
              id={manualSwitchId}
              checked={manualAllowed}
              disabled={togglingManual || snapshot === null}
              onChange={toggleManual}
            />
          </div>
          {manualAllowed ? (
            <>
              <input
                ref={fileInputRef}
                className="plugins-v3__file-input"
                type="file"
                accept=".fuyu"
                data-testid="market-file-input"
                onChange={onPickFile}
              />
              <button
                className="plugins-v3__btn plugins-v3__btn--primary"
                type="button"
                data-action="market-install-file"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>{copy.installFromFile}</span>
              </button>
            </>
          ) : null}
        </div>
      </details>

      {shownBannerError ? <p className="plugins-v3__error-banner">{shownBannerError}</p> : null}

      {snapshot === null ? (
        <p className="plugins-v3__empty">{copy.loading}</p>
      ) : plugins.length === 0 ? (
        <p className="plugins-v3__empty">{copy.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="plugins-v3__empty">{text.noMatches}</p>
      ) : (
        <div className="plugins-v3__grid">
          {filtered.map((plugin) => (
            <PluginMarketCard
              key={plugin.name}
              plugin={plugin}
              onOpenDetail={(picked) => setDetailName(picked.name)}
              onChooseMarketInstall={chooseMarketInstall}
            />
          ))}
        </div>
      )}

      {detailPlugin ? (
        <PluginMarketDetailModal
          plugin={detailPlugin}
          onClose={() => setDetailName(null)}
          onChooseInstall={chooseMarketInstall}
        />
      ) : null}

      {pending ? (
        <PluginInstallConfirmModal
          pending={pending.modal}
          busy={installing}
          error={modalError}
          onConfirm={confirmInstall}
          onCancel={() => {
            if (!installing) {
              setPending(null);
              setModalError(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
