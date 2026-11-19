import type { MarketCatalogBundle, MarketCatalogPlugin } from "@fuyu/plugin-services";

export type BundleAction = "install-all" | "install-rest" | "install-usable" | "done";

export interface BundleSummary {
  total: number;
  owned: number;
  available: number;
  unavailable: number;
  action: BundleAction;
}

export function bundleSummary(bundle: Pick<MarketCatalogBundle, "members">): BundleSummary {
  const total = bundle.members.length;
  const available = bundle.members.filter((member) => member.state === "available").length;
  const unavailable = bundle.members.filter((member) => member.state === "unavailable").length;
  const owned = total - available - unavailable;
  const action: BundleAction = available === 0 ? "done" : owned > 0 ? "install-rest" : unavailable > 0 ? "install-usable" : "install-all";
  return { total, owned, available, unavailable, action };
}

export function withInstalled(bundle: MarketCatalogBundle, names: readonly string[]): MarketCatalogBundle {
  if (names.length === 0) return bundle;
  return { ...bundle, members: bundle.members.map((member) => (member.state === "available" && names.includes(member.name) ? { name: member.name, state: "installed" } : member)) };
}

export function visibleBundles(bundles: readonly MarketCatalogBundle[], query: string, category: string | null): MarketCatalogBundle[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return category ? [] : [...bundles];
  return bundles.filter((bundle) => [...Object.values(bundle.displayName), ...Object.values(bundle.description)].some((text) => text.toLowerCase().includes(needle)));
}

export function outsidePublishers(bundle: MarketCatalogBundle, plugins: readonly MarketCatalogPlugin[]): string[] {
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  const names = bundle.members.flatMap((member) => {
    const plugin = member.state === "available" ? byName.get(member.name) : undefined;
    return plugin && !plugin.official ? [plugin.publisher.github || plugin.name] : [];
  });
  return [...new Set(names)];
}
