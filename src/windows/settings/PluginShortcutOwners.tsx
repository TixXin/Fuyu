import { useCallback, useEffect, useState } from "react";
import { listPlugins } from "../../features/plugins/api";
import { pluginShortcutRows, type PluginShortcutRow } from "../../features/plugins/pluginShortcuts";
import { useLocale } from "../../i18n";
import { setShortcutOwnerRefresher } from "../../lib/shortcut/ownerStore";
import { useReportShortcutOwners } from "../../lib/shortcut/useReportShortcutOwners";

export function PluginShortcutOwners() {
  const { locale } = useLocale();
  const [pluginRows, setPluginRows] = useState<PluginShortcutRow[]>([]);

  const refreshPlugins = useCallback(() => {
    listPlugins()
      .then((snapshot) => setPluginRows(pluginShortcutRows(snapshot.plugins)))
      .catch((error: unknown) => console.error("Failed to list plugins", error));
  }, []);
  useEffect(() => {
    refreshPlugins();
    window.addEventListener("focus", refreshPlugins);
    return () => window.removeEventListener("focus", refreshPlugins);
  }, [refreshPlugins]);
  useEffect(() => {
    setShortcutOwnerRefresher(refreshPlugins);
    return () => setShortcutOwnerRefresher(null);
  }, [refreshPlugins]);

  useReportShortcutOwners("plugins", 50, pluginRows.flatMap((row) => row.shortcut
    ? [{ id: row.key, label: `${row.title[locale]} · ${row.pluginName[locale]}`, shortcut: row.shortcut, home: "plugins" }]
    : []));
  return null;
}
