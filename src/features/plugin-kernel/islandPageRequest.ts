export const ISLAND_PLUGIN_PAGE_EVENT = "island-open-plugin-page";

export type IslandPluginPageRequest = { pluginId: string; page?: string };

export type IslandPageCandidate = { id: string; owner: string; external: boolean };

export function islandPluginPageRequest(pluginId: string, page?: string): IslandPluginPageRequest {
  return page ? { pluginId, page } : { pluginId };
}

export function readIslandPluginPageRequest(payload: unknown): IslandPluginPageRequest | null {
  if (!payload || typeof payload !== "object") return null;
  const { pluginId, page } = payload as { pluginId?: unknown; page?: unknown };
  if (typeof pluginId !== "string" || pluginId === "") return null;
  return islandPluginPageRequest(pluginId, typeof page === "string" ? page : undefined);
}

export function pluginIslandPage(request: IslandPluginPageRequest, pages: readonly IslandPageCandidate[]): string | null {
  const own = pages.filter((page) => page.external && page.owner === request.pluginId);
  if (request.page) return own.some((page) => page.id === request.page) ? request.page : null;
  return own[0]?.id ?? null;
}
