import type { MouseEvent } from "react";
import { Blocks } from "lucide-react";
import type { MarketCatalogPlugin } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { resolvePluginText } from "./PluginInstallConfirmModal";

export function PluginMarketCard({
  plugin,
  onOpenDetail,
  onChooseMarketInstall,
}: {
  plugin: MarketCatalogPlugin;
  onOpenDetail: (plugin: MarketCatalogPlugin) => void;
  onChooseMarketInstall: (plugin: MarketCatalogPlugin, version: string, isUpdate: boolean) => void;
}) {
  const { locale } = useLocale();
  const copy = useTranslation().settings.pluginsV3.market;
  const title = resolvePluginText(plugin.displayName, locale, plugin.name);
  const desc = resolvePluginText(plugin.description, locale, "");
  const installCandidate = !plugin.installedVersion ? (plugin.install ?? plugin.manual) : null;
  const updateCandidate = plugin.installedVersion ? (plugin.manual ?? plugin.autoUpdate) : null;
  const activeCandidate = updateCandidate ?? installCandidate;
  const freshInstall = Boolean(installCandidate?.fresh);
  const freshUpdate = Boolean(updateCandidate?.fresh);

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("button")) return;
    onOpenDetail(plugin);
  };

  return (
    <article className="plugins-v3__card" data-market-plugin={plugin.name} onClick={handleCardClick}>
      <div className="plugins-v3__plugin-head">
        <span className="plugins-v3__icon plugins-v3__icon--info" aria-hidden="true">
          <Blocks size={16} strokeWidth={2} />
          <span className="plugins-v3__dot" />
        </span>
        <div className="plugins-v3__title-col">
          <div className="plugins-v3__title-line">
            <button
              className="plugins-v3__name-btn"
              type="button"
              title={title}
              data-action="market-open-detail"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetail(plugin);
              }}
            >
              {title}
            </button>
            {plugin.official ? (
              <span className="plugins-v3__pill plugins-v3__pill--official">{copy.officialBadge}</span>
            ) : (
              <span className="plugins-v3__pill">{copy.reviewedBadge}</span>
            )}
            {freshInstall ? (
              <span className="plugins-v3__pill" title={copy.cooldownTitle}>{copy.cooldownBadge}</span>
            ) : null}
            {plugin.revoked ? <span className="plugins-v3__pill plugins-v3__pill--bad">{copy.revokedBadge}</span> : null}
          </div>
          <span className="plugins-v3__id">{plugin.name}</span>
        </div>
      </div>

      {desc ? <p className="plugins-v3__note">{desc}</p> : null}

      <div className="plugins-v3__card-foot">
        <span>
          {plugin.installedVersion
            ? `${copy.installedBadge(plugin.installedVersion)}${freshUpdate ? ` · ${copy.cooldownHint}` : ""}`
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
              onClick={(event) => {
                event.stopPropagation();
                onChooseMarketInstall(plugin, installCandidate.version, false);
              }}
            >
              {copy.installBtn}
            </button>
          ) : updateCandidate ? (
            <button
              className="plugins-v3__btn plugins-v3__btn--primary"
              type="button"
              data-action="market-update"
              onClick={(event) => {
                event.stopPropagation();
                onChooseMarketInstall(plugin, updateCandidate.version, true);
              }}
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
