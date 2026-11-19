import { reconcileRoster, type InstalledPlugin, type RosterItem, type RosterLocal, type RosterSource } from "../../lib/plugin-roster/roster.ts";

export type RosterSyncDeps = {
  installed: () => Promise<readonly { id: string; source: RosterSource; enabled: boolean }[]>;
  config: (id: string) => Promise<Record<string, unknown>>;
  loadRoster: () => RosterItem[];
  saveRoster: (items: readonly RosterItem[]) => void;
  loadLocal: () => RosterLocal;
  saveLocal: (local: RosterLocal) => void;
};

export async function gatherInstalled(deps: Pick<RosterSyncDeps, "installed" | "config">): Promise<InstalledPlugin[]> {
  const plugins: InstalledPlugin[] = [];
  for (const { id, source, enabled } of await deps.installed()) {
    plugins.push({ id, source, enabled, config: source === "market" ? await deps.config(id) : null });
  }
  return plugins;
}

export function createRosterSync(deps: RosterSyncDeps) {
  let running: Promise<void> | null = null;
  let again = false;

  const once = async () => {
    let installed: InstalledPlugin[];
    try {
      installed = await gatherInstalled(deps);
    } catch {
      return;
    }
    const next = reconcileRoster(deps.loadRoster(), deps.loadLocal(), installed);
    if (next.rosterChanged) deps.saveRoster(next.roster);
    if (next.localChanged) deps.saveLocal(next.local);
  };

  const run = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = once().finally(() => {
      running = null;
      if (again) {
        again = false;
        void run();
      }
    });
    return running;
  };

  return { run };
}
