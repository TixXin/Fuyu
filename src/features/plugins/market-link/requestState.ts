/**
 * What the market page shows for a plugin a website link asked to install: wait
 * while the market loads, the plugin once it is found, or say it isn't listed.
 */
export type MarketRequestState<P> = { kind: "loading" } | { kind: "failed" } | { kind: "missing" } | { kind: "found"; plugin: P };

export function marketRequestState<P extends { id: string }>(
  id: string,
  market: { plugins: P[] } | null,
  loading: boolean,
  loadError: string | null,
): MarketRequestState<P> {
  if (market) {
    const plugin = market.plugins.find((candidate) => candidate.id === id);
    return plugin ? { kind: "found", plugin } : loading ? { kind: "loading" } : { kind: "missing" };
  }
  return loadError && !loading ? { kind: "failed" } : { kind: "loading" };
}
