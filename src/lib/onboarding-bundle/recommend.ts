export interface BundleText {
  "zh-CN": string;
  en: string;
}

export interface RecommendedBundle {
  id: string;
  displayName: BundleText;
  description: BundleText;
  members: { name: string; displayName: BundleText }[];
}

interface CatalogLike {
  plugins?: readonly { name: string; displayName: BundleText }[];
  bundles?: readonly {
    id: string;
    displayName: BundleText;
    description: BundleText;
    onboarding: boolean;
    members: readonly { name: string; state: string }[];
  }[];
}

const MAX_MEMBERS = 6;
const MAX_TEXT = 200;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function textOf(value: unknown): BundleText | null {
  if (!isRecord(value)) return null;
  const zh = value["zh-CN"];
  const en = value.en;
  if (typeof zh !== "string" || typeof en !== "string") return null;
  return { "zh-CN": zh.slice(0, MAX_TEXT), en: en.slice(0, MAX_TEXT) };
}

export function recommendedBundle(snapshot: CatalogLike | null | undefined): RecommendedBundle | null {
  const names = new Map((snapshot?.plugins ?? []).map((plugin) => [plugin.name, plugin.displayName]));
  for (const bundle of snapshot?.bundles ?? []) {
    if (!bundle.onboarding || !bundle.members.some((member) => member.state === "available")) continue;
    const members = bundle.members
      .filter((member) => member.state !== "unavailable")
      .map((member) => ({ name: member.name, displayName: names.get(member.name) ?? { "zh-CN": member.name, en: member.name } }));
    return { id: bundle.id, displayName: bundle.displayName, description: bundle.description, members };
  }
  return null;
}

export function parseRecommendedBundle(stored: unknown): RecommendedBundle | null {
  if (!isRecord(stored) || typeof stored.id !== "string" || stored.id === "" || !Array.isArray(stored.members)) return null;
  const displayName = textOf(stored.displayName);
  const description = textOf(stored.description);
  if (!displayName || !description) return null;
  const members = stored.members.slice(0, MAX_MEMBERS).flatMap((member) => {
    const name = isRecord(member) ? textOf(member.displayName) : null;
    return isRecord(member) && typeof member.name === "string" && name ? [{ name: member.name, displayName: name }] : [];
  });
  if (members.length === 0) return null;
  return { id: stored.id, displayName, description, members };
}

export function bundleText(text: BundleText, locale: string): string {
  return (locale === "en" ? text.en : text["zh-CN"]) || text["zh-CN"] || text.en;
}
