import { useHostChangeEvent } from "../../features/plugins/useHostChangeEvent";
import { useLocale } from "../../i18n";
import type { IslandMode } from "./types";

type PluginHostEventSources = {
  mode: IslandMode;
};

export function usePluginHostEvents({ mode }: PluginHostEventSources) {
  const { locale } = useLocale();
  useHostChangeEvent(mode === "expanded" ? "island.expanded" : "island.collapsed", [mode === "expanded"], () => ({}));
  useHostChangeEvent("app.locale.changed", [locale], () => ({ locale }));
}
