import { ArrowUpRight } from "lucide-react";
import { requestIslandPluginPage } from "../../features/plugin-kernel/api";
import { useTranslation } from "../../i18n";
import type { InstalledEntry } from "./pluginEntries";

export function canOpenOnIsland(entry: InstalledEntry, stale: boolean): boolean {
  return entry.places.includes("page") && entry.enabled && !stale;
}

export function openOnIsland(entry: InstalledEntry) {
  void requestIslandPluginPage(entry.id).catch((error: unknown) => console.error(`Failed to open ${entry.id} on the island`, error));
}

export function PluginPlaceTags({ entry, stale, onOpenSettings }: { entry: InstalledEntry; stale: boolean; onOpenSettings: () => void }) {
  const text = useTranslation().settings.pluginsV3.page;
  if (entry.places.length === 0) return null;
  const canOpen = canOpenOnIsland(entry, stale);
  return (
    <span className="plugin-places" role="group" aria-label={text.placesLabel}>
      {entry.places.map((place) => {
        if (place === "page") {
          return canOpen ? (
            <button key={place} className="plugin-place plugin-place--go" type="button" data-place={place} title={text.openPageTitle(entry.title)} onClick={() => openOnIsland(entry)}>
              {text.places.page}
              <ArrowUpRight size={11} strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : (
            <span key={place} className="plugin-place" data-place={place} title={text.pageOffTitle}>{text.places.page}</span>
          );
        }
        if (place === "settings") {
          return (
            <button key={place} className="plugin-place" type="button" data-place={place} title={text.openSettingsTitle} onClick={onOpenSettings}>
              {text.places.settings}
            </button>
          );
        }
        return <span key={place} className="plugin-place" data-place={place}>{text.places[place]}</span>;
      })}
    </span>
  );
}

export function PluginWhereLine({ entry, stale, onOpenSettings }: { entry: InstalledEntry; stale: boolean; onOpenSettings: () => void }) {
  const text = useTranslation().settings.pluginsV3.page;
  if (entry.places.length === 0) return null;
  return (
    <div className="plugin-where" data-where={entry.id}>
      <span className="plugin-where__label">{text.detail.where}</span>
      <PluginPlaceTags entry={entry} stale={stale} onOpenSettings={onOpenSettings} />
      <span className="plugin-dialog__grow" />
      {canOpenOnIsland(entry, stale) ? (
        <button className="plugin-btn plugin-btn--sm" type="button" data-action="open-on-island" onClick={() => openOnIsland(entry)}>
          <ArrowUpRight size={13} strokeWidth={2.2} aria-hidden="true" />
          {text.detail.openOnIsland}
        </button>
      ) : null}
    </div>
  );
}
