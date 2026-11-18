import { useCallback, useEffect, useState } from "react";
import { commandsV1, type CommandItem } from "@fuyu/plugin-services";
import { pluginRuntime } from "../../features/plugin-kernel/runtime";
import { windowServices } from "../../features/plugin-kernel/services";
import { useLocale } from "../../i18n";
import { useReportShortcutOwners } from "../../lib/shortcut/useReportShortcutOwners";

const commandsClient = windowServices.get(commandsV1);

function pickText(map: Record<string, string> | null | undefined, locale: string, fallback: string): string {
  if (!map) return fallback;
  return map[locale] ?? map["zh-CN"] ?? map.en ?? fallback;
}

export function PluginV3ShortcutOwners() {
  const { locale } = useLocale();
  const [items, setItems] = useState<CommandItem[]>([]);

  const refresh = useCallback(() => {
    commandsClient
      .list()
      .then((res) => setItems(res.items))
      .catch((error: { code?: string } | null) => {
        if (error?.code === "not-ready") void pluginRuntime("settings");
      });
  }, []);

  useEffect(() => {
    refresh();
    const offChanged = commandsClient.on("changed", (next) => setItems(next.items));
    const offWatch = windowServices.watch(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      void offChanged();
      offWatch();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  useReportShortcutOwners(
    "pluginsV3",
    48,
    items.flatMap((item) =>
      item.active && item.keybinding
        ? [
            {
              id: `pluginV3:${item.pluginId}/${item.id}`,
              label: `${pickText(item.title, locale, item.id)} · ${pickText(item.pluginName, locale, item.pluginId)}`,
              shortcut: item.keybinding,
              home: "pluginsV3",
            },
          ]
        : [],
    ),
  );
  return null;
}
