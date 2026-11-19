import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Blocks, ExternalLink, Heart, X } from "lucide-react";
import { marketV1, type MarketCatalogPlugin, type MarketPluginDetails } from "@fuyu/plugin-services";
import { Markdown } from "../../components/markdown/Markdown";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { resolvePluginText } from "./PluginInstallConfirmModal";
import { marketActionCandidate } from "./PluginMarketCard";

type DetailTab = "readme" | "changelog" | "capabilities";

const DETAIL_TABS: readonly DetailTab[] = ["readme", "changelog", "capabilities"];
const FOCUSABLE = "button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
const marketClient = windowServices.get(marketV1);

function resolveRecordText(record: Record<string, string> | undefined, locale: string, fallback: string): string {
  if (!record) return fallback;
  return record[locale] || record["zh-CN"] || record.en || fallback;
}

function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

function openExternalHttpUrl(url: string) {
  if (isHttpUrl(url)) {
    void openUrl(url.trim()).catch(() => undefined);
  }
}

function formatPackageBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function CapItem({ label, items, emptyText }: { label: string; items: readonly string[]; emptyText: string }) {
  return (
    <div className="plugins-v3__cap-row">
      <dt>{label}</dt>
      <dd>{items.length > 0 ? items.join(", ") : <span className="plugins-v3__cap-empty">{emptyText}</span>}</dd>
    </div>
  );
}

