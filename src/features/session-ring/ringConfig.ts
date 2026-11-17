export const SESSION_RING_STYLES = ["grid", "ring", "bar", "signal"] as const;
export type SessionRingStyle = (typeof SESSION_RING_STYLES)[number];

export const RING_CONFIG_DEFAULTS = { style: "grid", showCount: true } as const satisfies Record<string, boolean | string>;

export type RingConfigKey = keyof typeof RING_CONFIG_DEFAULTS;

export type RingConfig = { style: SessionRingStyle; showCount: boolean };

export function ringConfig(raw: Readonly<Record<string, unknown>>): RingConfig {
  return {
    style: SESSION_RING_STYLES.find((known) => known === raw.style) ?? RING_CONFIG_DEFAULTS.style,
    showCount: raw.showCount !== false,
  };
}

export function storedRingValue(key: RingConfigKey, value: boolean | string): boolean | string | null {
  return value === RING_CONFIG_DEFAULTS[key] ? null : value;
}
