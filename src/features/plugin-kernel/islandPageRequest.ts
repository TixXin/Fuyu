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

export type IslandPageRefusal = "no-page" | "not-owner" | "not-found";

export type OwnIslandPage = { page: string } | { refusal: IslandPageRefusal };

export function ownIslandPage(pluginId: string, page: string | undefined, pages: readonly IslandPageCandidate[]): OwnIslandPage {
  const found = pluginIslandPage(islandPluginPageRequest(pluginId, page), pages);
  if (found) return { page: found };
  if (page && pages.some((item) => item.id === page)) return { refusal: "not-owner" };
  return { refusal: pages.some((item) => item.external && item.owner === pluginId) ? "not-found" : "no-page" };
}

export function showsOwnIslandPage(pluginId: string, island: { mode: string; page: string }, pages: readonly IslandPageCandidate[]): boolean {
  return island.mode === "expanded" && pages.some((item) => item.external && item.owner === pluginId && item.id === island.page);
}
