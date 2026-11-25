import { pickLocale } from "@fuyu/plugin-base/protocol";

export type SlotTitle = string | Readonly<Record<string, string>>;

export function localizedTitle(title: unknown, locale: string): string | null {
  const picked = pickLocale(title, locale);
  return picked !== "" ? picked : null;
}

export function packageLabel(id: string): string {
  const bare = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  return bare.trim() || id;
}
