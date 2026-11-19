import { useEffect, useMemo, useState } from "react";
import { visibilityInterval } from "../../lib/useVisibilityInterval";
import { getCursorUsage } from "./api";
import { HIDDEN_WITHOUT_NUMBERS, hasUsageNumbers, type UsageProvider, type UsageProviderId } from "./usageRing";

const CHECK_MS = 60_000;

export function useUsagePresence(providers: readonly UsageProvider[]): UsageProvider[] {
  const watchCursor = providers.some((provider) => provider.id === "cursor");
  const [present, setPresent] = useState<ReadonlySet<UsageProviderId>>(() => new Set());

  useEffect(() => {
    if (!watchCursor) return;
    let cancelled = false;
    const check = () => {
      void getCursorUsage(false)
        .then((usage) => {
          if (cancelled) return;
          const has = hasUsageNumbers(usage);
          setPresent((current) => (current.has("cursor") === has ? current : new Set(has ? ["cursor"] : [])));
        })
        .catch((error: unknown) => console.error("Failed to read cursor usage", error));
    };
    check();
    const stop = visibilityInterval(check, CHECK_MS);
    return () => {
      cancelled = true;
      stop();
    };
  }, [watchCursor]);

  return useMemo(() => providers.filter(({ id }) => !HIDDEN_WITHOUT_NUMBERS.has(id) || present.has(id)), [providers, present]);
}
