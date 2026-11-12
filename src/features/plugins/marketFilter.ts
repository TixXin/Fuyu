import type { MarketPlugin } from "./api";

export type MarketFilter = {
  query: string;
  category: string;
};

export function filterMarketPlugins(plugins: MarketPlugin[], filter: MarketFilter, officialPublisher: string): MarketPlugin[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return plugins.filter((plugin) => {
    if (filter.category && !plugin.categories.includes(filter.category)) return false;
    if (words.length === 0) return true;
    const text = [
      plugin.id,
      plugin.name["zh-CN"],
      plugin.name.en,
      plugin.description?.["zh-CN"] ?? "",
      plugin.description?.en ?? "",
      plugin.publisher || officialPublisher,
      plugin.author,
    ]
      .join("\n")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function usedCategories<T extends string>(plugins: MarketPlugin[], order: readonly T[]): T[] {
  return order.filter((category) => plugins.some((plugin) => plugin.categories.includes(category)));
}

export function repositoryUrl(repo: string | null): string | null {
  return repo && /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(repo) ? `https://github.com/${repo}` : null;
}
