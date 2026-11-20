import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import type { BarUsagePage } from "../../../features/plugin-kernel/barUsage";
import { useTranslation } from "../../../i18n";
import { createPanel, newPanelId, panelPageId, removePanel } from "../../../lib/settings/customPanels";
import { EMPTY_ISLAND_PAGES, moveIslandPage, setIslandPageHidden } from "../../../lib/settings/islandPages";
import type { IslandSettings } from "../../../lib/settings/types";
import { useCustomPanels } from "../../../lib/settings/useCustomPanels";
import { CustomPanelEditor } from "./CustomPanelEditor";
import type { CollapsedLayout } from "./useCollapsedLayout";
import { useIslandPageRows } from "./useIslandPageRows";
import "./IslandPagesSection.css";

type IslandPagesSectionProps = {
  settings: IslandSettings;
  pluginPages: readonly BarUsagePage[] | null;
  layout: CollapsedLayout;
};

export function IslandPagesSection({ settings, pluginPages, layout: collapsed }: IslandPagesSectionProps) {
  const t = useTranslation();
  const text = t.settings.islandPages;
  const moves = t.settings.collapsedItems;
  const { panels, save: savePanels } = useCustomPanels();
  const [editing, setEditing] = useState<string | null>(null);
  const { rows, layout, save, pluginsListed } = useIslandPageRows(settings, pluginPages, panels);
  const listed = rows.map((row) => row.id);
  const customized = layout.order.length > 0 || layout.hidden.length > 0;
  const editingPanel = panels.find((panel) => panel.id === editing) ?? null;

  const create = () => {
    const id = newPanelId(Date.now(), Math.random());
    savePanels(createPanel(panels, id, t.islandWidgets.panel.defaultName, "layout-grid"));
    setEditing(id);
  };

  const remove = (id: string) => {
    const page = panelPageId(id);
    savePanels(removePanel(panels, id));
    save({ order: layout.order.filter((other) => other !== page), hidden: layout.hidden.filter((other) => other !== page) });
    setEditing(null);
  };

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <div className="collapsed-items island-pages">
        <ul className="plugin-pages">
          {rows.map((row, index) => {
            const Icon = row.icon;
            const panelId = row.panel;
            return (
              <li key={row.id} className="collapsed-items__item island-pages__item" data-page={row.id} data-off={row.off || undefined} data-hidden={row.hidden || undefined} data-editing={panelId !== undefined && panelId === editing ? true : undefined}>
                <div className="plugin-pages__row collapsed-items__row">
                  <span className="collapsed-items__number" aria-hidden="true">{index + 1}</span>
                  <Icon className="island-pages__icon" size={14} strokeWidth={1.8} aria-hidden="true" />
                  <span className="plugin-pages__name">
                    <strong>{row.name}</strong>
                    {row.off ? <small data-badge="off">{text.off}</small> : row.plugin ? <small data-badge="plugin">{text.plugin}</small> : panelId ? <small data-badge="custom">{text.panels.tag}</small> : null}
                  </span>
                  {panelId ? (
                    <button className="collapsed-items__button" type="button" aria-label={text.panels.edit(row.name)} aria-pressed={panelId === editing} onClick={() => setEditing(panelId === editing ? null : panelId)}>
                      <Pencil size={12} strokeWidth={2.2} />
                    </button>
                  ) : null}
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
        <div className="island-pages__actions">
          <button className="collapsed-items__button island-pages__create" type="button" onClick={create}>
            <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
            {text.panels.create}
          </button>
          <button className="collapsed-items__button collapsed-items__reset" type="button" disabled={!customized} onClick={() => save(EMPTY_ISLAND_PAGES)}>
            {text.reset}
          </button>
        </div>
        {editingPanel ? (
          <CustomPanelEditor
            key={editingPanel.id}
            panel={editingPanel}
            collapsed={collapsed}
            onChange={(next) => savePanels(panels.map((panel) => (panel.id === next.id ? next : panel)))}
            onRemove={() => remove(editingPanel.id)}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </div>
    </SettingsGroup>
  );
}
