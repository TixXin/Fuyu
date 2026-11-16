import { useCallback, useMemo } from "react";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "./plugin/owner.ts";
import { ringConfig, storedRingValue, type RingConfig, type RingConfigKey } from "./ringConfig.ts";

function save(key: RingConfigKey, value: boolean | string) {
  void setBuiltinConfig(OWNER, key, storedRingValue(key, value)).catch((error: unknown) => console.error(`Could not save the session ring's ${key}`, error));
}

export function useRingConfig(): [RingConfig, (key: RingConfigKey, value: boolean | string) => void] {
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => ringConfig(raw), [raw]);
  const update = useCallback((key: RingConfigKey, value: boolean | string) => save(key, value), []);
  return [config, update];
}
