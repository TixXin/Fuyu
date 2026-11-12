import { useCallback, useState } from "react";

export const MARKET_FAVORITES_KEY = "fuyu-plugin-market-favorites";

export function loadMarketFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MARKET_FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : [];
  } catch {
    return [];
  }
}

function saveMarketFavorites(ids: string[]) {
  if (ids.length === 0) localStorage.removeItem(MARKET_FAVORITES_KEY);
  else localStorage.setItem(MARKET_FAVORITES_KEY, JSON.stringify(ids));
}

export function useMarketFavorites() {
  const [favorites, setFavorites] = useState(loadMarketFavorites);
  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      saveMarketFavorites(next);
      return next;
    });
  }, []);
  return { favorites, toggleFavorite };
}
