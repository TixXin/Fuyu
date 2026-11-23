import type { LucideIcon } from "lucide-react";
import { ZH_ICON_KEYWORDS } from "./zhIconKeywords.ts";

export type LucideCatalog = { names: readonly string[]; icon: (name: string) => LucideIcon | null };

const RESERVED = new Set(["text", "jellyfish"]);

export const iconKey = (name: string) => name.replace(/-/g, "").toLowerCase();
export const kebabIconName = (pascal: string) =>
  pascal.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([a-zA-Z])([0-9])/g, "$1-$2").toLowerCase();

const isComponent = (value: unknown): value is LucideIcon =>
  (typeof value === "object" && value !== null && "$$typeof" in value) || typeof value === "function";

function buildCatalog(module: Record<string, unknown>): LucideCatalog {
  const seen = new Set<unknown>();
  const byKey = new Map<string, LucideIcon>();
  const names: string[] = [];
  for (const [exported, value] of Object.entries(module)) {
    if (!/^[A-Z]/.test(exported) || !isComponent(value) || seen.has(value)) continue;
    const name = kebabIconName(exported);
    if (RESERVED.has(name)) continue;
    seen.add(value);
    byKey.set(iconKey(name), value);
    names.push(name);
  }
  names.sort();
  return { names, icon: (name) => byKey.get(iconKey(name)) ?? null };
}

let loaded: LucideCatalog | null = null;
let pending: Promise<LucideCatalog> | null = null;

export function lucideCatalogNow(): LucideCatalog | null {
  return loaded;
}

export function loadLucideCatalog(): Promise<LucideCatalog> {
  pending ??= import("lucide-react/dist/esm/icons/index.mjs").then((module) => {
    loaded = buildCatalog(module as unknown as Record<string, unknown>);
    return loaded;
  });
  return pending;
}

export function searchIcons(names: readonly string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const known = new Set(names);
  const keys = new Map(names.map((name) => [iconKey(name), name]));
  const score = new Map<string, number>();
  const add = (name: string, value: number) => {
    const real = known.has(name) ? name : keys.get(iconKey(name));
    if (real && (score.get(real) ?? Infinity) > value) score.set(real, value);
  };
  for (const [word, hits] of Object.entries(ZH_ICON_KEYWORDS)) {
    const base = word === q ? 0 : word.includes(q) || q.includes(word) ? 1 : -1;
    if (base >= 0) hits.forEach((name, rank) => add(name, base + rank / 100));
  }
  const dashed = q.replace(/\s+/g, "-");
  const flat = iconKey(dashed);
  for (const name of names) {
    if (name === dashed) add(name, 0);
    else if (name.startsWith(dashed)) add(name, 2);
    else if (name.split("-").some((part) => part.startsWith(dashed))) add(name, 3);
    else if (flat.length > 1 && iconKey(name).includes(flat)) add(name, 4);
  }
  return [...score].sort((a, b) => a[1] - b[1] || a[0].length - b[0].length || a[0].localeCompare(b[0])).map(([name]) => name);
}
