export interface LocalizedPluginTitle {
  "zh-CN": string;
  en: string;
}

export interface OfficialPluginMigration {
  v2Id: string;
  v3Id: string;
  title: LocalizedPluginTitle;
  enabledInV2: boolean;
  configMigrated: boolean;
  installedInV3: boolean;
  registeredInYml: boolean;
}

export interface LegacyV2Plugin {
  id: string;
  title: LocalizedPluginTitle | null;
  enabledInV2: boolean;
}

export interface V2MigrationSnapshot {
  official: OfficialPluginMigration[];
  other: LegacyV2Plugin[];
  islandPending: boolean;
  settingsPending: boolean;
}

export type V2MigrationDismissTarget = "island" | "settings" | "all";

export const EMPTY_V2_MIGRATION: V2MigrationSnapshot = Object.freeze({
  official: [],
  other: [],
  islandPending: false,
  settingsPending: false,
});

function normalizeTitle(value: unknown): LocalizedPluginTitle | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const zh = typeof raw["zh-CN"] === "string" ? raw["zh-CN"].trim() : "";
  const en = typeof raw.en === "string" ? raw.en.trim() : "";
  if (!zh && !en) return null;
  return { "zh-CN": zh || en, en: en || zh };
}

function normalizeOfficial(value: unknown): OfficialPluginMigration | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const v2Id = typeof raw.v2Id === "string" ? raw.v2Id.trim() : "";
  const v3Id = typeof raw.v3Id === "string" ? raw.v3Id.trim() : "";
  if (!v2Id || !v3Id) return null;
  const title = normalizeTitle(raw.title) ?? { "zh-CN": v3Id, en: v3Id };
  return {
    v2Id,
    v3Id,
    title,
    enabledInV2: raw.enabledInV2 === true,
    configMigrated: raw.configMigrated === true,
    installedInV3: raw.installedInV3 === true,
    registeredInYml: raw.registeredInYml === true,
  };
}

function normalizeOther(value: unknown): LegacyV2Plugin | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  return {
    id,
    title: normalizeTitle(raw.title),
    enabledInV2: raw.enabledInV2 === true,
  };
}

export function normalizeV2MigrationSnapshot(value: unknown): V2MigrationSnapshot {
  if (!value || typeof value !== "object") return EMPTY_V2_MIGRATION;
  const raw = value as Record<string, unknown>;
  const official = Array.isArray(raw.official)
    ? raw.official.map(normalizeOfficial).filter((item): item is OfficialPluginMigration => item !== null)
    : [];
  const other = Array.isArray(raw.other)
    ? raw.other.map(normalizeOther).filter((item): item is LegacyV2Plugin => item !== null)
    : [];
  if (official.length === 0 && other.length === 0) return EMPTY_V2_MIGRATION;
  return {
    official,
    other,
    islandPending: raw.islandPending === true,
    settingsPending: raw.settingsPending === true,
  };
}

export function totalLegacyPlugins(snapshot: V2MigrationSnapshot): number {
  return snapshot.official.length + snapshot.other.length;
}

export function shouldShowIslandMigrationNotice(snapshot: V2MigrationSnapshot): boolean {
  return snapshot.islandPending && totalLegacyPlugins(snapshot) > 0;
}

export function shouldShowSettingsMigrationCard(snapshot: V2MigrationSnapshot): boolean {
  return snapshot.settingsPending && totalLegacyPlugins(snapshot) > 0;
}

export function resolveLegacyPluginTitle(
  title: LocalizedPluginTitle | null,
  fallbackId: string,
  locale: string,
): string {
  if (!title) return fallbackId;
  return locale === "en" ? title.en : title["zh-CN"];
}
