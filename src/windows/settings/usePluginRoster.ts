import { useEffect, useMemo, useState } from "react";
import { pluginConfigV1, type MarketCatalogSnapshot } from "@fuyu/plugin-services";
import { windowServices } from "../../features/plugin-kernel/services";
import { rosterGaps, type InstalledPlugin, type RosterConfig } from "../../lib/plugin-roster/roster";
import { loadRoster, loadRosterLocal, subscribeRoster } from "../../lib/plugin-roster/storage";

export const rosterConfigClient = windowServices.get(pluginConfigV1);

const readStored = () => ({ roster: loadRoster(), local: loadRosterLocal() });

export function usePluginRoster(snapshot: MarketCatalogSnapshot | null) {
  const [{ roster, local }, setStored] = useState(readStored);
  const [configs, setConfigs] = useState<Record<string, RosterConfig>>({});
  const [asked, setAsked] = useState(0);
  useEffect(() => subscribeRoster(() => setStored(readStored())), []);
  const wanted = useMemo(
    () => (snapshot?.installed ?? []).filter((plugin) => plugin.source === "market" && roster.some((item) => item.id === plugin.id && item.config)).map((plugin) => plugin.id).join("\n"),
    [roster, snapshot],
  );
  useEffect(() => {
    if (wanted === "") return;
    let live = true;
    const ids = wanted.split("\n");
    const load = () =>
      void Promise.all(ids.map(async (id) => [id, (await rosterConfigClient.get({ id })).values] as const))
        .then((entries) => {
          if (live) setConfigs(Object.fromEntries(entries));
        })
        .catch(() => undefined);
    load();
    const off = rosterConfigClient.on("changed", load);
    return () => {
      live = false;
      void off();
    };
  }, [wanted, snapshot, asked]);
  const installed = useMemo<InstalledPlugin[]>(
    () => (snapshot?.installed ?? []).map(({ id, source, enabled }) => ({ id, source, enabled, config: configs[id] ?? null })),
    [configs, snapshot],
  );
  const gaps = useMemo(() => rosterGaps(snapshot ? roster : [], local, installed), [installed, local, roster, snapshot]);
  return { gaps, installed, reload: () => setAsked((count) => count + 1) };
}
