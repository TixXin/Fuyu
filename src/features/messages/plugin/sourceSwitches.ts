export const MIRRORED_SOURCES = ["qq", "wechat"] as const;

export type MirroredSource = (typeof MIRRORED_SOURCES)[number];

export type SourceValues = Record<MirroredSource, boolean>;

export type SourceConfig = Readonly<Record<string, unknown>>;

export function sourceSwitch(config: SourceConfig, source: string): boolean | undefined {
  const value = config[source];
  return typeof value === "boolean" ? value : undefined;
}

export interface SourcesReconciled {
  write: [MirroredSource, boolean][];
  mirror: [MirroredSource, boolean][];
}

export function reconcileSources(stored: SourceValues, config: SourceConfig, seen: SourceValues | null, sources: readonly MirroredSource[] = MIRRORED_SOURCES): SourcesReconciled {
  const result: SourcesReconciled = { write: [], mirror: [] };
  for (const source of sources) {
    const on = sourceSwitch(config, source);
    const kept = stored[source];
    if (on === undefined) result.write.push([source, kept]);
    else if (kept === on) continue;
    else if (seen && kept !== seen[source]) result.write.push([source, kept]);
    else result.mirror.push([source, on]);
  }
  return result;
}
