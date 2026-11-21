import { useState } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { MAX_FITTED_COLLAPSED_WIDTH } from "../island/layout";
import { barUsageModel, isOnBar, type BarUsageRow } from "./barUsageRows";
import { PlacementLink } from "./island-layout/PlacementLinkRow";
import type { InstalledEntry } from "./pluginEntries";
import type { BarUsageView } from "./usePluginBarUsage";
import "./PluginBarUsage.css";

const share = (value: number | null, whole: number) => `${Math.min(100, Math.max(0, ((value ?? 0) / whole) * 100)).toFixed(2)}%`;

export function PluginBarUsage({ entries, usage, onOpenSettings }: {
  entries: readonly InstalledEntry[];
  usage: BarUsageView | undefined;
  onOpenSettings: (plugin: string) => void;
}) {
  const text = useTranslation().settings.pluginsV3.page.bar;
  const { placements: saved } = useCollapsedPlacements();
  const [open, setOpen] = useState<string | null>(null);
  if (usage === undefined) return null;
  const model = barUsageModel(
    entries.map((entry) => ({ id: entry.id, title: entry.title, running: entry.enabled && entry.plugin.state === "running", declaresBar: entry.places.includes("bar"), settings: entry.settings === true })),
    usage.report,
    saved,
  );
  if (model.rows.length === 0) return null;
  const onBar = model.rows.filter(isOnBar);
  const toggle = (key: string) => setOpen((current) => (current === key ? null : key));
  const side = (row: BarUsageRow) => (row.zone === "left" ? text.side.left : text.side.right);
  const stateText = (row: BarUsageRow) => {
    if (row.state === "shown") return `${side(row)} · ${text.width(row.width ?? 0)}`;
    if (row.state === "clipped") return `${side(row)} · ${text.width(row.width ?? 0)} · ${text.state.clipped(row.cut)}`;
    return text.state[row.state];
  };
  const note = usage.stale ? text.stale : model.measured ? null : usage.report === null ? text.unmeasured : text.expanded;

  return (
    <section className="plugin-bar" data-bar-usage={model.measured ? (usage.stale ? "stale" : "measured") : "unmeasured"}>
      <h3 className="plugin-page__heading">
        <span>{text.title}</span>
        {model.measured ? (
          <span className="plugin-page__heading-meta" data-bar-summary>
            {model.clipped > 0 ? <b className="plugin-bar__warn" data-bar-clipped>{text.clipped(model.clipped)}</b> : null}
            {model.plugins > 0 ? text.summary(model.plugins, model.used, model.barWidth ?? 0) : text.none}
          </span>
        ) : null}
      </h3>
      {model.measured && model.barWidth ? (
        <div className="plugin-bar__track">
          <div className="plugin-bar__map" role="group" aria-label={text.map} data-bar-map style={{ width: `min(100%, ${model.barWidth}px)` }}>
            {onBar.map((row, index) => (
              <button
                key={row.key}
                className={`plugin-bar__seg${row.state === "clipped" ? " plugin-bar__seg--clipped" : ""}`}
                type="button"
                data-bar-seg={row.key}
                aria-pressed={open === row.key}
                aria-label={`${row.title}: ${stateText(row)}`}
                title={`${row.title} · ${stateText(row)}`}
                style={{ left: share(row.left, model.barWidth!), width: share(row.width, model.barWidth!) }}
                onClick={() => toggle(row.key)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {note ? <p className="plugin-bar__note" data-bar-note>{note}</p> : null}
      <ul className="plugin-bar__list">
        {model.rows.map((row) => {
          const number = onBar.indexOf(row);
          const item = row.item;
          const usable = item !== null || row.settings;
          const expanded = usable && open === row.key;
          return (
            <li key={row.key} className="plugin-bar__item" data-bar-row={row.key} data-plugin={row.plugin} data-state={row.state}>
              <button className="plugin-bar__row" type="button" aria-expanded={usable ? expanded : undefined} disabled={!usable} onClick={() => toggle(row.key)}>
                <span className="plugin-bar__num" aria-hidden="true">{number >= 0 ? number + 1 : "·"}</span>
                <b>{row.title}</b>
                <span className="plugin-bar__state">{stateText(row)}</span>
              </button>
              {expanded ? (
                <div className="plugin-bar__actions" data-bar-actions>
                  {item !== null ? <span data-bar-action="island"><PlacementLink item={item} /></span> : null}
                  {row.settings ? (
                    <button className="plugin-btn plugin-btn--sm plugin-btn--ghost" type="button" data-bar-action="settings" onClick={() => onOpenSettings(row.plugin)}>
                      <Settings size={12} strokeWidth={2.4} aria-hidden="true" />{text.actions.settings}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {model.clipped > 0 ? <p className="plugin-bar__note" data-bar-why>{text.cap(MAX_FITTED_COLLAPSED_WIDTH)}</p> : null}
    </section>
  );
}
