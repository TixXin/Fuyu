import { Eye, EyeOff } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { useTranslation } from "../../../i18n";
import { EMPTY_ISLAND_PAGES, placeIslandPage, setIslandPageHidden, type IslandPagesLayout } from "../../../lib/settings/islandPages";
import { useChipReorder } from "./useChipReorder";
import type { IslandPageRow } from "./useIslandPageRows";

type PageStripProps = {
  rows: readonly IslandPageRow[];
  layout: IslandPagesLayout;
  save: (layout: IslandPagesLayout) => void;
  current: string | undefined;
  onPick: (id: string) => void;
  pluginsListed: boolean;
};

export function PageStrip({ rows, layout, save, current, onPick, pluginsListed }: PageStripProps) {
  const text = useTranslation().settings.islandPages;
  const listed = rows.map((row) => row.id);
  const { bind } = useChipReorder(listed, (id, before) => save(placeIslandPage(layout, listed, id, before)));
  const customized = layout.order.length > 0 || layout.hidden.length > 0;

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <div className="layout-chips island-pages" role="listbox" aria-label={text.title}>
        {rows.map((row) => {
          const Icon = row.icon;
          const badge = row.off ? text.off : row.plugin ? text.plugin : row.panel ? text.panels.tag : null;
          return (
            <div
              key={row.id}
              className="layout-chip island-pages__item"
              role="option"
              tabIndex={0}
              aria-selected={row.id === current}
              title={text.moveHint}
              data-page={row.id}
              data-off={row.off || undefined}
              data-hidden={row.hidden || undefined}
              onClick={() => onPick(row.id)}
              onKeyUp={(event) => {
                if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) onPick(row.id);
              }}
              {...bind(row.id)}
            >
              <span className="layout-chip__icon" aria-hidden="true">
                <Icon size={14} strokeWidth={1.9} />
              </span>
              <span className="layout-chip__name">{row.name}</span>
              {badge ? <small className="layout-chip__badge">{badge}</small> : null}
              <button
                className="layout-chip__action"
                type="button"
                aria-label={row.hidden ? text.showPage(row.name) : text.hidePage(row.name)}
                title={row.hidden ? text.showPage(row.name) : text.hidePage(row.name)}
                onClick={(event) => {
                  event.stopPropagation();
                  save(setIslandPageHidden(layout, row.id, !row.hidden));
                }}
              >
                {row.hidden ? <EyeOff size={13} strokeWidth={2} /> : <Eye size={13} strokeWidth={2} />}
              </button>
            </div>
          );
        })}
      </div>
      {pluginsListed ? null : <p className="settings-section__hint">{text.loading}</p>}
      <div className="layout-chips__actions">
        <button className="layout-chips__reset" type="button" disabled={!customized} onClick={() => save(EMPTY_ISLAND_PAGES)}>
          {text.reset}
        </button>
      </div>
    </SettingsGroup>
  );
}
