import { useMemo } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp, Ellipsis } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../i18n";
import { HOVER_ONLY_ITEM_ID, needsHoverOnlyGauge, shownUsageProviders, usageItemId } from "../../../features/claude-usage/usageRing";
import { OWNER as CLAUDE_USAGE } from "../../../features/claude-usage/plugin/owner";
import { builtinConfigBoolean, disabledBuiltinIds, isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import {
  arrangeCollapsedItems,
  filterCollapsedItemEntries,
  moveCollapsedItem,
  setCollapsedItemHidden,
  setCollapsedItemShelf,
  setCollapsedItemZone,
  type CollapsedPlacement,
  type CollapsedZone,
} from "../../../lib/settings/collapsedItems";
import { useCollapsedOverflowIds } from "../../../lib/settings/useCollapsedOverflowIds";
import { useCollapsedPlacements } from "../../../lib/settings/useCollapsedPlacements";
import { useCollapsedPluginItems } from "./useCollapsedPluginItems";
import "./CollapsedItemsSection.css";

export function CollapsedItemsSection() {
  const t = useTranslation();
  const text = t.settings.collapsedItems;
  const hoverOnlyItemName = t.claudeUsage.hoverOnlyItemName;
  const { placements: saved, save } = useCollapsedPlacements();
  const plugins = useBuiltinPlugins();
  const usageOn = isBuiltinEnabled(plugins, CLAUDE_USAGE);
  const usageConfig = useBuiltinConfig(CLAUDE_USAGE);
  const pluginItems = useCollapsedPluginItems();
  const noRoom = useCollapsedOverflowIds();
  const timerName = t.island.timer;

  const names = useMemo(() => {
    const disabled = disabledBuiltinIds(plugins);
    const mailOn = builtinConfigBoolean(plugins, "messages", "mail") !== false;
    const entries: [string, string][] = [
      ["status-light", text.item.statusLight],
      ["mail", text.item.mail],
      ["update", text.item.update],
    ];
    entries.push(["device-use", text.item.deviceUse], ["shelf", text.item.shelf], ["music", text.item.music]);
    if (usageOn) {
      for (const provider of shownUsageProviders(usageConfig)) entries.push([usageItemId(provider), text.item.usage(provider.name)]);
      if (needsHoverOnlyGauge(usageConfig)) entries.push([HOVER_ONLY_ITEM_ID, text.item.usage(hoverOnlyItemName)]);
    }
    entries.push(["timer", timerName], ["session-count", text.item.sessionCount]);
    const builtin = new Map(filterCollapsedItemEntries(entries, disabled, mailOn));
    for (const [id, name] of pluginItems) if (!builtin.has(id)) builtin.set(id, name);
    return builtin;
  }, [hoverOnlyItemName, pluginItems, plugins, text, timerName, usageOn, usageConfig]);

  const listed = useMemo(() => [...names.keys()], [names]);
  const placements = useMemo(() => arrangeCollapsedItems(listed, saved), [listed, saved]);
  const change = (next: CollapsedPlacement[]) => save(next);

  const zone = (name: CollapsedZone) => {
    const rows = placements.filter((placement) => placement.zone === name && names.has(placement.id));
    return (
      <div className="collapsed-items__zone" role="group" aria-label={name === "left" ? text.left : text.right}>
        <h4 className="collapsed-items__zone-title">{name === "left" ? text.left : text.right}</h4>
        {rows.length === 0 ? <p className="settings-section__hint">{text.empty}</p> : null}
        <ul className="plugin-pages">
          {rows.map((placement, index) => {
            const label = names.get(placement.id) ?? placement.id;
            const switchId = `collapsed-item-${placement.id}`;
            return (
              <li className="plugin-pages__row collapsed-items__row" key={placement.id}>
                <span className="collapsed-items__number" aria-hidden="true">{index + 1}</span>
                <label className="plugin-pages__name" htmlFor={switchId}>
                  <strong>{label}</strong>
                  {!placement.hidden && (placement.shelf || noRoom.has(placement.id)) && (
                    <small data-badge={placement.shelf ? "panel" : "no-room"}>{placement.shelf ? text.inPanel : text.noRoom}</small>
                  )}
                </label>
                <button className="collapsed-items__button" type="button" disabled={index === 0} aria-label={text.moveUp(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, -1, listed))}>
                  <ArrowUp size={12} strokeWidth={2.4} />
                </button>
                <button className="collapsed-items__button" type="button" disabled={index === rows.length - 1} aria-label={text.moveDown(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, 1, listed))}>
                  <ArrowDown size={12} strokeWidth={2.4} />
                </button>
                <button
                  className="collapsed-items__button"
                  type="button"
                  aria-label={name === "left" ? text.toRight(label) : text.toLeft(label)}
                  onClick={() => change(setCollapsedItemZone(placements, placement.id, name === "left" ? "right" : "left"))}
                >
                  <ArrowLeftRight size={12} strokeWidth={2.4} />
                </button>
                <button
                  className="collapsed-items__button"
                  type="button"
                  aria-pressed={placement.shelf === true}
                  aria-label={placement.shelf ? text.fromPanel(label) : text.toPanel(label)}
                  onClick={() => change(setCollapsedItemShelf(placements, placement.id, !placement.shelf))}
                >
                  <Ellipsis size={12} strokeWidth={2.4} />
                </button>
                <SettingsSwitch id={switchId} checked={!placement.hidden} onChange={(show) => change(setCollapsedItemHidden(placements, placement.id, !show))} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <SettingsGroup title={text.title} footer={text.hint}>
      <div className="collapsed-items">
        <div className="collapsed-items__zones">
          {zone("left")}
          {zone("right")}
        </div>
        <button className="collapsed-items__button collapsed-items__reset" type="button" disabled={saved.length === 0} onClick={() => save([])}>
          {text.reset}
        </button>
      </div>
    </SettingsGroup>
  );
}
