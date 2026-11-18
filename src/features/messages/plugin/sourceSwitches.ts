import { IM_SOURCE_IDS, imAutoClearKey, isImAutoClearEnabled, type ImSourceId } from "../im-sources/imSourcesState.ts";

export const LEGACY_MESSAGE_SOURCES = ["qq", "wechat", "mail"] as const;

export const MESSAGE_SOURCES = [...LEGACY_MESSAGE_SOURCES, ...IM_SOURCE_IDS] as const;

export type MessageSource = (typeof MESSAGE_SOURCES)[number];

export type SourceValues = Record<MessageSource, boolean>;

export type SourceConfig = Readonly<Record<string, unknown>>;

export { IM_SOURCE_IDS, imAutoClearKey, isImAutoClearEnabled, type ImSourceId };

export function sourceSwitch(config: SourceConfig, source: string): boolean | undefined {
  const value = config[source];
  return typeof value === "boolean" ? value : undefined;
}

export function imSourceEnabled(config: SourceConfig, source: ImSourceId): boolean {
  return sourceSwitch(config, source) ?? false;
}

export function migrateSources(
  stored: Partial<SourceValues>,
  config: SourceConfig,
  sources: readonly MessageSource[] = MESSAGE_SOURCES,
): [MessageSource, boolean][] {
  const write: [MessageSource, boolean][] = [];
  for (const source of sources) {
    if (sourceSwitch(config, source) !== undefined) continue;
    const kept = stored[source];
    if (typeof kept === "boolean") write.push([source, kept]);
  }
  return write;
}
