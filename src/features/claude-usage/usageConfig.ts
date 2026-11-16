import { shownUsageProviders, type UsageProviderId } from "./usageRing.ts";

export type UsageShow = "used" | "remaining";

export const USAGE_INTERVAL = { min: 5, max: 120 } as const;

export const USAGE_CONFIG_DEFAULTS = {
  claudeCode: true,
  codex: false,
  glm: false,
  kimi: false,
  show: "used",
  askAnthropic: false,
  proxy: "",
  intervalMinutes: 5,
} as const satisfies Record<string, boolean | number | string>;

export type UsageConfigKey = keyof typeof USAGE_CONFIG_DEFAULTS;

export type UsageConfig = {
  providers: Record<UsageProviderId, boolean>;
  show: UsageShow;
  askAnthropic: boolean;
  proxy: string;
  intervalMinutes: number;
};

export function usageConfig(raw: Readonly<Record<string, unknown>>): UsageConfig {
  const shown = new Set(shownUsageProviders(raw).map((provider) => provider.id));
  const interval = typeof raw.intervalMinutes === "number" && Number.isFinite(raw.intervalMinutes) ? Math.round(raw.intervalMinutes) : USAGE_CONFIG_DEFAULTS.intervalMinutes;
  return {
    providers: { claudeCode: shown.has("claudeCode"), codex: shown.has("codex"), glm: shown.has("glm"), kimi: shown.has("kimi") },
    show: raw.show === "remaining" ? "remaining" : "used",
    askAnthropic: raw.askAnthropic === true,
    proxy: typeof raw.proxy === "string" ? raw.proxy : "",
    intervalMinutes: Math.min(USAGE_INTERVAL.max, Math.max(USAGE_INTERVAL.min, interval)),
  };
}

export function storedValue(key: UsageConfigKey, value: boolean | number | string): boolean | number | string | null {
  return value === USAGE_CONFIG_DEFAULTS[key] ? null : value;
}
