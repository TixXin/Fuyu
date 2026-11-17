import { useMemo } from "react";
import { ArrowDown, ArrowLeftRight, ArrowUp } from "lucide-react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSwitch } from "../../../components/settings/SettingsSwitch";
import { useLocale, useTranslation } from "../../../i18n";
import { shownUsageProviders, usageItemId } from "../../../features/claude-usage/usageRing";
import { pluginStatusItemId } from "../../../features/plugin-views/usePluginStatusItems";
import { usePluginStatusItemList } from "../../../features/plugin-views/usePluginViews";
import { OWNER as CLAUDE_USAGE } from "../../../features/claude-usage/plugin/owner";
import { builtinConfigBoolean, disabledBuiltinIds, isBuiltinEnabled } from "../../../features/plugin-kernel/builtinSwitches";
import { useBuiltinConfig, useBuiltinPlugins } from "../../../features/plugin-kernel/useBuiltinPlugins";
import {
  arrangeCollapsedItems,
  filterCollapsedItemEntries,
  moveCollapsedItem,
  setCollapsedItemHidden,
  setCollapsedItemZone,
  type CollapsedPlacement,
  type CollapsedZone,
} from "../../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../../lib/settings/useCollapsedPlacements";
import "../../../features/plugin-views/PluginIslandPagesSection.css";
import "./CollapsedItemsSection.css";

export function CollapsedItemsSection() {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.collapsedItems;
  const { placements: saved, save } = useCollapsedPlacements();
  const plugins = useBuiltinPlugins();
  const usageOn = isBuiltinEnabled(plugins, CLAUDE_USAGE);
  const usageConfig = useBuiltinConfig(CLAUDE_USAGE);
  const declared = usePluginStatusItemList();

  const names = useMemo(() => {
    const disabled = disabledBuiltinIds(plugins);
    const mailOn = builtinConfigBoolean(plugins, "messages", "mail") !== false;
    const entries: [string, string][] = [
      ["status-light", text.item.statusLight],
      ["mail", text.item.mail],
      ["update", text.item.update],
    ];
    for (const item of declared) {
      const several = declared.filter((other) => other.pluginId === item.pluginId).length > 1;
      const plugin = item.pluginName[locale];
      entries.push([pluginStatusItemId(item.pluginId, item.itemId), several ? `${plugin} · ${item.itemId}` : plugin]);
    }
    entries.push(["device-use", text.item.deviceUse], ["shelf", text.item.shelf], ["music", text.item.music]);
    if (usageOn) {
      for (const provider of shownUsageProviders(usageConfig)) entries.push([usageItemId(provider), text.item.usage(provider.name)]);
    }
    entries.push(["session-count", text.item.sessionCount]);
    return new Map(filterCollapsedItemEntries(entries, disabled, mailOn));
  }, [declared, locale, plugins, text, usageOn, usageConfig]);

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
                <label className="plugin-pages__name" htmlFor={switchId}><strong>{label}</strong></label>
                <button className="plugin-card__button" type="button" disabled={index === 0} aria-label={text.moveUp(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, -1, listed))}>
                  <ArrowUp size={12} strokeWidth={2.4} />
                </button>
                <button className="plugin-card__button" type="button" disabled={index === rows.length - 1} aria-label={text.moveDown(label)} onClick={() => change(moveCollapsedItem(placements, placement.id, 1, listed))}>
                  <ArrowDown size={12} strokeWidth={2.4} />
                </button>
                <button
                  className="plugin-card__button"
                  type="button"
                  aria-label={name === "left" ? text.toRight(label) : text.toLeft(label)}
                  onClick={() => change(setCollapsedItemZone(placements, placement.id, name === "left" ? "right" : "left"))}
                >
                  <ArrowLeftRight size={12} strokeWidth={2.4} />
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
        <button className="plugin-card__button collapsed-items__reset" type="button" disabled={saved.length === 0} onClick={() => save([])}>
          {text.reset}
        </button>
      </div>
    </SettingsGroup>
  );
}
