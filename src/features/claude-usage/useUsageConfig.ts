import { useCallback, useMemo } from "react";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { OWNER } from "./plugin/owner.ts";
import { storedValue, usageConfig, type UsageConfig, type UsageConfigKey } from "./usageConfig.ts";

function save(key: UsageConfigKey, value: boolean | number | string) {
  void setBuiltinConfig(OWNER, key, storedValue(key, value)).catch((error: unknown) => console.error(`Could not save the usage rings' ${key}`, error));
}

export function useUsageConfig(): [UsageConfig, (key: UsageConfigKey, value: boolean | number | string) => void] {
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => usageConfig(raw), [raw]);
  const update = useCallback((key: UsageConfigKey, value: boolean | number | string) => save(key, value), []);
  return [config, update];
}
