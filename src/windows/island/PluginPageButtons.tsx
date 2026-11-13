import type { PluginViewEntry } from "../../features/plugin-views/api";
import { viewIcon } from "../../features/plugin-views/icons";
import { pluginPageId } from "../../features/plugin-views/model";
import { useLocale, useTranslation } from "../../i18n";
import { pageShortcutLabel, type IslandFeatures } from "./features";
import type { IslandPage } from "./types";
import { usePageHoverSwitch } from "./usePageHoverSwitch";
import "./PluginPageButtons.css";
import { shortcutLabel } from "../../features/clipboard/shortcut";

export function PluginPageButtons({
  views,
  page,
  features,
  modifiers,
  hoverSwitchPage,
  hoverSwitchDelayMs,
  onOpen,
}: {
  views: readonly PluginViewEntry[];
  page: IslandPage;
  features: IslandFeatures;
  modifiers: string;
  hoverSwitchPage: boolean;
  hoverSwitchDelayMs: number;
  onOpen: (page: IslandPage) => void;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const hoverSwitch = usePageHoverSwitch(hoverSwitchPage, hoverSwitchDelayMs, page, onOpen);
  return (
    <>
      {views.map((view) => {
        const id = pluginPageId(view.pluginId, view.viewId);
        const Icon = viewIcon(view.icon);
        const label = t.pluginViews.pageLabel(view.title[locale], view.pluginName[locale]);
        const shortcut = pageShortcutLabel(features, id, modifiers);
        const title = shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
        return (
          <button
            className={`plugin-page-button${page === id ? " plugin-page-button--active" : ""}`}
            type="button"
            key={id}
            data-plugin-page={id}
            aria-label={title}
            aria-pressed={page === id}
            {...hoverSwitch(id)}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(id);
            }}
          >
            <Icon size={14} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
          </button>
        );
      })}
    </>
  );
}
