import { useLocale, useTranslation } from "../../i18n";
import { useV2PluginMigration } from "../../features/plugin-kernel/useV2PluginMigration";
import {
  resolveLegacyPluginTitle,
  shouldShowSettingsMigrationCard,
} from "../../features/plugin-kernel/v2Migration";
import type { SettingsCategory } from "./categories";
import "./V2PluginMigrationCard.css";

export function V2PluginMigrationCard({
  onOpenMarketTab,
  onOpenPage,
}: {
  onOpenMarketTab?: () => void;
  onOpenPage?: (page: SettingsCategory) => void;
}) {
  const copy = useTranslation().settings.pluginsV3.v2Migration;
  const { locale } = useLocale();
  const { snapshot, dismiss } = useV2PluginMigration();

  if (!shouldShowSettingsMigrationCard(snapshot)) {
    return null;
  }

  const needsMarketInstall = snapshot.official.some((item) => !item.installedInV3);

  return (
    <section className="plugins-v3__migration settings-group" aria-label={copy.title}>
      <div className="plugins-v3__migration-head">
        <h3 className="plugins-v3__migration-title">{copy.title}</h3>
        <p className="plugins-v3__migration-note">{copy.summary}</p>
      </div>

      {snapshot.official.length > 0 ? (
        <div className="plugins-v3__migration-section">
          <p className="plugins-v3__migration-subtitle">{copy.officialHeading}</p>
          <ul className="plugins-v3__migration-list">
            {snapshot.official.map((item) => {
              const title = resolveLegacyPluginTitle(item.title, item.v3Id, locale);
              const activeInV3 = item.installedInV3 && item.registeredInYml;
              return (
                <li
                  key={item.v2Id}
                  className="plugins-v3__migration-item"
                  data-v2-official={item.v2Id}
                >
                  <div className="plugins-v3__migration-main">
                    <span className="plugins-v3__migration-name">{title}</span>
                    <span className="plugins-v3__migration-map">{`${item.v2Id} → ${item.v3Id}`}</span>
                  </div>
                  <div className="plugins-v3__migration-badges">
                    {item.configMigrated ? (
                      <span className="plugins-v3__migration-pill">{copy.configCarried}</span>
                    ) : null}
                    <span
                      className={`plugins-v3__migration-pill ${
                        activeInV3 ? "plugins-v3__migration-pill--mint" : "plugins-v3__migration-pill--info"
                      }`}
                    >
                      {activeInV3 ? copy.switchedToV3 : copy.installInMarket}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {snapshot.other.length > 0 ? (
        <div className="plugins-v3__migration-section">
          <p className="plugins-v3__migration-subtitle">{copy.otherHeading}</p>
          <p className="plugins-v3__migration-note">{copy.otherNote}</p>
          <ul className="plugins-v3__migration-list">
            {snapshot.other.map((item) => {
              const title = resolveLegacyPluginTitle(item.title, item.id, locale);
              return (
                <li
                  key={item.id}
                  className="plugins-v3__migration-item"
                  data-v2-other={item.id}
                >
                  <div className="plugins-v3__migration-main">
                    <span className="plugins-v3__migration-name">{title}</span>
                    {title !== item.id ? (
                      <span className="plugins-v3__migration-map">{item.id}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="plugins-v3__migration-actions">
        {(onOpenMarketTab || onOpenPage) && needsMarketInstall ? (
          <button
            type="button"
            className="plugins-v3__migration-btn plugins-v3__migration-btn--primary"
            data-action="migration-open-market"
            onClick={() => (onOpenMarketTab ? onOpenMarketTab() : onOpenPage?.("market"))}
          >
            {copy.openMarket}
          </button>
        ) : null}
        <button
          type="button"
          className="plugins-v3__migration-btn plugins-v3__migration-dismiss"
          onClick={() => dismiss("settings")}
        >
          {copy.dismiss}
        </button>
      </div>
    </section>
  );
}
