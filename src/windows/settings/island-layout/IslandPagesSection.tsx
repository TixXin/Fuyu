import { ArrowDown, ArrowUp } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import type { BarUsagePage } from "../../../features/plugin-kernel/barUsage";
import { useTranslation } from "../../../i18n";
import { EMPTY_ISLAND_PAGES, moveIslandPage, setIslandPageHidden } from "../../../lib/settings/islandPages";
import type { IslandSettings } from "../../../lib/settings/types";
import { useIslandPageRows } from "./useIslandPageRows";
import "./IslandPagesSection.css";

export function IslandPagesSection({ settings, pluginPages }: { settings: IslandSettings; pluginPages: readonly BarUsagePage[] | null }) {
  const t = useTranslation().settings;
  const text = t.islandPages;
  const moves = t.collapsedItems;
  const { rows, layout, save, pluginsListed } = useIslandPageRows(settings, pluginPages);
  const listed = rows.map((row) => row.id);
  const customized = layout.order.length > 0 || layout.hidden.length > 0;

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <div className="collapsed-items island-pages">
        <ul className="plugin-pages">
          {rows.map((row, index) => {
            const Icon = row.icon;
            return (
              <li key={row.id} className="collapsed-items__item island-pages__item" data-page={row.id} data-off={row.off || undefined} data-hidden={row.hidden || undefined}>
                <div className="plugin-pages__row collapsed-items__row">
                  <span className="collapsed-items__number" aria-hidden="true">{index + 1}</span>
                  <Icon className="island-pages__icon" size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span className="plugin-pages__name">
                    <strong>{row.name}</strong>
                    {row.off ? <small data-badge="off">{text.off}</small> : row.plugin ? <small data-badge="plugin">{text.plugin}</small> : null}
                  </span>
                  <button className="collapsed-items__button" type="button" disabled={index === 0} aria-label={moves.moveUp(row.name)} onClick={() => save(moveIslandPage(layout, listed, row.id, -1))}>
                    <ArrowUp size={12} strokeWidth={2.4} />
                  </button>
                  <button className="collapsed-items__button" type="button" disabled={index === rows.length - 1} aria-label={moves.moveDown(row.name)} onClick={() => save(moveIslandPage(layout, listed, row.id, 1))}>
                    <ArrowDown size={12} strokeWidth={2.4} />
                  </button>
                  <SettingsSwitch id={`island-page-${row.id}`} ariaLabel={text.showPage(row.name)} checked={!row.hidden} onChange={(show) => save(setIslandPageHidden(layout, row.id, !show))} />
                </div>
              </li>
            );
          })}
        </ul>
        {pluginsListed ? null : <p className="settings-section__hint">{text.loading}</p>}
        <button className="collapsed-items__button collapsed-items__reset" type="button" disabled={!customized} onClick={() => save(EMPTY_ISLAND_PAGES)}>
          {text.reset}
        </button>
      </div>
    </SettingsGroup>
  );
}
