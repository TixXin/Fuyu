export interface IslandApi {
  open?: (page?: string) => Promise<unknown>;
  collapse?: () => Promise<boolean> | boolean;
}

export function islandApi(ctx: unknown): IslandApi | null {
  try {
    const island = (ctx as { island?: unknown }).island;
    return island && typeof island === "object" ? (island as IslandApi) : null;
  } catch {
    return null;
  }
}
