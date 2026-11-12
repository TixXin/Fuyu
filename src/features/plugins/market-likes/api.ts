import { invoke } from "@tauri-apps/api/core";

export type MarketLike = { count: number; url: string };
export type MarketLikes = Record<string, MarketLike>;

export function getPluginMarketLikes() {
  return invoke<MarketLikes>("get_plugin_market_likes");
}
