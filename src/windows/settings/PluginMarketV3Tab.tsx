import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Blocks, RefreshCw, Upload } from "lucide-react";
import { marketV1, type MarketCatalogPlugin, type MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { PluginInstallConfirmModal, resolvePluginText, type PendingPluginInstall } from "./PluginInstallConfirmModal";
import "./PluginMarketV3Tab.css";

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

function MarketPluginCard({
  plugin,
  onChooseMarketInstall,
}: {
  plugin: MarketCatalogPlugin;
  onChooseMarketInstall: (plugin: MarketCatalogPlugin, version: string, isUpdate: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = useTranslation().settings.pluginsV3.market;
  const title = resolvePluginText(plugin.displayName, locale, plugin.name);
  const desc = resolvePluginText(plugin.description, locale, "");
  const installCandidate = !plugin.installedVersion ? (plugin.install ?? plugin.manual) : null;
  const updateCandidate = plugin.installedVersion ? (plugin.manual ?? plugin.autoUpdate) : null;
  const activeCandidate = updateCandidate ?? installCandidate;
  const fresh = Boolean(activeCandidate?.fresh);

  return (
    <article className="plugins-v3__card" data-market-plugin={plugin.name}>
      <div className="plugins-v3__plugin-head">
        <span className="plugins-v3__icon plugins-v3__icon--info" aria-hidden="true">
          <Blocks size={16} strokeWidth={2} />
          <span className="plugins-v3__dot" />
        </span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            <span className="plugins-v3__plugin-name" title={title}>{title}</span>
            {plugin.official ? (
              <span className="plugins-v3__pill plugins-v3__pill--official">{copy.officialBadge}</span>
            ) : (
              <span className="plugins-v3__pill">{copy.reviewedBadge}</span>
            )}
            {fresh ? <span className="plugins-v3__pill plugins-v3__pill--warn">{copy.cooldownBadge}</span> : null}
            {plugin.revoked ? <span className="plugins-v3__pill plugins-v3__pill--bad">{copy.revokedBadge}</span> : null}
          </div>
          <span className="plugins-v3__id">{plugin.name}</span>
        </div>
      </div>

      {desc ? <p className="plugins-v3__note">{desc}</p> : null}
      {fresh ? <p className="plugins-v3__detail plugins-v3__detail--warn">{copy.cooldownHint}</p> : null}

      <div className="plugins-v3__card-foot">
        <span>
          {plugin.installedVersion
            ? copy.installedBadge(plugin.installedVersion)
            : activeCandidate
            ? `v${activeCandidate.version}`
            : "–"}
        </span>
        <span className="plugins-v3__foot-actions">
          {installCandidate ? (
            <button
              className="plugins-v3__btn plugins-v3__btn--primary"
              type="button"
              data-action="market-install"
              onClick={() => onChooseMarketInstall(plugin, installCandidate.version, false)}
            >
              {copy.installBtn}
            </button>
          ) : updateCandidate ? (
            <button
              className="plugins-v3__btn plugins-v3__btn--primary"
              type="button"
              data-action="market-update"
              onClick={() => onChooseMarketInstall(plugin, updateCandidate.version, true)}
            >
              {copy.updateBtn(updateCandidate.version)}
            </button>
          ) : plugin.installedVersion ? (
            <button className="plugins-v3__btn" type="button" disabled>
              {copy.installedBtn}
            </button>
          ) : (
            <button className="plugins-v3__btn" type="button" disabled>
              {copy.unavailableBtn}
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

export function PluginMarketV3Tab({
  connected,
  query,
}: {
  connected: boolean;
  query: string;
}) {
  const text = useTranslation().settings.pluginsV3;
  const copy = text.market;
  const errorText = useErrorText();
  const manualSwitchId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [snapshot, setSnapshot] = useState<MarketCatalogSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingManual, setTogglingManual] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
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
      .catch(() => undefined);
  }, [connected]);

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
      .then(async (buf) => {
        const base64 = bytesToBase64(new Uint8Array(buf));
        const inspected = await marketClient.inspectPackage({ base64 });
        setModalError(null);
        setPending({
          kind: "file",
          base64,
          sha256: inspected.sha256,
          modal: {
            id: inspected.id,
            version: inspected.version,
            confirmation: inspected.confirmation,
          },
        });
      })
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
        confirmation: candidate.confirmation,
      },
    });
  };

  const confirmInstall = () => {
    if (!pending) return;
    setInstalling(true);
    setModalError(null);
    const task =
      pending.kind === "market"
        ? marketClient.installMarket({ name: pending.name, version: pending.version })
        : marketClient.installFile({ base64: pending.base64, expectedSha256: pending.sha256 });
    void task
      .then(() => {
        setPending(null);
        loadCatalog();
      })
      .catch((failure: unknown) => setModalError(errorText(failure)))
      .finally(() => setInstalling(false));
  };

  const plugins = snapshot?.plugins ?? [];
  const filtered = plugins.filter((item) => matchesMarketQuery(item, query));
  const manualAllowed = snapshot?.manualAllowed === true;

  return (
    <div className="plugins-v3__market">
      <section className="plugins-v3__market-bar settings-group" aria-label={text.tabs.market}>
        <div className="plugins-v3__market-bar-row">
          <div className="plugins-v3__market-meta">
            <strong>{copy.count(plugins.length)}</strong>
            {snapshot?.updatedAt ? (
              <span>{copy.updatedAt(new Date(snapshot.updatedAt).toLocaleTimeString())}</span>
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

          <div className="plugins-v3__market-controls">
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
        </div>
      </section>

      {bannerError ? <p className="plugins-v3__error-banner">{bannerError}</p> : null}

      {snapshot === null ? (
        <p className="plugins-v3__empty">{copy.loading}</p>
      ) : plugins.length === 0 ? (
        <p className="plugins-v3__empty">{copy.empty}</p>
      ) : filtered.length === 0 ? (
        <p className="plugins-v3__empty">{text.noMatches}</p>
      ) : (
        <div className="plugins-v3__grid">
          {filtered.map((plugin) => (
            <MarketPluginCard
              key={plugin.name}
              plugin={plugin}
              onChooseMarketInstall={chooseMarketInstall}
            />
          ))}
        </div>
      )}

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
