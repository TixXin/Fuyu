import type { SlotRegistry } from "@fuyu/plugin-base/client/slots";
import type { WindowServices } from "@fuyu/plugin-base/client/window-services";
import catalog from "../builtins.json";
import { onBuiltinDiagnosticsRequest, reportBuiltinDiagnostics, type BuiltinWindowUsage } from "./api.ts";
import { ipcDomains, namesOf, type IpcDomains } from "./featureDomains.ts";
import type { IpcLedger } from "./ipcLedger.ts";

const roots = catalog.plugins.map(({ id, root }) => ({ id, root }));

async function loadDomains(): Promise<IpcDomains> {
  const loaders = import.meta.glob<string>("/src/**/api.ts", { query: "?raw", import: "default" });
  const sources = Object.fromEntries(await Promise.all(Object.entries(loaders).map(async ([path, load]) => [path, await load()] as const)));
  return ipcDomains(sources, roots);
}

export function usageOf(id: string, domains: IpcDomains, ledger: IpcLedger, registries: readonly SlotRegistry[], services: WindowServices): BuiltinWindowUsage {
  const { commands, events } = namesOf(domains, id);
  const items = registries.reduce((sum, registry) => sum + registry.names().reduce((count, name) => count + registry.items(name).filter((item) => item.owner === id).length, 0), 0);
  return {
    id,
    items,
    listening: events.reduce((sum, event) => sum + ledger.listening(event), 0),
    calls: commands.reduce((sum, command) => sum + ledger.calls(command), 0),
    services: services.owned(id).services,
  };
}

export function answerBuiltinDiagnostics(ledger: IpcLedger, registries: readonly SlotRegistry[], services: WindowServices) {
  let domains: Promise<IpcDomains> | null = null;
  const label = new URLSearchParams(window.location.search).get("window") ?? "main";
  return onBuiltinDiagnosticsRequest((id) => {
    domains ??= loadDomains();
    void domains
      .then((loaded) => reportBuiltinDiagnostics({ id, window: label, plugins: roots.map((plugin) => usageOf(plugin.id, loaded, ledger, registries, services)) }))
      .catch((error: unknown) => console.error("Could not answer the built-in plugin diagnostics", error));
  });
}
