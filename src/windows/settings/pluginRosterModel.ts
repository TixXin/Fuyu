import type { MarketCatalogPlugin, PluginConfigSchema } from "@fuyu/plugin-services";
import type { RosterConfig, RosterItem } from "../../lib/plugin-roster/roster.ts";

export type MissingPlan = {
  install: RosterItem[];
  review: RosterItem[];
  unavailable: RosterItem[];
};

export type RosterClients = {
  getConfig: (id: string) => Promise<{ schema: PluginConfigSchema | null; values: RosterConfig }>;
  setConfig: (id: string, values: RosterConfig) => Promise<unknown>;
  install: (name: string) => Promise<unknown>;
  setEnabled: (id: string, enabled: boolean) => Promise<unknown>;
};

export function planMissing(missing: readonly RosterItem[], plugins: readonly MarketCatalogPlugin[], indexLoaded: boolean): MissingPlan {
  const plan: MissingPlan = { install: [], review: [], unavailable: [] };
  for (const item of missing) {
    const plugin = plugins.find((entry) => entry.name === item.id);
    if (!plugin) {
      (indexLoaded ? plan.unavailable : plan.install).push(item);
      continue;
    }
    const candidate = plugin.install ?? plugin.manual;
    if (plugin.revoked || plugin.blocked || !candidate) plan.unavailable.push(item);
    else if (!plugin.install || candidate.confirmation.unreviewed || candidate.trustChange || plugin.revocation) plan.review.push(item);
    else plan.install.push(item);
  }
  return plan;
}

export async function installRosterItem(clients: RosterClients, item: RosterItem): Promise<void> {
  if (item.config) await clients.setConfig(item.id, item.config).catch(() => undefined);
  await clients.install(item.id);
  if (!item.enabled) await clients.setEnabled(item.id, false);
}

export async function applyRosterConfig(clients: RosterClients, item: RosterItem, running: boolean): Promise<void> {
  if (!item.config) return;
  const entry = await clients.getConfig(item.id);
  if (entry.schema) {
    const fields = entry.schema.properties ?? {};
    for (const [field, value] of Object.entries(item.config)) {
      if (!(field in fields) || JSON.stringify(entry.values[field]) === JSON.stringify(value)) continue;
      await clients.setConfig(item.id, { [field]: value }).catch(() => undefined);
    }
    return;
  }
  await clients.setConfig(item.id, item.config);
  if (!running) return;
  await clients.setEnabled(item.id, false);
  await clients.setEnabled(item.id, true);
}
