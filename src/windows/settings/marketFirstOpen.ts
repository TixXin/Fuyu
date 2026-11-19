import type { MarketCatalogSnapshot } from "@fuyu/plugin-services";

export type FirstFetchPhase = "idle" | "pending" | "failed" | "done";
export type FirstFetchStep = "fetch" | "hold" | "keep-failure" | "show";

export function needsFirstFetch(snapshot: Pick<MarketCatalogSnapshot, "updatedAt" | "plugins">): boolean {
  return snapshot.updatedAt === null && snapshot.plugins.length === 0;
}

export function firstFetchStep(phase: FirstFetchPhase, snapshot: Pick<MarketCatalogSnapshot, "updatedAt" | "plugins">): FirstFetchStep {
  if (!needsFirstFetch(snapshot)) return "show";
  if (phase === "idle") return "fetch";
  if (phase === "pending") return "hold";
  return phase === "failed" ? "keep-failure" : "show";
}
