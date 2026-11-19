import { useState } from "react";
import { ArrowLeftRight, Check, Store } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { useV2PluginMigration } from "../../features/plugin-kernel/useV2PluginMigration";
import { resolveLegacyPluginTitle, shouldShowSettingsMigrationCard } from "../../features/plugin-kernel/v2Migration";
import { PluginBanner } from "./PluginPageBanners";

export function V2PluginMigrationCard({ onOpenMarket }: { onOpenMarket?: (detail?: string) => void }) {
  const copy = useTranslation().settings.pluginsV3.page.migration;
  const { locale } = useLocale();
  const { snapshot, dismiss } = useV2PluginMigration();
  const [open, setOpen] = useState(true);

  if (!shouldShowSettingsMigrationCard(snapshot)) return null;

  const count = snapshot.official.length + snapshot.other.length;
  return (
    <PluginBanner
      name="migration"
      tone="info"
      icon={<ArrowLeftRight size={16} strokeWidth={2.2} />}
      title={
        <>
          <span>{copy.title}</span>
          <button className="plugin-link" type="button" aria-expanded={open} data-action="migration-toggle" onClick={() => setOpen((value) => !value)}>
            {open ? copy.collapse : copy.expand(count)}
          </button>
        </>
      }
      extra={
        open ? (
          <ul className="plugin-migration">
            {snapshot.official.map((item) => {
              const active = item.installedInV3 && item.registeredInYml;
              return (
                <li key={item.v2Id} data-v2-official={item.v2Id}>
                  <span className="plugin-migration__name">
                    {resolveLegacyPluginTitle(item.title, item.v3Id, locale)}
                    <small>{copy.oldPlugin}</small>
                  </span>
                  {active ? (
                    <span className="plugin-migration__state plugin-migration__state--ok">
                      <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                      {item.configMigrated ? copy.switchedKept : copy.switched}
                    </span>
                  ) : (
                    <>
                      <span className="plugin-migration__state">{item.configMigrated ? copy.readyKept : copy.ready}</span>
                      {onOpenMarket ? (
                        <button className="plugin-btn plugin-btn--sm plugin-btn--primary" type="button" data-action="migration-get" onClick={() => onOpenMarket(item.v3Id)}>
                          {copy.getIt}
                        </button>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
            {snapshot.other.map((item) => (
              <li key={item.id} data-v2-other={item.id}>
                <span className="plugin-migration__name">
                  {resolveLegacyPluginTitle(item.title, item.id, locale)}
                  <small>{copy.oldPlugin}</small>
                </span>
                <span className="plugin-migration__state">{copy.unavailable}</span>
              </li>
            ))}
          </ul>
        ) : null
      }
      actions={
        <>
          {onOpenMarket ? (
            <button className="plugin-btn" type="button" data-action="migration-open-market" onClick={() => onOpenMarket()}>
              <Store size={13} strokeWidth={2.2} aria-hidden="true" />
              {copy.openMarket}
            </button>
          ) : null}
          <button className="plugin-btn plugin-btn--ghost plugin-migration__dismiss" type="button" onClick={() => dismiss("settings")}>
            {copy.dismiss}
          </button>
        </>
      }
    >
      {copy.summary}
    </PluginBanner>
  );
}
