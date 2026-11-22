import { PlacementLink } from "./island-layout/PlacementLinkRow";
import { usePluginBarUsage } from "./usePluginBarUsage";

export function InstalledPlace({ plugin }: { plugin: string }) {
  const { usage } = usePluginBarUsage(true);
  const item = usage?.report?.items.find((candidate) => candidate.owner === plugin && candidate.hideable);
  return item ? <span className="plugin-toast__place" data-installed-place={item.id}><PlacementLink item={item.id} /></span> : null;
}