function DetailBody({
  tab,
  details,
  fallbackDesc,
  locale,
}: {
  tab: DetailTab;
  details: MarketPluginDetails;
  fallbackDesc: string;
  locale: string;
}) {
  const marketCopy = useTranslation().settings.pluginsV3.market;
  const detailCopy = marketCopy.detailModal;
  const confirmCopy = marketCopy.confirmModal;

  if (tab === "readme") {
    const content = details.readme?.trim() || fallbackDesc;
    return content ? (
      <Markdown className="plugins-v3__markdown" text={content} onOpenLink={openExternalHttpUrl} />
    ) : (
      <p className="plugins-v3__cap-empty">{detailCopy.noReadme}</p>
    );
  }

  if (tab === "changelog") {
    const changelog = details.changelog?.trim() || "";
    return (
      <div className="plugins-v3__changelog-pane">
        {changelog ? (
          <Markdown className="plugins-v3__markdown" text={changelog} onOpenLink={openExternalHttpUrl} />
        ) : (
          <p className="plugins-v3__cap-empty">{detailCopy.noChangelog}</p>
        )}
        <div className="plugins-v3__versions">
          <h4 className="plugins-v3__subheading">{detailCopy.versionsHeading}</h4>
          {details.versions.length === 0 ? (
            <p className="plugins-v3__cap-empty">{detailCopy.noVersions}</p>
          ) : (
            <ul className="plugins-v3__version-list">
              {details.versions.map((ver) => {
                const meta = [
                  ver.publishedAt ? ver.publishedAt.slice(0, 10) : null,
                  typeof ver.size === "number" ? formatPackageBytes(ver.size) : null,
                  ver.enginesFuyu ? `Fuyu ${ver.enginesFuyu}` : null,
                ].filter(Boolean);
                return (
                  <li key={ver.version} className="plugins-v3__version-item" data-market-version={ver.version}>
                    <div className="plugins-v3__title-line">
                      <strong>{`v${ver.version}`}</strong>
                      {ver.reviewed ? (
                        <span className="plugins-v3__pill plugins-v3__pill--mint">{marketCopy.reviewedBadge}</span>
                      ) : null}
                      {ver.urgent ? (
                        <span className="plugins-v3__pill plugins-v3__pill--warn">{detailCopy.urgentBadge}</span>
                      ) : null}
                    </div>
                    {meta.length > 0 ? <span className="plugins-v3__version-meta">{meta.join(" · ")}</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const requiredList = Object.entries(details.requires).map(([pkg, range]) => (range ? `${pkg} (${range})` : pkg));
  return (
    <dl className="plugins-v3__caps">
      <CapItem label={confirmCopy.slotsLabel} items={details.slots} emptyText={confirmCopy.capabilityNone} />
      <CapItem label={confirmCopy.providesLabel} items={details.provides} emptyText={confirmCopy.capabilityNone} />
      <CapItem label={confirmCopy.replacesLabel} items={details.replaces} emptyText={confirmCopy.capabilityNone} />
      <div className="plugins-v3__cap-row">
        <dt>{detailCopy.commandsLabel}</dt>
        <dd>
          {details.commands.length === 0 ? (
            <span className="plugins-v3__cap-empty">{confirmCopy.capabilityNone}</span>
          ) : (
            <ul className="plugins-v3__cmd-list">
              {details.commands.map((cmd) => (
                <li key={cmd.id} className="plugins-v3__cmd-item">
                  <span>{resolveRecordText(cmd.title, locale, cmd.id)}</span>
                  <span className="plugins-v3__id">{cmd.id}</span>
                  {cmd.keybinding ? <kbd className="plugins-v3__kbd">{cmd.keybinding}</kbd> : null}
                </li>
              ))}
            </ul>
          )}
        </dd>
      </div>
      <CapItem label={confirmCopy.networkLabel} items={details.network} emptyText={confirmCopy.networkNone} />
      <CapItem label={confirmCopy.nodeApisLabel} items={details.nodeApis} emptyText={confirmCopy.nodeApisNone} />
      <CapItem label={detailCopy.requiresLabel} items={requiredList} emptyText={confirmCopy.capabilityNone} />
    </dl>
  );
}

export function PluginMarketDetailModal({
  plugin,
  onClose,
  onChooseInstall,
}: {
  plugin: MarketCatalogPlugin;
  onClose: () => void;
  onChooseInstall: (plugin: MarketCatalogPlugin, version: string, isUpdate: boolean) => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3;
  const copy = text.market;
  const detailCopy = copy.detailModal;
  const errorText = useErrorText();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [details, setDetails] = useState<MarketPluginDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("readme");

  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => before?.focus();
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    void marketClient
      .details({ name: plugin.name, locale })
      .then((res) => {
        if (!live) return;
        setDetails(res);
      })
      .catch((failure: unknown) => {
        if (!live) return;
        setError(errorText(failure));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [errorText, locale, plugin.name]);

  const fallbackTitle = resolvePluginText(plugin.displayName, locale, plugin.name);
  const displayName = resolveRecordText(details?.displayName, locale, fallbackTitle);
  const fallbackDesc = resolveRecordText(
    details?.description,
    locale,
    resolvePluginText(plugin.description, locale, ""),
  );
  const official = details?.official ?? plugin.official;
  const publisher = details?.publisherName || details?.author || plugin.publisher.github;
  const installedVersion = details?.installedVersion ?? plugin.installedVersion;
  const action = marketActionCandidate(plugin);
  const installCandidate = action && !action.isUpdate ? action.candidate : null;
  const updateCandidate = action?.isUpdate ? action.candidate : null;
  const latestVersion = details?.latestVersion ?? updateCandidate?.version ?? installCandidate?.version ?? null;

  const links: { key: keyof typeof detailCopy.links; url: string }[] = [];
  if (isHttpUrl(details?.repository)) links.push({ key: "repository", url: details.repository });
  if (isHttpUrl(details?.homepage)) links.push({ key: "homepage", url: details.homepage });
  if (isHttpUrl(details?.bugs)) links.push({ key: "bugs", url: details.bugs });
  if (isHttpUrl(details?.funding)) links.push({ key: "funding", url: details.funding });

  const screenshots = (details?.screenshots ?? []).filter((item) => isHttpUrl(item.url));

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (el) => el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="plugins-v3__modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="plugins-v3__modal plugins-v3__market-modal"
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
        data-market-detail-modal={plugin.name}
        onKeyDown={onKeyDown}
      >
        <div className="plugins-v3__modal-head">
          <span className="plugins-v3__icon plugins-v3__icon--lg plugins-v3__icon--info" aria-hidden="true">
            <Blocks size={18} strokeWidth={2} />
            <span className="plugins-v3__dot" />
          </span>
          <div className="plugins-v3__title-col">
            <div className="plugins-v3__title-line">
              <strong className="plugins-v3__modal-title">{displayName}</strong>
              {official ? (
                <span className="plugins-v3__pill plugins-v3__pill--official">{copy.officialBadge}</span>
              ) : (
                <span className="plugins-v3__pill">{copy.reviewedBadge}</span>
              )}
              {latestVersion ? <span className="plugins-v3__pill">{`v${latestVersion}`}</span> : null}
              {installedVersion ? (
                <span className="plugins-v3__pill plugins-v3__pill--mint">{copy.installedBadge(installedVersion)}</span>
              ) : null}
              {details?.preview ? (
                <span className="plugins-v3__pill plugins-v3__pill--warn">{detailCopy.previewBadge}</span>
              ) : null}
              {details && details.likes !== null ? (
                <span className="plugins-v3__pill plugins-v3__likes-pill" data-market-likes={details.likes}>
                  <Heart size={11} strokeWidth={2.2} aria-hidden="true" />
                  <span>{detailCopy.likesCount(details.likes)}</span>
                </span>
              ) : null}
            </div>
            <div className="plugins-v3__market-submeta">
              <span className="plugins-v3__id">{plugin.name}</span>
              {publisher ? <span>{detailCopy.publisherBy(publisher)}</span> : null}
              {details?.license ? <span>{detailCopy.licenseLabel(details.license)}</span> : null}
              {details && details.platforms.length > 0 ? (
                <span>{detailCopy.platformsLabel(details.platforms.join(", "))}</span>
              ) : null}
            </div>
          </div>

          {installCandidate ? (
            <button
              className="plugins-v3__btn plugins-v3__btn--primary"
              type="button"
              data-action="market-detail-install"
              onClick={() => {
                onClose();
                onChooseInstall(plugin, installCandidate.version, false);
              }}
            >
              {copy.installBtn}
            </button>
          ) : updateCandidate ? (
            <button
              className="plugins-v3__btn plugins-v3__btn--primary"
              type="button"
              data-action="market-detail-update"
              onClick={() => {
                onClose();
                onChooseInstall(plugin, updateCandidate.version, true);
              }}
            >
              {copy.updateBtn(updateCandidate.version)}
            </button>
          ) : installedVersion ? (
            <button className="plugins-v3__btn" type="button" disabled>
              {copy.installedBtn}
            </button>
          ) : (
            <button className="plugins-v3__btn" type="button" disabled>
              {copy.unavailableBtn}
            </button>
          )}

          <button
            ref={closeRef}
            className="plugins-v3__modal-close"
            type="button"
            aria-label={text.closeDetail}
            title={text.closeDetail}
            onClick={onClose}
          >
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {links.length > 0 ? (
          <div className="plugins-v3__ext-links">
            {links.map(({ key, url }) => (
              <button
                key={key}
                className="plugins-v3__ext-link"
                type="button"
                data-market-link={key}
                onClick={() => openExternalHttpUrl(url)}
              >
                <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                <span>{detailCopy.links[key]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {screenshots.length > 0 ? (
          <div className="plugins-v3__screenshots" aria-label={detailCopy.screenshotsHeading}>
            {screenshots.map((shot, idx) => {
              const caption = resolveRecordText(shot.caption, locale, "");
              return (
                <figure key={`${shot.url}-${idx}`} className="plugins-v3__screenshot">
                  <img src={shot.url} alt={caption || displayName} loading="lazy" />
                  {caption ? <figcaption>{caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        ) : null}

        {loading ? <p className="plugins-v3__empty">{detailCopy.loading}</p> : null}
        {error ? <p className="plugins-v3__error-banner">{error}</p> : null}

        {details && !loading ? (
          <>
            <div className="plugins-v3__detail-tabs" role="tablist">
              {DETAIL_TABS.map((item) => (
                <button
                  key={item}
                  className={`plugins-v3__tab${tab === item ? " plugins-v3__tab--active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  data-detail-tab={item}
                  onClick={() => setTab(item)}
                >
                  {detailCopy.tabs[item]}
                </button>
              ))}
            </div>
            <div className="plugins-v3__detail-panel" role="tabpanel">
              <DetailBody tab={tab} details={details} fallbackDesc={fallbackDesc} locale={locale} />
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.querySelector(".settings-stage") ?? document.getElementById("page") ?? document.body,
  );
}
